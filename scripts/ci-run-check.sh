#!/usr/bin/env bash
set -u -o pipefail

name=""
output_dir="ci-results"
source_json=""
timeout_seconds=""
log_file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) name="$2"; shift 2 ;;
    --output-dir) output_dir="$2"; shift 2 ;;
    --source-json) source_json="$2"; shift 2 ;;
    --timeout-seconds) timeout_seconds="$2"; shift 2 ;;
    --log) log_file="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$name" || $# -eq 0 ]]; then
  echo "usage: ci-run-check.sh --name NAME [--output-dir DIR] [--source-json FILE] [--timeout-seconds N] -- COMMAND..." >&2
  exit 2
fi

mkdir -p "$output_dir"
log_file="${log_file:-${output_dir}/${name}.log}"
start_epoch=$(date +%s)
{
  echo "CI_CHECK_START name=${name} utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "CI_CHECK_COMMAND=$*"
} | tee "$log_file"

set +e
if [[ -n "$timeout_seconds" ]]; then
  timeout --signal=TERM --kill-after=30s "${timeout_seconds}s" "$@" 2>&1 | tee -a "$log_file"
  status=${PIPESTATUS[0]}
else
  "$@" 2>&1 | tee -a "$log_file"
  status=${PIPESTATUS[0]}
fi
set -e

end_epoch=$(date +%s)
echo "CI_CHECK_END name=${name} utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) exit_code=${status} duration_seconds=$((end_epoch - start_epoch))" | tee -a "$log_file"

writer=(node scripts/ci-write-result.js --name "$name" --output-dir "$output_dir" --exit-code "$status")
if [[ -n "$source_json" ]]; then writer+=(--source-json "$source_json"); fi
"${writer[@]}"
exit "$status"

