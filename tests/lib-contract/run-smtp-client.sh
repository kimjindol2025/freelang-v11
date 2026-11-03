#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the run-specific artifact directory}"
: "${FREELANG_HTTP_CGC:?Set the verified Stage2 compiler}"
work=$(mktemp -d "$TMPDIR/smtp-client.XXXXXXXX")
pids=()
fds=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  rm -f -- "$work/key.pem" "$work/cert.pem" "$work/other-key.pem" "$work/other-cert.pem"
  unset SMTP_TEST_PASSWORD
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
umask 077
cd "$root"
build() {
  local name=$1 source=$2
  "$FREELANG_HTTP_CGC" "$root/$source" "$work/$name.c" >"$work/$name.compile" 2>&1
  if grep -E '\[CGC-ERR\]|\[load\]' "$work/$name.compile"; then return 1; fi
  bash scripts/build-cgc-native.sh "$work/$name.c" "$work/$name" >"$work/$name.build" 2>&1
}
build fixture tests/lib-contract/smtp-fixture.fl
build client tests/lib-contract/smtp-client.test.fl
build api tests/lib-contract/connection-api.test.fl
build example examples/smtp-local.fl
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=untrusted-fixture \
  -keyout "$work/other-key.pem" -out "$work/other-cert.pem" >"$work/other-cert-generation.log" 2>&1
export SSL_CERT_FILE="$work/cert.pem"
SMTP_TEST_PASSWORD=$(openssl rand -hex 16)
export SMTP_TEST_PASSWORD
"$work/fixture" replies "$work/replies"
start_tls() {
  local label=$1 port input_fd
  port=$(shuf -i 20000-60000 -n 1)
  mkfifo "$work/$label.in" "$work/$label.out"
  exec {input_fd}<>"$work/$label.in"
  fds+=("$input_fd")
  # Redact authentication tokens before any transcript reaches a file.
  awk 'redact>0 {print "<가림>"; redact--; fflush(); next} /^AUTH LOGIN\r?$/ {redact=2} {print; fflush()}' \
    <"$work/$label.out" >"$work/$label.tls-dialogue" &
  pids+=("$!")
  openssl s_server -accept "127.0.0.1:$port" -cert "$work/cert.pem" -key "$work/key.pem" \
    -quiet -ign_eof -naccept 1 <"$work/$label.in" >"$work/$label.out" 2>"$work/$label.tls-errors" &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    kill -0 "${pids[-1]}" 2>/dev/null || return 1
    if ss -ltnH "sport = :$port" | grep -q .; then
      cat "$work/replies" >"$work/$label.in"
      printf -v "$label" '%s' "$port"
      return
    fi
    sleep 0.02
  done
  return 1
}
start_plain() {
  local label=$1 mode=$2 backend=${3:-0}
  "$work/fixture" "$mode" "$work/$label" "$backend" >"$work/$label.fixture-log" 2>&1 &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    kill -0 "${pids[-1]}" 2>/dev/null || return 1
    if [[ -s "$work/$label.port" ]]; then printf -v "$label" '%s' "$(cat "$work/$label.port")"; return; fi
    sleep 0.02
  done
  return 1
}
start_plain apiplain api
start_tls apigood
start_tls apibad
"$work/api" "$apiplain" "$apigood" "$apibad" | tee "$work/api.results"
start_tls backendgood
start_plain good normal "$backendgood"
"$work/client" normal "$good" OK | tee "$work/normal.results"
start_tls backendbad
start_plain bad normal "$backendbad"
SSL_CERT_FILE="$work/other-cert.pem" "$work/client" badcert "$bad" TLS | tee "$work/badcert.results"
start_plain reject reject
"$work/client" reject "$reject" SMTP_REPLY | tee "$work/reject.results"
start_plain silent silent
"$work/client" silent "$silent" TIMEOUT | tee "$work/silent.results"
"$work/client" injection 1 HEADER_INJECTION | tee "$work/injection.results"
# Verify actual decrypted client commands reached the local TLS endpoint.
for ((i=0;i<100;i++)); do
  if grep -q '^QUIT' "$work/backendgood.tls-dialogue"; then break; fi
  sleep 0.02
 done
for text in 'EHLO local.test' 'AUTH LOGIN' 'MAIL FROM:<sender@example.invalid>' 'RCPT TO:<receiver@example.invalid>' 'DATA' 'QUIT' '..dot line'; do
  grep -Fq "$text" "$work/backendgood.tls-dialogue"
done
printf 'LOCAL_TLS_PEER_TRANSCRIPT_BEGIN\n'
cat "$work/backendgood.tls-dialogue"
printf 'LOCAL_TLS_PEER_TRANSCRIPT_END\nSMTP_SUMMARY=5/5\n'
