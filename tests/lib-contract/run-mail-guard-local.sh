#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the run-specific artifact directory}"
: "${FREELANG_HTTP_CGC:?Set the verified Stage2 compiler}"
work=$(mktemp -d "$TMPDIR/mail-guard.XXXXXXXX")
pids=()
fds=()
client_pids=()
cleanup() {
  for pid in "${client_pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${client_pids[@]}"; do wait "$pid" 2>/dev/null || :; done
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
for name in fixture client lock lockworker; do
  source=tests/lib-contract/mail-guard-fixture.fl
  [[ $name == client ]] && source=tests/lib-contract/mail-guard-client.test.fl
  [[ $name == lock ]] && source=tests/lib-contract/file-lock.test.fl
  [[ $name == lockworker ]] && source=tests/lib-contract/mail-guard-lock-worker.test.fl
  "$FREELANG_HTTP_CGC" "$root/$source" "$work/$name.c" >"$work/$name.compile" 2>&1
  if grep -E '\[CGC-ERR\]|\[load\]' "$work/$name.compile"; then exit 1; fi
  bash scripts/build-cgc-native.sh "$work/$name.c" "$work/$name" >"$work/$name.build" 2>&1
done
"$work/lock" "$work/runtime.lock" | tee "$work/lock.results"
grep -Fq 'FILE_LOCK_SUMMARY=9/9' "$work/lock.results"
printf '0' >"$work/counter"
for attempt in 1 2 3 4 5 6 7 8; do
  "$work/lockworker" "$work/counter.lock" "$work/counter" >"$work/counter-$attempt.log" 2>&1 &
  client_pids+=("$!")
done
for pid in "${client_pids[@]}"; do wait "$pid"; done
client_pids=()
test "$(cat "$work/counter")" = 8
printf 'PASS SAFE2 cross-process-lock increments=8/8\n'
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
export SSL_CERT_FILE="$work/cert.pem"
SMTP_TEST_PASSWORD=$(openssl rand -hex 16)
export SMTP_TEST_PASSWORD
"$work/fixture" replies "$work/replies"

start_tls() {
  local label=$1 port input_fd server_pid i
  for ((i=0;i<30;i++)); do
    port=$(shuf -i 20000-60000 -n 1)
    if ! ss -ltnH "sport = :$port" | grep -q .; then break; fi
    port=
  done
  [[ -n $port ]] || return 1
  mkfifo "$work/$label.in" "$work/$label.out"
  exec {input_fd}<>"$work/$label.in"
  fds+=("$input_fd")
  openssl s_server -accept "127.0.0.1:$port" -cert "$work/cert.pem" -key "$work/key.pem" \
    -quiet -ign_eof -naccept 1 <"$work/$label.in" >"$work/$label.out" 2>"$work/$label.tls-errors" &
  server_pid=$!
  pids+=("$server_pid")
  while IFS= read -r line || [[ -n $line ]]; do
    if [[ ${line%$'\r'} == '.' ]]; then printf 'MAIL_DATA_TERMINATOR_SEEN\n' >"$work/$label.delivered"; fi
  done <"$work/$label.out" &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    kill -0 "$server_pid" 2>/dev/null || return 1
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
  local base=$1 body=$2 draft=$3 subject=$4 hash material
  mkdir -p "$base"
  material=$(printf '["sender@example.invalid","receiver@example.invalid","%s","%s"]' "$subject" "$body")
  hash=$(printf %s "$material" | sha256sum)
  hash=${hash%% *}
  printf '{"draft_id":"%s","mail_sha256":"%s","used":false}\n' "$draft" "$hash" >"$base/approval.json"
}
run_block() {
  local mode=$1 base="$work/$1"
  mkdir -p "$base"
  [[ $mode == missing ]] || approve "$base" "approved local draft" "draft-$mode" "guard $mode"
  [[ $mode != stop ]] || : >"$base/STOP"
  "$work/client" "$mode" 1 "$base" | tee "$work/$mode.results"
  grep -Fq "GUARD_RESULT=$([[ $mode == risk ]] && printf '사장님 확인 필요' || { [[ $mode == stop ]] && printf emergency-stop || { [[ $mode == outside ]] && printf recipient-denied || printf approval-missing-stale-or-used; }; })" "$work/$mode.results"
  printf 'PASS GUARD %s\n' "$mode"
}
run_block missing
run_block changed
run_block changed-subject
run_block outside
run_block risk

hourly="$work/hourly"
mkdir -p "$hourly"
: >"$hourly/rate.txt"
for attempt in 1 2 3; do
  endpoint="ok$attempt"
  base="$hourly/draft-$attempt"
  draft="draft-hourly-$attempt"
  approve "$base" "approved local draft" "$draft" "guard hourly"
  new_endpoint "$endpoint"
  "$work/client" success "$NEW_PORT" "$base" "$hourly" "$draft" | tee "$work/hourly-$attempt.results"
  grep -Fq 'GUARD_RESULT=sent' "$work/hourly-$attempt.results"
  for ((i=0;i<100;i++)); do [[ -s "$work/$endpoint.delivered" ]] && break; sleep 0.02; done
  test -s "$work/$endpoint.delivered"
  printf 'PASS GUARD approved-delivery-%s %s\n' "$attempt" "$(cat "$work/$endpoint.delivered")"
done
fourth="$hourly/draft-4"
approve "$fourth" "approved local draft" draft-hourly-4 "guard hourly"
"$work/client" hourly 1 "$fourth" "$hourly" draft-hourly-4 | tee "$work/hourly-4.results"
grep -Fq 'GUARD_RESULT=hourly-limit' "$work/hourly-4.results"
printf 'PASS GUARD hourly-fourth-blocked\n'
run_block stop

replay="$work/replay"
mkdir -p "$replay"
: >"$replay/rate.txt"
approve "$replay" "approved local draft" draft-hourly "guard hourly"
new_endpoint replay-first
"$work/client" success "$NEW_PORT" "$replay" "$replay" draft-hourly >"$work/replay-first.results"
grep -Fq 'GUARD_RESULT=sent' "$work/replay-first.results"
new_endpoint replay-second
"$work/client" hourly "$NEW_PORT" "$replay" "$replay" draft-hourly | tee "$work/replay-second.results"
grep -Fq 'GUARD_RESULT=approval-missing-stale-or-used' "$work/replay-second.results"
test -s "$work/replay-first.delivered"
test ! -e "$work/replay-second.delivered"
printf 'PASS SAFE2 approval-replay-blocked\n'

concurrent="$work/concurrent"
mkdir -p "$concurrent"
date +%s >"$concurrent/rate.txt"
date +%s >>"$concurrent/rate.txt"
race_ports=()
race_bases=()
race_drafts=()
for attempt in 1 2 3 4 5; do
  endpoint="race-$attempt"
  base="$concurrent/draft-$attempt"
  draft="draft-race-$attempt"
  approve "$base" "approved local draft" "$draft" "guard hourly"
  new_endpoint "$endpoint"
  race_ports+=("$NEW_PORT")
  race_bases+=("$base")
  race_drafts+=("$draft")
done
for index in 0 1 2 3 4; do
  port=${race_ports[$index]}
  base=${race_bases[$index]}
  draft=${race_drafts[$index]}
  (
    while [[ ! -e "$work/race.go" ]]; do sleep 0.005; done
    exec "$work/client" success "$port" "$base" "$concurrent" "$draft"
  ) >"$work/race-$((index+1)).client" 2>&1 &
  client_pids+=("$!")
done
touch "$work/race.go"
for pid in "${client_pids[@]}"; do wait "$pid"; done
client_pids=()
for ((i=0;i<100;i++)); do
  delivered_count=$(find "$work" -maxdepth 1 -name 'race-*.delivered' -type f | wc -l | tr -d '[:space:]')
  [[ "$delivered_count" -ge 1 ]] && break
  sleep 0.02
done
sent_count=$(grep -l '^GUARD_RESULT=sent$' "$work"/race-*.client | wc -l | tr -d '[:space:]')
limit_count=$(grep -l '^GUARD_RESULT=hourly-limit$' "$work"/race-*.client | wc -l | tr -d '[:space:]')
delivered_count=$(find "$work" -maxdepth 1 -name 'race-*.delivered' -type f | wc -l | tr -d '[:space:]')
printf 'SAFE2_CONCURRENCY_COUNTS sent=%s blocked=%s delivered=%s\n' "$sent_count" "$limit_count" "$delivered_count"
test "$sent_count" -eq 1
test "$limit_count" -eq 4
test "$delivered_count" -eq 1
printf 'PASS SAFE2 concurrent-limit sent=%s blocked=%s delivered=%s\n' "$sent_count" "$limit_count" "$delivered_count"
if grep -Eiq 'approved local draft|password|secret|body' "$work"/missing/audit.jsonl "$work"/changed/audit.jsonl "$work"/outside/audit.jsonl "$work"/risk/audit.jsonl "$hourly/audit.jsonl" "$work"/stop/audit.jsonl; then
  echo 'FAIL AUDIT contains restricted content'
  exit 1
fi
printf 'AUDIT_REDACTION=PASS fields=title,recipient,result\n'
echo 'GUARD_SUMMARY=6/6'
echo 'SAFE2_SUMMARY=3/3'
