#!/usr/bin/env bash
# Native local-only TLS fixtures; run under the caller's heavy-work lock.
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set TMPDIR to the run-specific artifact directory}"
: "${FREELANG_HTTP_CGC:?Set the verified Stage2 compiler}"
work=$(mktemp -d "$TMPDIR/tls-client.XXXXXXXX")
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || :; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || :; done
  rm -f -- "$work/key.pem" "$work/cert.pem" "$work/other-key.pem" "$work/other-cert.pem"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
umask 077
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost \
  -addext subjectAltName=DNS:localhost -keyout "$work/key.pem" -out "$work/cert.pem" >"$work/cert-generation.log" 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=untrusted-fixture \
  -keyout "$work/other-key.pem" -out "$work/other-cert.pem" >"$work/other-cert-generation.log" 2>&1
start_server() {
  local name=$1 mode=$2 port
  port=$(shuf -i 20000-60000 -n 1)
  openssl s_server -accept "127.0.0.1:$port" -cert "$work/cert.pem" -key "$work/key.pem" \
    "$mode" -ign_eof < "$work/server-input" >"$work/$name.stdout" 2>"$work/$name.stderr" &
  pids+=("$!")
  local i
  for ((i=0; i<100; i++)); do
    kill -0 "${pids[-1]}" 2>/dev/null || return 1
    if ss -ltnH "sport = :$port" | grep -q .; then
      printf -v "$name" '%s' "$port"
      return 0
    fi
    sleep 0.02
  done
  return 1
}
mkfifo "$work/server-input"
exec {server_input}<>"$work/server-input"
start_server normal -www
start_server silent -quiet
cd "$root"
units=(core collection io math error process json db http_server cgc-bridge)
sources=()
for unit in "${units[@]}"; do sources+=("$root/runtime/$unit.c"); done
build() {
  local name=$1 source=$2
  "$FREELANG_HTTP_CGC" "$root/tests/lib-contract/$source" "$work/$name.c" >"$work/$name.compile.log" 2>&1
  if grep -E '\[CGC-ERR\]|\[load\]' "$work/$name.compile.log"; then return 1; fi
  gcc -Wno-unused -I "$root/runtime" "$work/$name.c" "${sources[@]}" \
    -lm -lsqlite3 -lssl -lcrypto -o "$work/$name" >"$work/$name.build.log" 2>&1
}
build run-http run-http.fl
build tls-client tls-client.test.fl
export SSL_CERT_FILE="$work/cert.pem"
export FL_HTTP_TEST_HTTPS_URL="https://localhost:$normal/"
if [[ "${1:-}" != --tls-only ]]; then
  "$work/run-http" --root "$root" --compiler "$FREELANG_HTTP_CGC"
fi
"$work/tls-client" "$FL_HTTP_TEST_HTTPS_URL" OK trusted-certificate
SSL_CERT_FILE="$work/other-cert.pem" "$work/tls-client" "$FL_HTTP_TEST_HTTPS_URL" TLS untrusted-certificate
"$work/tls-client" "https://127.0.0.1:$normal/" TLS hostname-mismatch
"$work/tls-client" "https://localhost:$silent/" TIMEOUT response-timeout
"$work/tls-client" "$FL_HTTP_TEST_HTTPS_URL" RESPONSE_TOO_LARGE response-bound
echo TLS_SUMMARY=5/5
