#!/usr/bin/env bash
set -Eeuo pipefail

name=""
output_dir="ci-results"
source_json=""
exit_code=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) name="${2:?--name requires a value}"; shift 2 ;;
    --output-dir) output_dir="${2:?--output-dir requires a value}"; shift 2 ;;
    --source-json) source_json="${2:?--source-json requires a value}"; shift 2 ;;
    --exit-code) exit_code="${2:?--exit-code requires a value}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
if [[ -z "$name" || ! "$exit_code" =~ ^[0-9]+$ ]]; then
  echo 'usage: ci-write-result.sh --name NAME [--output-dir DIR] [--source-json FILE] --exit-code N' >&2
  exit 2
fi
command -v jq >/dev/null || { echo 'jq is required' >&2; exit 2; }
mkdir -p "$output_dir"
result_path="$output_dir/$name.json"
junit_path="$output_dir/$name.junit.xml"
captured_at="$(date -u +%Y-%m-%dT%H:%M:%S).000Z"
source_error=null
source_valid=true
source_passed=true
source_data='[]'
if [[ -n "$source_json" ]]; then
  if [[ ! -f "$source_json" ]] || ! jq -e 'type == "object" and (.success | type == "boolean")' "$source_json" >/dev/null 2>&1; then
    source_valid=false
    source_passed=false
    source_error='"invalid-or-unreadable-source-json"'
  else
    source_passed="$(jq -r '(.success == true) and ((.numFailedTests // 0) == 0)' "$source_json")"
    source_data="$(jq -c '[.]' "$source_json")"
  fi
fi
passed=false
if [[ "$exit_code" -eq 0 && "$source_valid" == true && "$source_passed" == true ]]; then passed=true; fi
timed_out=false
if [[ "$exit_code" -eq 124 || "$exit_code" -eq 137 || "$exit_code" -eq 143 ]]; then timed_out=true; fi
status=failure
[[ "$passed" == true ]] && status=success
[[ "$passed" == false && "$timed_out" == true ]] && status=timed_out

if [[ -n "$source_json" && "$source_valid" == true ]]; then
  jq -n \
    --arg name "$name" --arg status "$status" --arg sourceJson "$source_json" \
    --arg capturedAt "$captured_at" --argjson success "$passed" \
    --argjson exitCode "$exit_code" --argjson sourceError "$source_error" \
    --argjson sourceValid "$source_valid" --slurpfile source "$source_json" '
      {schema:"freelang-ci-result/v1",name:$name,status:$status,success:$success,
       exitCode:$exitCode,sourceJson:$sourceJson,sourceError:$sourceError,
       sourceValid:$sourceValid,capturedAt:$capturedAt} +
      ($source[0] | with_entries(select(.key == "numTotalTests" or .key == "numPassedTests" or
        .key == "numFailedTests" or .key == "numPendingTests" or .key == "startTime" or .key == "endTime")))
    ' > "$result_path"
else
  jq -n \
    --arg name "$name" --arg status "$status" --arg sourceJson "$source_json" \
    --arg capturedAt "$captured_at" --argjson success "$passed" \
    --argjson exitCode "$exit_code" --argjson sourceError "$source_error" \
    --argjson sourceValid "$source_valid" \
    '{schema:"freelang-ci-result/v1",name:$name,status:$status,success:$success,
      exitCode:$exitCode,sourceJson:(if $sourceJson == "" then null else $sourceJson end),
      sourceError:$sourceError,sourceValid:$sourceValid,capturedAt:$capturedAt}' > "$result_path"
fi

jq -nr --arg name "$name" --argjson passed "$passed" --argjson sourceValid "$source_valid" \
  --argjson sourceError "$source_error" --argjson source "$source_data" '
  def esc: tostring | gsub("&";"&amp;") | gsub("<";"&lt;") | gsub(">";"&gt;") |
           gsub("\"";"&quot;") | gsub("\u0027";"&apos;");
  (if ($source|length) > 0 and $sourceValid then
     [$source[0].testResults[]? as $file | $file.assertionResults[]? |
       . + {file:$file.name}]
   else [] end) as $assertions |
  (if ($assertions|length) > 0 then $assertions else
     [{fullName:$name,file:$name,status:(if $passed then "passed" else "failed" end),duration:0,failureMessages:[]}]
   end) as $cases |
  ([ $cases[] | select(.status == "failed") ] | length) as $caseFailures |
  (if $caseFailures > 0 then $caseFailures else (if $passed then 0 else 1 end) end) as $failures |
  ([ $cases[] | select(.status == "pending" or .status == "todo") ] | length) as $skipped |
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuite name=\"\($name|esc)\" tests=\"\($cases|length)\" failures=\"\($failures)\" skipped=\"\($skipped)\">" +
  ([ $cases[] | "<testcase classname=\"\((.file // $name)|esc)\" name=\"\((.fullName // $name)|esc)\" time=\"\((((.duration // 0)|tonumber? // 0) / 1000))\">" +
    (if .status == "failed" then "<failure message=\( ((.failureMessages // [] | join("\n")) as $m | if $m == "" then "check failed" else $m end)|esc ) />" else "" end) +
    (if .status == "pending" or .status == "todo" then "<skipped />" else "" end) + "</testcase>" ] | join("")) +
  "</testsuite>\n"
' > "$junit_path"
echo "CI_RESULT_JSON=$result_path"
echo "CI_RESULT_JUNIT=$junit_path"
