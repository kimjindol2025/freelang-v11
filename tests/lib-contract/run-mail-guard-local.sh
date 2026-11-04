#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the run-specific artifact directory}"
: "${FREELANG_HTTP_CGC:?Set the verified Stage2 compiler}"
work=$(mktemp -d "$TMPDIR/mail-guard.XXXXXXXX")
pids=()
fds=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  for fd in "${fds[@]}"; do eval "exec ${fd}>&-"; done
  rm -f -- "$work/key.pem" "$work/cert.pem" "$work/hourly/rate.txt"
  unset SMTP_TEST_PASSWORD
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
umask 077
cd "$root"
for name in fixture client; do
  source=tests/lib-contract/mail-guard-fixture.fl
  [[ $name == client ]] && source=tests/lib-contract/mail-guard-client.test.fl
  "$FREELANG_HTTP_CGC" "$root/$source" "$work/$name.c" >"$work/$name.compile" 2>&1
  if grep -E '\[CGC-ERR\]|\[load\]' "$work/$name.compile"; then exit 1; fi
  bash scripts/build-cgc-native.sh "$work/$name.c" "$work/$name" >"$work/$name.build" 2>&1
done
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
export SSL_CERT_FILE="$work/cert.pem"
SMTP_TEST_PASSWORD=$(openssl rand -hex 16)
export SMTP_TEST_PASSWORD
"$work/fixture" replies "$work/replies"

start_tls() {
  local label=$1 port input_fd
  port=$(shuf -i 20000-60000 -n 1)
  mkfifo "$work/$label.in"
  exec {input_fd}<>"$work/$label.in"
  fds+=("$input_fd")
  while IFS= read -r line || [[ -n $line ]]; do
    if [[ ${line%$'\r'} == '.' ]]; then printf 'MAIL_DATA_TERMINATOR_SEEN\n' >"$work/$label.delivered"; fi
  done < <(openssl s_server -accept "127.0.0.1:$port" -cert "$work/cert.pem" -key "$work/key.pem" \
    -quiet -ign_eof -naccept 1 <"$work/$label.in" 2>"$work/$label.tls-errors") &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    kill -0 "${pids[-1]}" 2>/dev/null || return 1
    if ss -ltnH "sport = :$port" | grep -q .; then
      cat "$work/replies" >"$work/$label.in"
      TLS_PORT=$port
      return
    fi
    sleep 0.02
  done
  return 1
}
start_plain() {
  local label=$1 backend=$2
  "$work/fixture" relay "$work/$label" "$backend" >"$work/$label.fixture" 2>&1 &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    if [[ -s "$work/$label.port" ]]; then
      PLAIN_PORT=$(cat "$work/$label.port")
      return
    fi
    sleep 0.02
  done
  return 1
}
new_endpoint() {
  local label=$1
  start_tls "$label"
  start_plain "$label.plain" "$TLS_PORT"
  NEW_PORT=$PLAIN_PORT
}
approve() {
  local base=$1 body=$2 draft=$3 hash
  mkdir -p "$base"
  hash=$(printf %s "$body" | sha256sum)
  hash=${hash%% *}
  printf '{"draft_id":"%s","body_sha256":"%s"}\n' "$draft" "$hash" >"$base/approval.json"
}
run_block() {
  local mode=$1 base="$work/$1"
  mkdir -p "$base"
  [[ $mode == missing ]] || approve "$base" "approved local draft" "draft-$mode"
  [[ $mode != stop ]] || : >"$base/STOP"
  "$work/client" "$mode" 1 "$base" | tee "$work/$mode.results"
  grep -Fq "GUARD_RESULT=$([[ $mode == risk ]] && printf '사람 확인 필요' || { [[ $mode == stop ]] && printf emergency-stop || { [[ $mode == outside ]] && printf recipient-denied || printf approval-missing-or-stale; }; })" "$work/$mode.results"
  printf 'PASS GUARD %s\n' "$mode"
}
run_block missing
run_block changed
run_block outside
run_block risk

hourly="$work/hourly"
mkdir -p "$hourly"
: >"$hourly/rate.txt"
approve "$hourly" "approved local draft" draft-hourly
for attempt in 1 2 3; do
  endpoint="ok$attempt"
  new_endpoint "$endpoint"
  "$work/client" success "$NEW_PORT" "$hourly" | tee "$work/hourly-$attempt.results"
  grep -Fq 'GUARD_RESULT=sent' "$work/hourly-$attempt.results"
  for ((i=0;i<100;i++)); do [[ -s "$work/$endpoint.delivered" ]] && break; sleep 0.02; done
  test -s "$work/$endpoint.delivered"
  printf 'PASS GUARD approved-delivery-%s %s\n' "$attempt" "$(cat "$work/$endpoint.delivered")"
done
"$work/client" hourly 1 "$hourly" | tee "$work/hourly-4.results"
grep -Fq 'GUARD_RESULT=hourly-limit' "$work/hourly-4.results"
printf 'PASS GUARD hourly-fourth-blocked\n'
run_block stop
if grep -Eiq 'approved local draft|password|secret|body' "$work"/missing/audit.jsonl "$work"/changed/audit.jsonl "$work"/outside/audit.jsonl "$work"/risk/audit.jsonl "$hourly/audit.jsonl" "$work"/stop/audit.jsonl; then
  echo 'FAIL AUDIT contains restricted content'
  exit 1
fi
printf 'AUDIT_REDACTION=PASS fields=title,recipient,result\n'
echo 'GUARD_SUMMARY=6/6'
