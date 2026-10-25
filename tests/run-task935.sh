#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
COMPILER="$1"
WORK="$2"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"

link_runtime() {
  gcc -w -I "$RUNTIME" -o "$2" "$1" \
    "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
    "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/http_server.c" \
    "$RUNTIME/cgc-bridge.c" -lm
}

"$COMPILER" "$ROOT/examples/static-files.fl" "$WORK/static-server.c" >"$WORK/static-server.compile" 2>&1
link_runtime "$WORK/static-server.c" "$WORK/static-server"
gcc -std=c11 -Wall -Wextra -Werror -o "$WORK/static-client" "$ROOT/tests/task935/static-client.c"
mkdir -p "$WORK/public/sub" "$WORK/outside-dir"
mkfifo "$WORK/public/pipe"
printf 'STATIC_PUBLIC_OK\n' >"$WORK/public/index.html"
printf 'STATIC_NESTED_OK\n' >"$WORK/public/sub/page.txt"
printf 'STATIC_SECRET_TASK935_EXAMPLE_ONLY\n' >"$WORK/outside-secret.txt"
printf 'STATIC_SECRET_TASK935_EXAMPLE_ONLY\n' >"$WORK/outside-dir/hidden.txt"
ln -s "$WORK/outside-secret.txt" "$WORK/public/file-link.txt"
ln -s "$WORK/outside-dir" "$WORK/public/dir-link"

start_server() {
  local name="$1" header_timeout="$2" body_timeout="$3" app="$4"
  local log="$WORK/$name.server.log" port=""
  if [[ "$app" == static ]]; then
    env FL_HTTP_PORT=0 FL_HTTP_HEADER_TIMEOUT_MS="$header_timeout" \
      FL_HTTP_BODY_TIMEOUT_MS="$body_timeout" "$WORK/static-server" "$WORK/public" >"$log" 2>&1 &
  else
    env FL_HTTP_PORT=0 FL_HTTP_HEADER_TIMEOUT_MS="$header_timeout" \
      FL_HTTP_BODY_TIMEOUT_MS="$body_timeout" "$WORK/timeout-server" >"$log" 2>&1 &
  fi
  SERVER_PID=$!
  for _ in $(seq 1 100); do
    port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$log" | head -n 1)"
    test -n "$port" && break
    sleep 0.02
  done
  test -n "$port"
  SERVER_PORT="$port"
}

stop_server() {
  kill "$1"
  wait "$1"
}

start_server static 500 500 static
static_pid="$SERVER_PID"
static_port="$SERVER_PORT"
"$WORK/static-client" "$static_port" "$WORK" >"$WORK/static.log" 2>&1
grep '^STATIC_CASE=' "$WORK/static.log"
grep -Fx 'STATIC_SUMMARY=18/18' "$WORK/static.log"
stop_server "$static_pid"

"$COMPILER" "$ROOT/tests/task935/timeout-server.fl" "$WORK/timeout-server.c" >"$WORK/timeout-server.compile" 2>&1
link_runtime "$WORK/timeout-server.c" "$WORK/timeout-server"
gcc -std=c11 -Wall -Wextra -Werror -o "$WORK/timeout-client" "$ROOT/tests/task935/timeout-client.c"

timeout_count=0
run_timeout_suite() {
  local name="$1" header_timeout="$2" body_timeout="$3" mode="$4"
  local pid port
  start_server "$name" "$header_timeout" "$body_timeout" timeout
  pid="$SERVER_PID"
  port="$SERVER_PORT"
  "$WORK/timeout-client" "$port" "$mode" >"$WORK/$name.client.log" 2>&1
  grep '^TIMEOUT_CASE=' "$WORK/$name.client.log"
  timeout_count=$((timeout_count + $(grep -c '^TIMEOUT_CASE=.*RESULT=PASS$' "$WORK/$name.client.log")))
  stop_server "$pid"
}

run_timeout_suite timeout-default 500 500 default
run_timeout_suite timeout-header-long 1600 500 header-long
run_timeout_suite timeout-body-long 500 1600 body-long
test "$timeout_count" -eq 8
printf 'TIMEOUT_SUMMARY=%s/8\n' "$timeout_count"

precision_count=0
for setting in 100 500 2000; do
  start_server "timeout-precision-$setting" "$setting" "$setting" timeout
  pid="$SERVER_PID"
  port="$SERVER_PORT"
  "$WORK/timeout-client" "$port" precision "$setting" >"$WORK/timeout-precision-$setting.client.log" 2>&1
  grep '^TIMEPREC_CASE=' "$WORK/timeout-precision-$setting.client.log"
  precision_count=$((precision_count + $(grep -c '^TIMEPREC_CASE=.*RESULT=PASS$' "$WORK/timeout-precision-$setting.client.log")))
  stop_server "$pid"
done
test "$precision_count" -eq 6
printf 'TIMEPREC_SUMMARY=%s/6\n' "$precision_count"
