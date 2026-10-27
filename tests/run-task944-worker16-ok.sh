#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SEED="${1:-$ROOT/bin/cgc-bin-x86_64-seed-v11}"
WORK="${2:?usage: run-task944-worker16-ok.sh <seed> <empty-work-dir> [duration] }"
DURATION="${3:-60}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-44 work directory must be empty' >&2
  exit 2
fi
command -v pidstat >/dev/null
mkdir -p "$WORK/public"
printf 'TASK944_EXECUTION_LOCATION=freelang-v11\n'
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/stage2.c"
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/stage2.c" "$WORK/stage2-bin" >"$WORK/stage2.build"
"$WORK/stage2-bin" "$ROOT/tests/task936/soak-server.fl" "$WORK/server.c" >"$WORK/server.compile" 2>&1
gcc -w -I "$ROOT/runtime" -o "$WORK/server" "$WORK/server.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread \
  -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"
FL_HTTP_WORKERS=16 FL_HTTP_PORT=0 MIXSOAK_DB="$WORK/bench.sqlite" \
  "$WORK/server" "$WORK/public" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill -TERM "$SERVER_PID" 2>/dev/null || true
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
: >"$WORK/acks.sql"
"$WORK/load-client" "$PORT" 1000 "$DURATION" 94401 "$WORK/acks.sql" ok \
  >"$WORK/client.log" 2>&1 &
CLIENT_PID=$!
pidstat -u -p "$CLIENT_PID" 1 "$DURATION" >"$WORK/pidstat.log" 2>&1 &
PIDSTAT_PID=$!
wait "$CLIENT_PID"
wait "$PIDSTAT_PID"
cat "$WORK/client.log"
cat "$WORK/pidstat.log"
printf 'TASK944_SERVER_LOG_BEGIN\n'
grep -E 'database is locked|HTTP_WORKER_(RESTART|EXIT)' "$WORK/server.log" || true
printf 'TASK944_SERVER_LOG_END\n'
