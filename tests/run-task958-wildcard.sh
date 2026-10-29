#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-task958-wildcard.sh <empty-work-dir>}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task958 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"

"$ROOT/bin/cgc-bin-x86_64-seed-v11" "$ROOT/self/cgc-main.fl" "$WORK/compiler.c" >"$WORK/seed-compile.log" 2>&1
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/compiler.c" "$WORK/compiler" >"$WORK/compiler-build.log" 2>&1
"$WORK/compiler" "$ROOT/tests/task958/wildcard.fl" "$WORK/server.c" >"$WORK/server-compile.log" 2>&1
gcc -w -I "$ROOT/runtime" -o "$WORK/server" "$WORK/server.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm \
  >"$WORK/server-build.log" 2>&1

FL_HTTP_PORT=0 "$WORK/server" >"$WORK/server.stdout" 2>"$WORK/server.stderr" &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
port=""
for _ in $(seq 1 100); do
  port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/server.stdout" | head -1)"
  [[ -n "$port" ]] && break
  kill -0 "$server_pid" 2>/dev/null || { cat "$WORK/server.stderr"; exit 1; }
  sleep 0.05
done
[[ -n "$port" ]] || { echo 'wildcard server did not listen' >&2; exit 1; }

status="$(curl --silent --show-error --output "$WORK/body" --write-out '%{http_code}' "http://127.0.0.1:$port/ok")"
body="$(cat "$WORK/body")"
printf 'WILDCARD_CASE=/ok HTTP=%s BODY=%s\n' "$status" "$body"
[[ "$status" == 200 && "$body" == WILDCARD_ROUTE_MATCHED ]]
echo WILDCARD_ROUTE_SUMMARY=1/1
