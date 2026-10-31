#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-cap-recovery-repeat.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-cap-recovery-repeat.sh <stage2-compiler> <empty-work-dir>}"
RUNTIME="$ROOT/runtime"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'CAP work directory must be empty' >&2
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

CAP_FAIL_COUNT=0
CAP_TEST_FAILURE_COUNT=0
for iteration in $(seq 1 20); do
  ITER="$WORK/iteration-$iteration"
  mkdir -p "$ITER"
  started_ns=$(date +%s%N)
  MIXSOAK_DB="$ITER/cap.sqlite" FL_HTTP_PORT=0 FL_HTTP_MAX_CONN=63 \
    FL_HTTP_WORKER_MAX_REQ=10000 FL_HTTP_WORKERS=64 \
    "$WORK/server" "$WORK/public" >"$ITER/server.log" 2>&1 &
  SERVER_PID=$!
  cleanup_server() {
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  }
  trap cleanup_server EXIT INT TERM
  PORT=""
  for _ in $(seq 1 100); do
    PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$ITER/server.log" | head -n 1)"
    test -n "$PORT" && break
    kill -0 "$SERVER_PID"
    sleep 0.05
  done
  test -n "$PORT"
  ZOMBIE_BEFORE="$(ps -o stat= --ppid "$SERVER_PID" 2>/dev/null | awk '$1 ~ /^Z/{n++} END{print n+0}' || true)"
  : >"$ITER/acknowledged.sql"
  "$WORK/load-client" "$PORT" 400 30 941 "$ITER/acknowledged.sql" slow300 \
    >"$ITER/client.log" 2>&1 &
  CLIENT_PID=$!
  while kill -0 "$CLIENT_PID" 2>/dev/null; do sleep 1; done
  wait "$CLIENT_PID"
  cat "$ITER/client.log"
  CAP_LINE="$(grep '^LOAD_STAGE ' "$ITER/client.log")"
  CAP_503="$(sed -n 's/.*status_503=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_RETRY_AFTER_MISSING="$(sed -n 's/.*retry_after_missing=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_OTHER_HTTP="$(sed -n 's/.*other_http=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_REFUSED="$(sed -n 's/.*connect_refused=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_TIMEOUT="$(sed -n 's/.*connect_timeout=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_CONNECT_OTHER="$(sed -n 's/.*connect_other=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_IO_ERRORS="$(sed -n 's/.*io_errors=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
  CAP_OTHER_ERRORS=$((CAP_OTHER_HTTP + CAP_REFUSED + CAP_TIMEOUT + CAP_CONNECT_OTHER + CAP_IO_ERRORS))
  CAP_ALIVE=0
  kill -0 "$SERVER_PID" 2>/dev/null && CAP_ALIVE=1

  CAP_RECOVERY_HTTP="$(curl --silent --max-time 3 -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:$PORT/about" 2>/dev/null || echo 000)"
  if [[ "$CAP_RECOVERY_HTTP" == 503 ]]; then
    printf 'CAP_FAILURE_ITERATION=%s\n' "$iteration"
    ps -o pid,ppid,stat,etime,args -p "$SERVER_PID" --ppid "$SERVER_PID" \
      | sed -E 's#/[^ ]+#<가림>#g'
    fd_total=0
    for pid in "$SERVER_PID" $(ps -o pid= --ppid "$SERVER_PID" 2>/dev/null); do
      [[ -d "/proc/$pid/fd" ]] || continue
      fd_total=$((fd_total + $(find "/proc/$pid/fd" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l)))
    done
    printf 'CAP_FAILURE_FD_TOTAL=%s\n' "$fd_total"
    printf 'CAP_FAILURE_ESTABLISHED_CONNECTIONS=%s\n' \
      "$(ss -tan state established 2>/dev/null | awk -v p=":$PORT" 'NR>1 && ($4 ~ p"$" || $5 ~ p"$"){n++} END{print n+0}')"
    grep -E '^(HTTP_MAX_CONN|FL_HTTP_WORKERS|FL_HTTP_WORKER_MAX_REQ|HTTP_WORKER_RESTART)' "$ITER/server.log" | tail -n 12
    CAP_FAILURE_FOLLOWUP_HTTP="$(curl --silent --max-time 3 -o /dev/null -w '%{http_code}' \
      "http://127.0.0.1:$PORT/about" 2>/dev/null || echo 000)"
    printf 'CAP_FAILURE_FOLLOWUP_HTTP=%s\n' "$CAP_FAILURE_FOLLOWUP_HTTP"
  fi
  ZOMBIE_AFTER="$(ps -o stat= --ppid "$SERVER_PID" 2>/dev/null | awk '$1 ~ /^Z/{n++} END{print n+0}' || true)"
  ZOMBIE_DELTA=$((ZOMBIE_AFTER - ZOMBIE_BEFORE))
  kill "$SERVER_PID"
  wait "$SERVER_PID" || true
  trap - EXIT INT TERM
  ACTIVE_MAX="$(sed -n 's/^HTTP_ACTIVE_CONNECTIONS_MAX=//p' "$ITER/server.log" | tail -n 1)"
  PASSED=0
  [[ "$ACTIVE_MAX" =~ ^[0-9]+$ ]] && (( ACTIVE_MAX <= 256 )) && PASSED=$((PASSED + 1))
  (( CAP_503 > 0 && CAP_RETRY_AFTER_MISSING == 0 )) && PASSED=$((PASSED + 1))
  (( CAP_OTHER_ERRORS == 0 && CAP_OTHER_HTTP == 0 && CAP_REFUSED == 0 && CAP_TIMEOUT == 0 && CAP_CONNECT_OTHER == 0 && CAP_IO_ERRORS == 0 )) && PASSED=$((PASSED + 1))
  (( CAP_ALIVE == 1 )) && PASSED=$((PASSED + 1))
  [[ "$CAP_RECOVERY_HTTP" == 200 ]] && PASSED=$((PASSED + 1))
  (( ZOMBIE_DELTA == 0 && ZOMBIE_AFTER == 0 )) && PASSED=$((PASSED + 1))
  ended_ns=$(date +%s%N)
  duration=$(awk -v s="$started_ns" -v e="$ended_ns" 'BEGIN{printf "%.3f", (e-s)/1000000000}')
  printf 'CAP_ACTIVE_CONNECTIONS_MAX=%s\nCAP_503=%s\nCAP_RETRY_AFTER_MISSING=%s\nCAP_OTHER_ERRORS=%s\nCAP_SERVER_ALIVE=%s\nCAP_RECOVERY_HTTP=%s\nCAP_ZOMBIE_BEFORE=%s\nCAP_ZOMBIE_AFTER=%s\nCAP_ZOMBIE_DELTA=%s\n' \
    "$ACTIVE_MAX" "$CAP_503" "$CAP_RETRY_AFTER_MISSING" "$CAP_OTHER_ERRORS" "$CAP_ALIVE" "$CAP_RECOVERY_HTTP" \
    "$ZOMBIE_BEFORE" "$ZOMBIE_AFTER" "$ZOMBIE_DELTA"
  printf 'CAP_ITERATION=%s CAP_RECOVERY_HTTP=%s CAP_SUMMARY=%s/6 DURATION_SEC=%s\n' \
    "$iteration" "$CAP_RECOVERY_HTTP" "$PASSED" "$duration"
  [[ "$CAP_RECOVERY_HTTP" == 503 ]] && CAP_FAIL_COUNT=$((CAP_FAIL_COUNT + 1)) || true
  (( PASSED == 6 )) || CAP_TEST_FAILURE_COUNT=$((CAP_TEST_FAILURE_COUNT + 1))
done
printf 'CAP_FAIL_COUNT=%s\n' "$CAP_FAIL_COUNT"
printf 'CAP_TEST_FAILURE_COUNT=%s\n' "$CAP_TEST_FAILURE_COUNT"
test "$CAP_TEST_FAILURE_COUNT" -eq 0
