#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the task temporary directory}"
: "${RUN_WORK_DIR:?Set the run artifact directory under /home/kim/tmp}"
: "${FREELANG_HTTP_CGC:?Set the verified native FreeLang compiler}"
for tool in curl jq strace ss shuf openssl setsid; do command -v "$tool" >/dev/null; done
mkdir -p "$RUN_WORK_DIR"
work=$(mktemp -d "$RUN_WORK_DIR/mail-api.XXXXXXXX")
server_pid=
fixture_pids=()
client_pids=()
worker_pids=()
tls_input_fd=
cleanup() {
  if [[ -n ${server_pid:-} ]]; then kill -- -"$server_pid" 2>/dev/null || :; wait "$server_pid" 2>/dev/null || :; fi
  for pid in "${client_pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${client_pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  for pid in "${worker_pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${worker_pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  for pid in "${fixture_pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${fixture_pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  if [[ -n ${tls_input_fd:-} ]]; then eval "exec ${tls_input_fd}>&-"; fi
  rm -f -- "$work/key.pem" "$work/cert.pem"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
umask 077
cd "$root"
"$FREELANG_HTTP_CGC" projects/agent-mail/app/server.fl "$work/server.c" >"$work/compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/server.c" "$work/server" >"$work/build.log" 2>&1
"$FREELANG_HTTP_CGC" tests/lib-contract/mail-api-seed.fl "$work/seed.c" >"$work/seed-compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/seed-compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/seed.c" "$work/seed" >"$work/seed-build.log" 2>&1
"$FREELANG_HTTP_CGC" projects/agent-mail/worker/send-outbox.fl "$work/outbox-worker.c" >"$work/outbox-worker-compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/outbox-worker-compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/outbox-worker.c" "$work/outbox-worker" >"$work/outbox-worker-build.log" 2>&1
"$FREELANG_HTTP_CGC" tests/lib-contract/mail-guard-fixture.fl "$work/fixture.c" >"$work/fixture-compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/fixture-compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/fixture.c" "$work/fixture" >"$work/fixture-build.log" 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
"$work/fixture" replies "$work/smtp-replies"
mkfifo "$work/smtp-tls.in" "$work/smtp-tls.out"
exec {tls_input_fd}<>"$work/smtp-tls.in"
: >"$work/smtp-tls.log"
(
  while IFS= read -r line || [[ -n $line ]]; do
    printf '%s\n' "$line" >>"$work/smtp-tls.log"
    if [[ ${line%$'\r'} == '.' ]]; then : >"$work/smtp-data-terminator.seen"; fi
  done
) <"$work/smtp-tls.out" &
fixture_pids+=("$!")
smtp_tls_port=
for _ in $(seq 1 30); do
  candidate=$(shuf -i 20000-60000 -n 1)
  if ! ss -ltnH "sport = :$candidate" | grep -q .; then smtp_tls_port=$candidate; break; fi
done
[[ -n $smtp_tls_port ]]
openssl s_server -accept "127.0.0.1:$smtp_tls_port" -cert "$work/cert.pem" -key "$work/key.pem" \
  -quiet -ign_eof -naccept 1 <"$work/smtp-tls.in" >"$work/smtp-tls.out" 2>"$work/smtp-tls-errors.log" &
fixture_pids+=("$!")
for _ in $(seq 1 100); do
  if ss -ltnH "sport = :$smtp_tls_port" | grep -q .; then break; fi
  sleep 0.02
done
ss -ltnH "sport = :$smtp_tls_port" | grep -q .
cat "$work/smtp-replies" >"$work/smtp-tls.in"
"$work/fixture" relay "$work/smtp-relay" "$smtp_tls_port" >"$work/smtp-relay.log" 2>&1 &
fixture_pids+=("$!")
for _ in $(seq 1 150); do
  if [[ -s "$work/smtp-relay.port" ]]; then break; fi
  sleep 0.02
done
[[ -s "$work/smtp-relay.port" ]]
smtp_port=$(cat "$work/smtp-relay.port")
port=
for _ in $(seq 1 30); do
  candidate=$(shuf -i 20000-60000 -n 1)
  if ! ss -ltnH "sport = :$candidate" | grep -q .; then port=$candidate; break; fi
done
[[ -n $port ]]
printf '%s' '{"email":"admin@example.invalid","password":"local-Admin-Password-42"}' >"$work/login.json"
printf '%s' '{"email":"admin@example.invalid","password":"wrong-password-for-test"}' >"$work/wrong.json"
printf '%s' '{"mailbox_id":"box-3","address":"support@example.invalid"}' >"$work/mailbox.json"
printf '%s' '{"mailbox_id":"box-2","address":"agent@outside.invalid"}' >"$work/outside-mailbox.json"
printf '%s' '{"email":"agent@example.invalid","password":"local-Agent-Password-42"}' >"$work/agent-login.json"
printf '%s' '{"email":"reviewer@example.invalid","password":"local-Reviewer-Password-42"}' >"$work/reviewer-login.json"
printf '%s' '{"email":"new-user@example.invalid","password":"local-New-Password-42","role":"agent"}' >"$work/new-user.json"
AGENT_MAIL_DB="$work/mail.db" AGENT_MAIL_SIGNING_SECRET='local-test-signing-key-at-least-32-bytes' \
  AGENT_MAIL_BOOTSTRAP_EMAIL='admin@example.invalid' AGENT_MAIL_BOOTSTRAP_PASSWORD='local-Admin-Password-42' \
  AGENT_MAIL_DB="$work/mail.db" "$work/seed" "$work/mail.db" >"$work/seed.log" 2>&1
grep -q '^MAIL_API_SEED=OK$' "$work/seed.log"
mkdir -p "$work/policy"
: >"$work/policy/rate.txt"
AGENT_MAIL_DB="$work/mail.db" AGENT_MAIL_SIGNING_SECRET='local-test-signing-key-at-least-32-bytes' \
  AGENT_MAIL_BOOTSTRAP_EMAIL='admin@example.invalid' AGENT_MAIL_BOOTSTRAP_PASSWORD='local-Admin-Password-42' \
  AGENT_MAIL_DOMAIN='example.invalid' AGENT_MAIL_POLICY_DIR="$work/policy" \
  AGENT_MAIL_SMTP_PORT="$smtp_port" AGENT_MAIL_SMTP_USERNAME='fixture' AGENT_MAIL_SMTP_PASSWORD='fixture-password' \
  AGENT_MAIL_PORT="$port" FL_HTTP_MAX_REQUESTS=29 \
  SSL_CERT_FILE="$work/cert.pem" \
  setsid strace -f -qq -e trace=execve,connect -o "$work/server.trace" \
  "$work/server" >"$work/server.log" 2>&1 &
server_pid=$!
base="http://127.0.0.1:$port"
ready=no
for _ in $(seq 1 150); do
  if curl --max-time 1 -fsS "$base/health" -o "$work/health.json" 2>/dev/null; then ready=yes; break; fi
  kill -0 "$server_pid" 2>/dev/null || { cat "$work/server.log"; exit 1; }
  sleep 0.05
done
[[ $ready == yes ]]
jq -e '.status == "ok" and .scope == "loopback"' "$work/health.json" >/dev/null
echo 'PASS MAIL_API loopback-health'
status=$(curl --max-time 3 -sS -o "$work/login-result.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary "@$work/login.json" "$base/v1/auth/login")
[[ $status == 200 ]]
token=$(jq -er '.access_token | select(type == "string" and length >= 32)' "$work/login-result.json")
printf 'header = "Authorization: Bearer %s"\n' "$token" >"$work/bearer.curl"
unset token
echo 'PASS MAIL_API password-login'
status=$(curl --max-time 3 -sS -o "$work/me.json" -w '%{http_code}' \
  --config "$work/bearer.curl" "$base/v1/auth/me")
[[ $status == 200 ]]
jq -e '.user.email == "admin@example.invalid" and .memberships[0].role == "admin"' "$work/me.json" >/dev/null
echo 'PASS MAIL_API bearer-identity'
status=$(curl --max-time 3 -sS -o "$work/wrong-result.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary "@$work/wrong.json" "$base/v1/auth/login")
[[ $status == 401 ]]
jq -e '.error.code == "INVALID_CREDENTIAL"' "$work/wrong-result.json" >/dev/null
echo 'PASS MAIL_API invalid-password'
status=$(curl --max-time 3 -sS -o "$work/mailbox-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/mailbox.json" "$base/v1/admin/mailboxes")
[[ $status == 201 ]]
jq -e '.mailbox_id == "box-3" and .address == "support@example.invalid"' "$work/mailbox-result.json" >/dev/null
echo 'PASS MAIL_API admin-creates-mailbox'
status=$(curl --max-time 3 -sS -o "$work/mailboxes.json" -w '%{http_code}' \
  --config "$work/bearer.curl" "$base/v1/mailboxes")
[[ $status == 200 ]]
jq -e '.mailboxes | length == 2 and any(.[]; .mailbox_id == "box-1") and any(.[]; .mailbox_id == "box-3")' "$work/mailboxes.json" >/dev/null
echo 'PASS MAIL_API owner-mailbox-list'
status=$(curl --max-time 3 -sS -o "$work/messages.json" -w '%{http_code}' \
  --config "$work/bearer.curl" "$base/v1/mailboxes/box-1/messages")
[[ $status == 200 ]]
jq -e '.mailbox.address == "admin@example.invalid" and (.messages | length == 1)' "$work/messages.json" >/dev/null
echo 'PASS MAIL_API owner-message-list'
status=$(curl --max-time 3 -sS -o "$work/outside-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/outside-mailbox.json" "$base/v1/admin/mailboxes")
[[ $status == 422 ]]
jq -e '.error.code == "INVALID_MAILBOX"' "$work/outside-result.json" >/dev/null
echo 'PASS MAIL_API domain-boundary'
status=$(curl --max-time 3 -sS -o "$work/unauthenticated.json" -w '%{http_code}' "$base/v1/mailboxes")
[[ $status == 401 ]]
echo 'PASS MAIL_API unauthenticated-denied'
printf '%s' '{"source_message_id":"msg-1","triage":{"요약":"답변 요청","분류":"업무","할 일 목록":[],"답장 초안":"확인했습니다.","위험 표시":false}}' >"$work/draft.json"
status=$(curl --max-time 3 -sS -o "$work/draft-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/draft.json" "$base/v1/mailboxes/box-1/drafts")
[[ $status == 201 ]]
jq -e '.state == "pending-human-approval" and .approval_required == true' "$work/draft-result.json" >/dev/null
draft_id=$(jq -er '.draft_id | select(type == "string" and length > 0)' "$work/draft-result.json")
printf '%s' "$draft_id" >"$work/draft-id"
unset draft_id
echo 'PASS MAIL_API safe-draft-create'
status=$(curl --max-time 3 -sS -o "$work/drafts.json" -w '%{http_code}' \
  --config "$work/bearer.curl" "$base/v1/drafts")
[[ $status == 200 ]]
jq -e '.drafts | length == 1 and .[0].state == "pending-human-approval"' "$work/drafts.json" >/dev/null
echo 'PASS MAIL_API owner-draft-list'
printf '%s' '{"source_message_id":"msg-1","triage":{"요약":"결제 요청","분류":"업무","할 일 목록":[],"답장 초안":"송금합니다.","위험 표시":true}}' >"$work/risky-draft.json"
status=$(curl --max-time 3 -sS -o "$work/risky-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/risky-draft.json" "$base/v1/mailboxes/box-1/drafts")
[[ $status == 200 ]]
jq -e '.status == "human-review-required" and .draft == null' "$work/risky-result.json" >/dev/null
echo 'PASS MAIL_API risk-held-no-draft'
status=$(curl --max-time 3 -sS -o "$work/new-user-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/new-user.json" "$base/v1/admin/users")
[[ $status == 201 ]]
new_user_id=$(jq -er '.user_id | select(type == "string" and length > 0)' "$work/new-user-result.json")
echo 'PASS MAIL_API admin-user-create'
printf '{"mailbox_id":"new-user-box","owner_id":"%s","address":"new-user@example.invalid"}' \
  "$new_user_id" >"$work/new-user-mailbox.json"
unset new_user_id
status=$(curl --max-time 3 -sS -o "$work/new-user-mailbox-result.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -H 'Content-Type: application/json' \
  --data-binary "@$work/new-user-mailbox.json" "$base/v1/admin/mailboxes")
[[ $status == 201 ]]
echo 'PASS MAIL_API admin-mailbox-provision-for-user'
status=$(curl --max-time 3 -sS -o "$work/self-approve.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -X POST "$base/v1/drafts/$(cat "$work/draft-id")/approve")
[[ $status == 403 ]]
jq -e '.error.code == "INDEPENDENT_APPROVAL_REQUIRED"' "$work/self-approve.json" >/dev/null
echo 'PASS MAIL_API draft-owner-cannot-approve'
status=$(curl --max-time 3 -sS -o "$work/reviewer-login-result.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary "@$work/reviewer-login.json" "$base/v1/auth/login")
[[ $status == 200 ]]
reviewer_token=$(jq -er '.access_token | select(type == "string" and length >= 32)' "$work/reviewer-login-result.json")
printf 'header = "Authorization: Bearer %s"\n' "$reviewer_token" >"$work/reviewer-bearer.curl"
unset reviewer_token
echo 'PASS MAIL_API reviewer-login'
status=$(curl --max-time 3 -sS -o "$work/approve-result.json" -w '%{http_code}' \
  --config "$work/reviewer-bearer.curl" -X POST "$base/v1/drafts/$(cat "$work/draft-id")/approve")
[[ $status == 201 ]]
jq -e '.state == "approved" and (.expires_at > 0)' "$work/approve-result.json" >/dev/null
echo 'PASS MAIL_API independent-human-approval'
status=$(curl --max-time 3 -sS -o "$work/approve-replay.json" -w '%{http_code}' \
  --config "$work/reviewer-bearer.curl" -X POST "$base/v1/drafts/$(cat "$work/draft-id")/approve")
[[ $status == 409 ]]
echo 'PASS MAIL_API approval-replay-denied'
for index in 1 2 3 4 5; do
  (
    while [[ ! -e "$work/send.go" ]]; do sleep 0.005; done
    status=$(curl --max-time 5 -sS -o "$work/send-$index.json" -w '%{http_code}' \
      --config "$work/reviewer-bearer.curl" -X POST "$base/v1/drafts/$(cat "$work/draft-id")/send")
    printf '%s' "$status" >"$work/send-$index.status"
  ) &
  client_pids+=("$!")
done
touch "$work/send.go"
for pid in "${client_pids[@]}"; do wait "$pid"; done
client_pids=()
success_count=0
blocked_count=0
job_id=
for index in 1 2 3 4 5; do
  status=$(cat "$work/send-$index.status")
  if [[ $status == 202 ]]; then
    success_count=$((success_count + 1))
    jq -e '.state == "queued"' "$work/send-$index.json" >/dev/null
    job_id=$(jq -er '.send_job_id | select(type == "string" and length > 0)' "$work/send-$index.json")
  elif [[ $status == 409 ]]; then
    blocked_count=$((blocked_count + 1))
    jq -e '.error.code == "APPROVAL_USED_OR_STALE"' "$work/send-$index.json" >/dev/null
  else
    echo "FAIL concurrent send returned HTTP $status"
    exit 1
  fi
done
[[ $success_count == 1 && $blocked_count == 4 && -n $job_id ]]
echo "PASS MAIL_API concurrent-approved-send success=$success_count blocked=$blocked_count"
for index in 1 2; do
  (
    while [[ ! -e "$work/outbox.go" ]]; do sleep 0.005; done
    AGENT_MAIL_SMTP_USERNAME='fixture' AGENT_MAIL_SMTP_PASSWORD='fixture-password' \
      SSL_CERT_FILE="$work/cert.pem" strace -f -qq -e trace=execve,connect -o "$work/outbox-worker-$index.trace" \
      "$work/outbox-worker" "$work/mail.db" "$work/policy" "$smtp_port" >"$work/outbox-worker-$index.log" 2>&1
  ) &
  worker_pids+=("$!")
done
touch "$work/outbox.go"
for pid in "${worker_pids[@]}"; do wait "$pid"; done
worker_pids=()
cat "$work/outbox-worker-1.log" "$work/outbox-worker-2.log"
processed_count=$(cat "$work/outbox-worker-1.log" "$work/outbox-worker-2.log" | awk -F= '/^OUTBOX_PROCESSED=/{total += $2} END {print total+0}')
submitted_count=$(cat "$work/outbox-worker-1.log" "$work/outbox-worker-2.log" | awk -F= '/^OUTBOX_SUBMITTED=/{total += $2} END {print total+0}')
[[ $processed_count == 1 && $submitted_count == 1 ]]
if grep -E 'execve\("[^"]*/(node|nodejs)("|/)|execve\("[^"]*\.js"' "$work/outbox-worker-1.trace" "$work/outbox-worker-2.trace"; then
  echo 'OUTBOX_WORKER_NODE_JS=nonzero'; exit 1
fi
echo 'OUTBOX_WORKER_CONCURRENT_SUMMARY=1/1'
echo 'OUTBOX_WORKER_NODE_JS=0'
status=$(curl --max-time 3 -sS -o "$work/send-job.json" -w '%{http_code}' \
  --config "$work/reviewer-bearer.curl" "$base/v1/send-jobs/$job_id")
unset job_id
[[ $status == 200 ]]
jq -e '.state == "submitted"' "$work/send-job.json" >/dev/null
echo 'PASS MAIL_API send-job-status'
smtp_connects=$( { grep -h -c "sin_port=htons($smtp_port)" "$work/outbox-worker-1.trace" "$work/outbox-worker-2.trace" || true; } | awk '{total += $1} END {print total+0}')
echo "SMTP_SUBMISSION_CONNECT_COUNT=$smtp_connects"
if [[ $smtp_connects != 1 ]]; then
  echo 'FAIL SMTP expected exactly one worker-to-fixture connection'
  rg 'connect\(' "$work/outbox-worker.trace" || true
  exit 1
fi
if ! grep -q 'RCPT TO:<receiver@example.invalid>' "$work/smtp-tls.log"; then
  echo 'FAIL SMTP recipient command missing from TLS transcript'
  cat "$work/smtp-relay.commands"
  cat "$work/smtp-tls.log"
  exit 1
fi
if [[ ! -e $work/smtp-data-terminator.seen ]]; then
  echo 'FAIL SMTP DATA terminator missing from TLS transcript'
  cat "$work/smtp-tls.log"
  exit 1
fi
echo 'PASS MAIL_API local-TLS-SMTP-delivery'
status=$(curl --max-time 3 -sS -o "$work/send-replay.json" -w '%{http_code}' \
  --config "$work/reviewer-bearer.curl" -X POST "$base/v1/drafts/$(cat "$work/draft-id")/send")
[[ $status == 409 ]]
jq -e '.error.code == "APPROVAL_USED_OR_STALE"' "$work/send-replay.json" >/dev/null
echo 'PASS MAIL_API send-approval-replay-denied'
status=$(curl --max-time 3 -sS -o "$work/agent-login-result.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' --data-binary "@$work/agent-login.json" "$base/v1/auth/login")
[[ $status == 200 ]]
agent_token=$(jq -er '.access_token | select(type == "string" and length >= 32)' "$work/agent-login-result.json")
printf 'header = "Authorization: Bearer %s"\n' "$agent_token" >"$work/agent-bearer.curl"
unset agent_token
status=$(curl --max-time 3 -sS -o "$work/cross-owner.json" -w '%{http_code}' \
  --config "$work/agent-bearer.curl" "$base/v1/mailboxes/box-1/messages")
[[ $status == 404 ]]
echo 'PASS MAIL_API cross-owner-denied'
status=$(curl --max-time 3 -sS -o "$work/logout.json" -w '%{http_code}' \
  --config "$work/bearer.curl" -X POST "$base/v1/auth/logout")
[[ $status == 200 ]]
jq -e '.revoked == true' "$work/logout.json" >/dev/null
echo 'PASS MAIL_API logout-revokes-session'
status=$(curl --max-time 3 -sS -o "$work/revoked.json" -w '%{http_code}' \
  --config "$work/bearer.curl" "$base/v1/auth/me")
[[ $status == 401 ]]
jq -e '.error.code == "INVALID_CREDENTIAL"' "$work/revoked.json" >/dev/null
echo 'PASS MAIL_API revoked-token-denied'
wait "$server_pid"
server_pid=
if grep -E 'execve\("[^"]*/(node|nodejs)("|/)|execve\("[^"]*\.js"' "$work/server.trace" "$work/outbox-worker-1.trace" "$work/outbox-worker-2.trace"; then
  echo 'NODE_JS_EXEC_COUNT=nonzero'; exit 1
fi
echo 'NODE_JS_EXEC_COUNT=0'
echo 'MAIL_API_SUMMARY=25/25'
