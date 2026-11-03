#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the run-specific artifact directory}"
: "${FREELANG_HTTP_CGC:?Set the verified Stage2 compiler}"
work=$(mktemp -d "$TMPDIR/imap-client.XXXXXXXX")
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  rm -f -- "$work/key.pem" "$work/cert.pem" "$work/other-key.pem" "$work/other-cert.pem"
  unset IMAP_TEST_PASSWORD
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
build fixture tests/lib-contract/imap-fixture.fl
build client tests/lib-contract/imap-client.test.fl
build example examples/imap-local.fl
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=untrusted-fixture \
  -keyout "$work/other-key.pem" -out "$work/other-cert.pem" >"$work/other-cert-generation.log" 2>&1
export SSL_CERT_FILE="$work/cert.pem"
IMAP_TEST_PASSWORD=$(openssl rand -hex 16)
export IMAP_TEST_PASSWORD
start_server() {
  local label=$1 mode=$2 port input_fd
  "$work/fixture" "$mode" "$work/$label.responses"
  port=$(shuf -i 20000-60000 -n 1)
  mkfifo "$work/$label.in" "$work/$label.out"
  exec {input_fd}<>"$work/$label.in"
  # LOGIN credentials are redacted before writing any transcript file.
  awk '/^[^ ]+ LOGIN / {print $1 " LOGIN <가림> <가림>"; fflush(); next} {sub(/\r$/, ""); print; fflush()}' \
    <"$work/$label.out" >"$work/$label.commands" &
  pids+=("$!")
  openssl s_server -accept "127.0.0.1:$port" -cert "$work/cert.pem" -key "$work/key.pem" \
    -quiet -ign_eof -naccept 1 <"$work/$label.in" >"$work/$label.out" 2>"$work/$label.tls-errors" &
  pids+=("$!")
  for ((i=0;i<100;i++)); do
    kill -0 "${pids[-1]}" 2>/dev/null || return 1
    if ss -ltnH "sport = :$port" | grep -q .; then
      cat "$work/$label.responses" >"$work/$label.in"
      printf -v "$label" '%s' "$port"
      return
    fi
    sleep 0.02
  done
  return 1
}
start_server normal normal
"$work/client" normal "$normal" OK | tee "$work/normal.results"
for ((i=0;i<100;i++)); do
  if grep -q '^A7 LOGOUT$' "$work/normal.commands"; then break; fi
  sleep 0.02
done
diff -u "$work/normal.responses.commands" "$work/normal.commands"
printf 'LOCAL_TLS_PEER_TRANSCRIPT_BEGIN\n'
cat "$work/normal.commands"
printf 'LOCAL_TLS_PEER_TRANSCRIPT_END\n'
start_server badcert normal
SSL_CERT_FILE="$work/other-cert.pem" "$work/client" badcert "$badcert" TLS | tee "$work/badcert.results"
test ! -s "$work/badcert.commands"
start_server denied login-no
"$work/client" login-no "$denied" IMAP_NO | tee "$work/login-no.results"
start_server silent silent
"$work/client" silent "$silent" TIMEOUT | tee "$work/silent.results"
start_server large large
"$work/client" large "$large" RESPONSE_TOO_LARGE | tee "$work/large.results"
# Run the user-facing example against a fresh local TLS fixture as well.
start_server example normal
IMAP_TEST_PORT="$example" "$work/example" | tee "$work/example.results"
printf 'IMAP_SUMMARY=5/5\n'
