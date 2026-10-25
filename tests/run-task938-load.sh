#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task938-load.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task938-load.sh <stage2-compiler> <empty-work-dir>}"
RUNTIME="$ROOT/runtime"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'load work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK/public"

# Fast regression suite only; task 9-37 soak and fuzz phases are intentionally excluded.
BASE_RC=0
bash "$ROOT/tests/run-task920.sh" "$COMPILER" "$WORK/base" >"$WORK/base.log" 2>&1 || BASE_RC=$?
printf 'LOAD_FAST_SUITE_RC=%s\n' "$BASE_RC"

printf 'LOAD_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"
export MIXSOAK_DB="$WORK/load.sqlite"
"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/load-server.c" >"$WORK/load-server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/load-server" "$WORK/load-server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread \
  -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"

FL_HTTP_PORT=0 "$WORK/load-server" "$WORK/public" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" 2>/dev/null || true; fi
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

PAGE_KB="$(( $(getconf PAGESIZE) / 1024 ))"
server_snapshot() {
  local pid statm rss_pages rss fd_count stat
  local -a pids=()
  SERVER_RSS_NOW=0; SERVER_FD_NOW=0; SERVER_ZOMBIE_NOW=0
  pids=("$SERVER_PID")
  while read -r pid; do [[ -n "$pid" ]] && pids+=("$pid"); done < <(ps -o pid= --ppid "$SERVER_PID" 2>/dev/null || true)
  for pid in "${pids[@]}"; do
    [[ -r "/proc/$pid/statm" ]] || continue
    read -r _ rss_pages _ <"/proc/$pid/statm"
    SERVER_RSS_NOW=$((SERVER_RSS_NOW + rss_pages * PAGE_KB))
    local -a fds=(/proc/"$pid"/fd/*)
    SERVER_FD_NOW=$((SERVER_FD_NOW + ${#fds[@]}))
    stat="$(ps -o stat= -p "$pid" 2>/dev/null | awk '{$1=$1;print}' || true)"
    [[ "$stat" == Z* ]] && SERVER_ZOMBIE_NOW=$((SERVER_ZOMBIE_NOW + 1))
  done
  return 0
}

STAGES=0
RECOVERIES=0
METRIC_OK=0
ALIVE_STAGES=0
OVERLOAD_CLEAN=1
FIRST_LIMIT=none
TOTAL_WRITE_HTTP_200=0
CREATED_ALL=1
for concurrency in 10 50 100 200 500 1000; do
  stage_id=$((STAGES + 1))
  server_snapshot
  rss_start=$SERVER_RSS_NOW; fd_start=$SERVER_FD_NOW
  rss_max=$rss_start; fd_max=$fd_start; zombies_max=$SERVER_ZOMBIE_NOW
  "$WORK/load-client" "$PORT" "$concurrency" 60 "$stage_id" >"$WORK/stage-$concurrency.log" 2>&1 &
  LOAD_PID=$!
  while kill -0 "$LOAD_PID" 2>/dev/null; do
    server_snapshot
    (( SERVER_RSS_NOW > rss_max )) && rss_max=$SERVER_RSS_NOW
    (( SERVER_FD_NOW > fd_max )) && fd_max=$SERVER_FD_NOW
    (( SERVER_ZOMBIE_NOW > zombies_max )) && zombies_max=$SERVER_ZOMBIE_NOW
    sleep 1
  done
  if wait "$LOAD_PID"; then :; else load_rc=$?; fi
  cat "$WORK/stage-$concurrency.log"
  if [[ "${load_rc:-0}" != 0 ]]; then CREATED_ALL=0; unset load_rc; fi
  server_snapshot
  (( SERVER_RSS_NOW > rss_max )) && rss_max=$SERVER_RSS_NOW
  (( SERVER_FD_NOW > fd_max )) && fd_max=$SERVER_FD_NOW
  (( SERVER_ZOMBIE_NOW > zombies_max )) && zombies_max=$SERVER_ZOMBIE_NOW
  printf 'LOAD_SERVER_METRIC concurrency=%s rss_start_kb=%s rss_max_kb=%s fd_start=%s fd_max=%s zombie_max=%s\n' \
    "$concurrency" "$rss_start" "$rss_max" "$fd_start" "$fd_max" "$zombies_max"
  if (( zombies_max == 0 )); then METRIC_OK=$((METRIC_OK + 1)); fi
  STAGES=$((STAGES + 1))
  line="$(cat "$WORK/stage-$concurrency.log")"
  writes="$(sed -n 's/.*write_http_200=\([0-9]*\).*/\1/p' <<<"$line")"
  TOTAL_WRITE_HTTP_200=$((TOTAL_WRITE_HTTP_200 + ${writes:-0}))
  error_pct="$(sed -n 's/.*error_pct=\([0-9.]*\).*/\1/p' <<<"$line")"
  if [[ -n "$error_pct" ]] && awk -v p="$error_pct" 'BEGIN{exit !(p>1.0)}'; then
    [[ "$FIRST_LIMIT" != none ]] || FIRST_LIMIT="$concurrency"
  fi
  io_errors="$(sed -n 's/.*io_errors=\([0-9]*\).*/\1/p' <<<"$line")"
  connect_timeout="$(sed -n 's/.*connect_timeout=\([0-9]*\).*/\1/p' <<<"$line")"
  connect_other="$(sed -n 's/.*connect_other=\([0-9]*\).*/\1/p' <<<"$line")"
  other_http="$(sed -n 's/.*other_http=\([0-9]*\).*/\1/p' <<<"$line")"
  if [[ -n "$io_errors" && "$io_errors" != 0 ]] || [[ -n "$connect_timeout" && "$connect_timeout" != 0 ]] || [[ -n "$connect_other" && "$connect_other" != 0 ]] || [[ -n "$other_http" && "$other_http" != 0 ]]; then OVERLOAD_CLEAN=0; fi
  recovery="$(curl --silent --max-time 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/ok" 2>/dev/null || echo 000)"
  printf 'LOAD_RECOVERY concurrency=%s HTTP_STATUS=%s\n' "$concurrency" "$recovery"
  [[ "$recovery" == 200 ]] && RECOVERIES=$((RECOVERIES + 1))
  if kill -0 "$SERVER_PID" 2>/dev/null && [[ "$(ps -o stat= -p "$SERVER_PID" 2>/dev/null | awk '{$1=$1;print}')" != Z* ]]; then
    ALIVE_STAGES=$((ALIVE_STAGES + 1)); alive=1
  else
    alive=0
  fi
  printf 'LOAD_SERVER_ALIVE concurrency=%s value=%s\n' "$concurrency" "$alive"
done

DB_ROWS="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*) FROM soak_writes;')"
DB_INTEGRITY="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'PRAGMA integrity_check;')"
printf 'LOAD_WRITE_HTTP_200=%s\n' "$TOTAL_WRITE_HTTP_200"
printf 'LOAD_DB_ROWS=%s\n' "$DB_ROWS"
printf 'LOAD_DB_WRITE_MATCH=%s\n' "$([[ "$DB_ROWS" == "$TOTAL_WRITE_HTTP_200" ]] && echo 1 || echo 0)"
printf 'LOAD_DB_INTEGRITY=%s\n' "$DB_INTEGRITY"
if kill -0 "$SERVER_PID" 2>/dev/null && [[ "$(ps -o stat= -p "$SERVER_PID" 2>/dev/null | awk '{$1=$1;print}')" != Z* ]]; then SERVER_ALIVE=1; else SERVER_ALIVE=0; fi
printf 'LOAD_SERVER_ALIVE=%s\n' "$SERVER_ALIVE"
printf 'LOAD_SERVER_ALIVE_STAGES=%s/6\n' "$ALIVE_STAGES"
printf 'LOAD_LIMIT_CONCURRENCY=%s\n' "$FIRST_LIMIT"
printf 'LOAD_OVERLOAD_CLEAN=%s\n' "$OVERLOAD_CLEAN"
printf 'LOAD_CLIENTS_CREATED_ALL=%s\n' "$CREATED_ALL"
printf 'LOAD_ZOMBIE_STAGES=%s/6\n' "$METRIC_OK"
SUMMARY=0
(( STAGES == 6 )) && SUMMARY=$((SUMMARY + 1))
[[ "$CREATED_ALL" == 1 ]] && SUMMARY=$((SUMMARY + 1))
(( RECOVERIES == 6 )) && SUMMARY=$((SUMMARY + 1))
(( METRIC_OK == 6 )) && SUMMARY=$((SUMMARY + 1))
[[ "$DB_ROWS" == "$TOTAL_WRITE_HTTP_200" ]] && SUMMARY=$((SUMMARY + 1))
[[ "$DB_INTEGRITY" == ok ]] && SUMMARY=$((SUMMARY + 1))
[[ "$ALIVE_STAGES" == 6 && "$SERVER_ALIVE" == 1 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$FIRST_LIMIT" != none || "$OVERLOAD_CLEAN" == 1 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$OVERLOAD_CLEAN" == 1 ]] && SUMMARY=$((SUMMARY + 1))
printf 'LOAD_SUMMARY=%s/9\n' "$SUMMARY"
test "$SUMMARY" -eq 9 && test "$BASE_RC" -eq 0

cleanup
trap - EXIT INT TERM

grep -E '^(FL_TEST_SUMMARY|TEST_EVIDENCE_SUMMARY|TCP_SUMMARY|HTTP_SUMMARY|AUDIT_SUMMARY|NATIVE_FORMS_SUMMARY|CGC_SYMBOL_SUMMARY|ERP_SUMMARY|ERP2_SUMMARY|ERP3_SUMMARY|CONC_SUMMARY|SEC_SUMMARY|AUTH_SUMMARY|PAGE_SUMMARY|NET2_SUMMARY|PW_SUMMARY|JWT_SUMMARY|STREAM_SUMMARY|JSONNUM_SUMMARY|PAR_SUMMARY|NAME_SUMMARY|WARN_SUMMARY|ABI_SUMMARY|BUILTIN2_SUMMARY|HOF_SUMMARY|OOM_SUMMARY|FORKFAIL_SUMMARY|STATIC_SUMMARY|TIMEOUT_SUMMARY|TIMEPREC_SUMMARY)=' "$WORK/base.log"
