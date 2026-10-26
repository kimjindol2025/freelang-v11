#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task942-pool.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task942-pool.sh <stage2-compiler> <empty-work-dir>}"
RUNTIME="$ROOT/runtime"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'pool work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK/public"
printf 'LOAD_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"

"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/server.c" >"$WORK/server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/server" "$WORK/server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread \
  -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"

printf 'POOL_BENCH_MEASUREMENT=client_monotonic_per_request_time duration_s=60 concurrency=1000\n'
stage=940
for workers in 0 4 8 16; do
  for route in ok mixed; do
    stage=$((stage + 1))
    db="$WORK/bench-$workers-$route.sqlite"
    log="$WORK/bench-$workers-$route.server.log"
    FL_HTTP_WORKERS="$workers" FL_HTTP_PORT=0 MIXSOAK_DB="$db" \
      "$WORK/server" "$WORK/public" >"$log" 2>&1 &
    server_pid=$!
    port=""
    for _ in $(seq 1 100); do
      port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$log" | head -n 1)"
      test -n "$port" && break
      kill -0 "$server_pid"
      sleep 0.05
    done
    test -n "$port"
    : >"$WORK/bench-$workers-$route.acks.sql"
    "$WORK/load-client" "$port" 1000 60 "$stage" \
      "$WORK/bench-$workers-$route.acks.sql" "$route" \
      >"$WORK/bench-$workers-$route.client.log" 2>&1
    printf 'POOL_BENCH workers=%s route=%s ' "$workers" "$route"
    cat "$WORK/bench-$workers-$route.client.log"
    kill -TERM "$server_pid"
    wait "$server_pid"
  done
done

printf 'POOL_MODE_LOAD2_AND_CAP_BEGIN\n'
FL_HTTP_WORKERS=4 FL_HTTP_CAP_WORKERS=256 FL_HTTP_SKIP_FAST=1 \
  bash "$ROOT/tests/run-task938-load.sh" "$COMPILER" "$WORK/load2" \
  >"$WORK/load2.log" 2>&1
grep -E '^(LOAD2_SUMMARY|FDFIX_SUMMARY|CAP_SUMMARY|LOAD_200_IDS_MISSING_FROM_DB=|LOAD_DB_ONLY_IDS=|LOAD_DUPLICATE_IDS=|LOAD_DB_INTEGRITY=|LOAD_DATABASE_IS_LOCKED=|CAP_ACTIVE_CONNECTIONS_MAX=|CAP_503=|CAP_OTHER_ERRORS=|CAP_RECOVERY_HTTP=|CAP_ZOMBIE_DELTA=)' "$WORK/load2.log"
grep -Fx 'LOAD2_SUMMARY=10/10' "$WORK/load2.log"
grep -Fx 'FDFIX_SUMMARY=5/5' "$WORK/load2.log"
grep -Fx 'CAP_SUMMARY=6/6' "$WORK/load2.log"

snapshot() {
  local pid rss fds stat
  local -a pids=()
  SNAP_RSS=0; SNAP_FD=0; SNAP_ZOMBIES=0
  pids=("$1")
  while read -r pid stat; do
    [[ -n "$pid" ]] || continue
    pids+=("$pid")
    [[ "$stat" == Z* ]] && SNAP_ZOMBIES=$((SNAP_ZOMBIES + 1))
  done < <(ps -o pid=,stat= --ppid "$1" 2>/dev/null || true)
  for pid in "${pids[@]}"; do
    [[ -r "/proc/$pid/statm" ]] || continue
    read -r _ rss _ <"/proc/$pid/statm"
    SNAP_RSS=$((SNAP_RSS + rss * $(getconf PAGESIZE) / 1024))
    local -a descriptors=(/proc/"$pid"/fd/*)
    SNAP_FD=$((SNAP_FD + ${#descriptors[@]}))
  done
}

MIXSOAK_DB="$WORK/pool-resources.sqlite" FL_HTTP_PORT=0 FL_HTTP_WORKERS=4 \
  "$WORK/server" "$WORK/public" >"$WORK/resources.server.log" 2>&1 &
SERVER_PID=$!
cleanup_server() { kill -TERM "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
trap cleanup_server EXIT INT TERM
PORT=""
for _ in $(seq 1 100); do
  PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/resources.server.log" | head -n 1)"
  test -n "$PORT" && break
  kill -0 "$SERVER_PID"
  sleep 0.05
done
test -n "$PORT"
snapshot "$SERVER_PID"
RSS_START=$SNAP_RSS; FD_START=$SNAP_FD
: >"$WORK/resources.acks.sql"
"$WORK/load-client" "$PORT" 50 10 950 "$WORK/resources.acks.sql" ok \
  >"$WORK/resources.client.log" 2>&1 &
LOAD_PID=$!
sleep 0.1
OLD_WORKER="$(sed -n 's/^HTTP_WORKER_STARTED slot=0 pid=//p' "$WORK/resources.server.log" | head -n 1)"
kill -KILL "$OLD_WORKER"
wait "$LOAD_PID"
cat "$WORK/resources.client.log"
RESTART_LINE="$(grep 'HTTP_WORKER_RESTART slot=0 .*reason=signal detail=9' "$WORK/resources.server.log" | head -n 1)"
printf 'POOL_KILLED_WORKER_RESTART=%s\n' "${RESTART_LINE:-missing}"
ERROR_PCT="$(sed -n 's/.*error_pct=\([0-9.]*\).*/\1/p' "$WORK/resources.client.log")"
awk -v p="$ERROR_PCT" 'BEGIN{printf "POOL_KILL_ERROR_PCT=%.3f\n", p; exit !(p < 1.0)}'
test -n "$RESTART_LINE"
curl --silent --show-error --max-time 3 -o /dev/null -w 'POOL_KILL_RECOVERY_HTTP=%{http_code}\n' \
  "http://127.0.0.1:$PORT/ok" | grep -Fx 'POOL_KILL_RECOVERY_HTTP=200'
snapshot "$SERVER_PID"
RSS_END=$SNAP_RSS; FD_END=$SNAP_FD
RESOURCE_STABLE=0
(( RSS_END <= RSS_START + 2048 && FD_END <= FD_START + 1 && FD_START <= FD_END + 1 )) && RESOURCE_STABLE=1
printf 'POOL_RESOURCE_START rss_kb=%s fd=%s\nPOOL_RESOURCE_END rss_kb=%s fd=%s\nPOOL_RESOURCE_STABLE=%s\n' \
  "$RSS_START" "$FD_START" "$RSS_END" "$FD_END" "$RESOURCE_STABLE"
ZOMBIES="$SNAP_ZOMBIES"
printf 'POOL_ZOMBIE_CHILDREN=%s\n' "$ZOMBIES"
kill -TERM "$SERVER_PID"
STOPPED_PID=$SERVER_PID
wait "$SERVER_PID"
trap - EXIT INT TERM
SERVER_PID=""
LEFT_CHILDREN="$(ps -o pid= --ppid "$STOPPED_PID" 2>/dev/null | wc -l)"
printf 'POOL_CHILDREN_AFTER_STOP=%s\n' "$LEFT_CHILDREN"

MIXSOAK_DB="$WORK/rotate.sqlite" FL_HTTP_PORT=0 FL_HTTP_WORKERS=2 \
  FL_HTTP_WORKER_MAX_REQ=5 "$WORK/server" "$WORK/public" >"$WORK/rotate.server.log" 2>&1 &
SERVER_PID=$!
trap cleanup_server EXIT INT TERM
PORT=""
for _ in $(seq 1 100); do
  PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/rotate.server.log" | head -n 1)"
  test -n "$PORT" && break
  kill -0 "$SERVER_PID"
  sleep 0.02
done
for _ in $(seq 1 16); do curl --silent --show-error --max-time 3 -o /dev/null "http://127.0.0.1:$PORT/ok"; done
for _ in $(seq 1 100); do
  grep -q 'reason=request-limit' "$WORK/rotate.server.log" && break
  sleep 0.02
done
ROTATE_LOG="$(grep 'HTTP_WORKER_RESTART .*reason=request-limit' "$WORK/rotate.server.log" | head -n 1)"
printf 'POOL_ROTATION_LOG=%s\n' "${ROTATE_LOG:-missing}"
test -n "$ROTATE_LOG"
kill -TERM "$SERVER_PID"
wait "$SERVER_PID"
trap - EXIT INT TERM
SERVER_PID=""

printf 'POOL_SECURITY_REGRESSIONS_BEGIN\n'
FL_HTTP_WORKERS=256 bash "$ROOT/tests/run-task934.sh" "$COMPILER" "$WORK/httpatk" >"$WORK/httpatk.log" 2>&1
FL_HTTP_WORKERS=256 bash "$ROOT/tests/run-task935.sh" "$COMPILER" "$WORK/static-timeout" >"$WORK/static-timeout.log" 2>&1
grep -E '^(HTTPATK_SUMMARY|STATIC_SUMMARY|TIMEOUT_SUMMARY|TIMEPREC_SUMMARY)=' \
  "$WORK/httpatk.log" "$WORK/static-timeout.log"
grep -Fx 'HTTPATK_SUMMARY=21/21' "$WORK/httpatk.log"
grep -Fx 'STATIC_SUMMARY=18/18' "$WORK/static-timeout.log"
grep -Fx 'TIMEOUT_SUMMARY=8/8' "$WORK/static-timeout.log"

LOAD2_OK="$(grep -Fx 'LOAD2_SUMMARY=10/10' "$WORK/load2.log" | wc -l)"
CAP_OK="$(grep -Fx 'CAP_SUMMARY=6/6' "$WORK/load2.log" | wc -l)"
KILL_OK=0; [[ -n "$RESTART_LINE" ]] && awk -v p="$ERROR_PCT" 'BEGIN{exit !(p < 1.0)}' && KILL_OK=1
ROTATE_OK=0; [[ -n "$ROTATE_LOG" ]] && ROTATE_OK=1
ZOMBIE_OK=0; (( ZOMBIES == 0 && LEFT_CHILDREN == 0 )) && ZOMBIE_OK=1
RESOURCE_OK="$RESOURCE_STABLE"
DB_ACK_MISSING="$(sed -n 's/^LOAD_200_IDS_MISSING_FROM_DB=//p' "$WORK/load2.log" | tail -n 1)"
DB_DUPLICATES="$(sed -n 's/^LOAD_DUPLICATE_IDS=//p' "$WORK/load2.log" | tail -n 1)"
DB_OK=0; [[ "$DB_ACK_MISSING" == 0 && "$DB_DUPLICATES" == 0 ]] && DB_OK=1
SECURITY_OK=0
grep -Fxq 'HTTPATK_SUMMARY=21/21' "$WORK/httpatk.log" && \
  grep -Fxq 'STATIC_SUMMARY=18/18' "$WORK/static-timeout.log" && \
  grep -Fxq 'TIMEOUT_SUMMARY=8/8' "$WORK/static-timeout.log" && SECURITY_OK=1
PASSED=$((LOAD2_OK + CAP_OK + KILL_OK + ROTATE_OK + ZOMBIE_OK + RESOURCE_OK + DB_OK + SECURITY_OK))
printf 'POOL_CHECK_LOAD2=%s/1\nPOOL_CHECK_CAP=%s/1\nPOOL_CHECK_KILL_RESTART=%s/1\nPOOL_CHECK_ROTATION=%s/1\nPOOL_CHECK_ZOMBIE=%s/1\nPOOL_CHECK_RESOURCES=%s/1\nPOOL_CHECK_DB_ACK=%s/1\nPOOL_CHECK_HTTP_SECURITY=%s/1\nPOOL_SUMMARY=%s/8\n' \
  "$LOAD2_OK" "$CAP_OK" "$KILL_OK" "$ROTATE_OK" "$ZOMBIE_OK" "$RESOURCE_OK" "$DB_OK" "$SECURITY_OK" "$PASSED"
test "$PASSED" -eq 8
