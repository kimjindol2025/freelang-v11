#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task950-pool-kill.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task950-pool-kill.sh <stage2-compiler> <empty-work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK/public"

"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/server.c" >"$WORK/server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/server" "$WORK/server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread \
  -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"

MIXSOAK_DB="$WORK/test.sqlite" FL_HTTP_PORT=0 FL_HTTP_WORKERS=4 \
  FL_HTTP_WORKER_MAX_REQ=1000 "$WORK/server" "$WORK/public" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill -TERM "$SERVER_PID" 2>/dev/null || true
  sleep 1
  while read -r pid; do
    [[ -n "$pid" ]] || continue
    kill -KILL "$pid" 2>/dev/null || true
  done < <(sed -n 's/^HTTP_WORKER_STARTED slot=[0-9][0-9]* pid=//p' "$WORK/server.log")
  kill -KILL "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

PORT=""
for _ in $(seq 1 100); do
  PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/server.log" | head -n 1)"
  test -n "$PORT" && break
  kill -0 "$SERVER_PID"
  sleep 0.05
done
test -n "$PORT"
for _ in $(seq 1 100); do
  started="$(grep -c '^HTTP_WORKER_STARTED ' "$WORK/server.log" || true)"
  (( started >= 4 )) && break
  sleep 0.02
done
(( started >= 4 ))

: >"$WORK/acks.sql"
"$WORK/load-client" "$PORT" 50 10 950 "$WORK/acks.sql" ok >"$WORK/client.log" 2>&1 &
CLIENT_PID=$!
sleep 0.1
OLD_WORKER="$(sed -n 's/^HTTP_WORKER_STARTED slot=0 pid=//p' "$WORK/server.log" | tail -n 1)"
kill -KILL "$OLD_WORKER"
wait "$CLIENT_PID"
cat "$WORK/client.log"

ERROR_PCT="$(sed -n 's/.*error_pct=\([0-9.]*\).*/\1/p' "$WORK/client.log")"
awk -v p="$ERROR_PCT" 'BEGIN{printf "POOL_KILL_ACCEPTABLE=%d\n", p < 1.0; exit !(p < 1.0)}'
