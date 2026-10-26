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
if [[ "${FL_HTTP_SKIP_FAST:-0}" != 1 ]]; then
  export FREELANG_HTTP_CGC="$COMPILER"
  bash "$ROOT/tests/run-task920.sh" "$COMPILER" "$WORK/base" >"$WORK/base.log" 2>&1 || BASE_RC=$?
  bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/oom-suite" >"$WORK/oom-suite.log" 2>&1 || BASE_RC=$?
  cat "$WORK/oom-suite.log" >>"$WORK/base.log"
else
  : >"$WORK/base.log"
  bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/oom-suite" >"$WORK/oom-suite.log" 2>&1
  cat "$WORK/oom-suite.log" >>"$WORK/base.log"
fi
printf 'LOAD_FAST_SUITE_RC=%s\n' "$BASE_RC"

FDFIX_DIR="$WORK/fdfix"
mkdir -p "$FDFIX_DIR"
"$COMPILER" "$ROOT/tests/task931/disk.fl" "$FDFIX_DIR/disk.c" >"$FDFIX_DIR/compile.log" 2>&1
gcc -w -I "$RUNTIME" -o "$FDFIX_DIR/disk" "$FDFIX_DIR/disk.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
sqlite3 "$FDFIX_DIR/probe.sqlite" 'CREATE TABLE payload(value TEXT);'
set +e
(ulimit -n 4; exec "$FDFIX_DIR/disk" db "$FDFIX_DIR/probe.sqlite") \
  >"$FDFIX_DIR/limited.out" 2>"$FDFIX_DIR/limited.err"
FDFIX_RC=$?
set -e
FDFIX_SIGNAL=0; (( FDFIX_RC > 128 )) && FDFIX_SIGNAL=$((FDFIX_RC - 128)) || true
FDFIX_ERROR="$(grep -o 'db-exec: .*' "$FDFIX_DIR/limited.err" | tail -n 1 || true)"
printf 'FDFIX_CASE=fd-limit RC=%s SIGNAL=%s ERROR=%s\n' \
  "$FDFIX_RC" "$FDFIX_SIGNAL" "$FDFIX_ERROR"
if (( FDFIX_RC != 1 || FDFIX_SIGNAL != 0 )) || [[ -z "$FDFIX_ERROR" ]]; then
  echo 'FDFIX_LIMITED_WRITE=FAIL' >&2
  exit 1
fi
set +e
"$FDFIX_DIR/disk" db "$FDFIX_DIR/probe.sqlite" >"$FDFIX_DIR/recovery.out" 2>"$FDFIX_DIR/recovery.err"
FDFIX_RECOVERY_RC=$?
set -e
FDFIX_ROWS="$(sqlite3 -batch -noheader "$FDFIX_DIR/probe.sqlite" 'SELECT count(*) FROM payload;')"
printf 'FDFIX_RECOVERY_RC=%s ROWS=%s\n' "$FDFIX_RECOVERY_RC" "$FDFIX_ROWS"
FDFIX_OOM_SUMMARY="$(grep -m1 '^OOM_SUMMARY=' "$WORK/base.log" || true)"
printf '%s\n' "$FDFIX_OOM_SUMMARY"
if (( FDFIX_RECOVERY_RC != 0 )) || [[ "$FDFIX_ROWS" != 1 || "$FDFIX_OOM_SUMMARY" != 'OOM_SUMMARY=12/12' ]]; then
  echo 'FDFIX_RECOVERY_OR_OOM=FAIL' >&2
  exit 1
fi

printf 'LOAD_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"
export MIXSOAK_DB="$WORK/load.sqlite"
export FL_HTTP_MAX_CONN=256
"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/load-server.c" >"$WORK/load-server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/load-server" "$WORK/load-server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" \
  -lsqlite3 -lcrypto -lm
gcc -std=c11 -O2 -Wall -Wextra -Werror -pthread \
  -o "$WORK/load-client" "$ROOT/tests/task938/load-client.c"

MIXSOAK_DB="$WORK/probe.sqlite" FL_HTTP_MAX_CONN=1 FL_HTTP_WORKERS=1 FL_HTTP_PORT=0 \
  "$WORK/load-server" "$WORK/public" >"$WORK/probe-server.log" 2>&1 &
PROBE_PID=$!
SLOW_PID=""
cleanup_probe() {
  [[ -z "$SLOW_PID" ]] || kill "$SLOW_PID" 2>/dev/null || true
  kill "$PROBE_PID" 2>/dev/null || true
  wait "$PROBE_PID" 2>/dev/null || true
}
trap cleanup_probe EXIT INT TERM
PROBE_PORT=""
for _ in $(seq 1 100); do
  PROBE_PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/probe-server.log" | head -n 1)"
  test -n "$PROBE_PORT" && break
  sleep 0.05
done
test -n "$PROBE_PORT"
curl --silent --show-error --max-time 5 -o "$WORK/slow-response" \
  -w '%{http_code}\n' "http://127.0.0.1:$PROBE_PORT/__slow" >"$WORK/slow-status" &
SLOW_PID=$!
sleep 0.1
PROBE_STATUS="$(curl --silent --show-error --max-time 3 -D "$WORK/overload.headers" \
  -o "$WORK/overload.body" -w '%{http_code}' "http://127.0.0.1:$PROBE_PORT/ok")"
wait "$SLOW_PID"
SLOW_PID=""
SLOW_STATUS="$(cat "$WORK/slow-status")"
if [[ "$PROBE_STATUS" != 503 || "$SLOW_STATUS" != 200 ]] ||
   ! grep -Eiq '^Retry-After: 1' "$WORK/overload.headers"; then
  printf 'LOAD_OVERLOAD_PROBE status=%s retry_after_missing=1 slow_status=%s\n' "$PROBE_STATUS" "$SLOW_STATUS"
  kill "$PROBE_PID" 2>/dev/null || true
  wait "$PROBE_PID" 2>/dev/null || true
  exit 1
fi
printf 'LOAD_OVERLOAD_PROBE status=%s retry_after=1 slow_status=%s\n' "$PROBE_STATUS" "$SLOW_STATUS"
kill "$PROBE_PID"
wait "$PROBE_PID" || true
trap - EXIT INT TERM

MIXSOAK_DB="$WORK/bench.sqlite" FL_HTTP_PORT=0 \
  "$WORK/load-server" "$WORK/public" >"$WORK/bench-server.log" 2>&1 &
BENCH_SERVER_PID=$!
cleanup_bench() {
  kill "$BENCH_SERVER_PID" 2>/dev/null || true
  wait "$BENCH_SERVER_PID" 2>/dev/null || true
}
trap cleanup_bench EXIT INT TERM
BENCH_PORT=""
for _ in $(seq 1 100); do
  BENCH_PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/bench-server.log" | head -n 1)"
  test -n "$BENCH_PORT" && break
  kill -0 "$BENCH_SERVER_PID"
  sleep 0.05
done
test -n "$BENCH_PORT"
BENCH_ACK_SQL="$WORK/bench-acknowledged.sql"
: >"$BENCH_ACK_SQL"
printf 'BENCH_MEASUREMENT=client_monotonic_per_request_time duration_s=10 concurrency=1000\n'
"$WORK/load-client" "$BENCH_PORT" 1000 10 99 "$BENCH_ACK_SQL" \
  >"$WORK/bench-mixed.log" 2>&1
printf 'BENCH_MODE=mixed_legacy_think_time '
cat "$WORK/bench-mixed.log"
for route in ok static jwt read write; do
  "$WORK/load-client" "$BENCH_PORT" 1000 10 100 "$BENCH_ACK_SQL" "$route" \
    >"$WORK/bench-$route.log" 2>&1
  printf 'BENCH_ROUTE=%s ' "$route"
  cat "$WORK/bench-$route.log"
done
kill "$BENCH_SERVER_PID"
wait "$BENCH_SERVER_PID" || true
trap - EXIT INT TERM

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
grep -E '^(DB_BUSY_TIMEOUT_MS|DB_JOURNAL_MODE|HTTP_LISTEN_BACKLOG|HTTP_MAX_CONN)=' "$WORK/server.log"
DB_JOURNAL_MODE="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'PRAGMA journal_mode;')"
printf 'LOAD_SQLITE3_JOURNAL_MODE=%s\n' "$DB_JOURNAL_MODE"
test "$DB_JOURNAL_MODE" = wal
ACK_SQL="$WORK/acknowledged.sql"
: >"$ACK_SQL"

PAGE_KB="$(( $(getconf PAGESIZE) / 1024 ))"
server_snapshot() {
  local pid child_stat statm rss_pages stat
  local -a pids=()
  SERVER_RSS_NOW=0; SERVER_FD_NOW=0; SERVER_ZOMBIE_NOW=0
  pids=("$SERVER_PID")
  while read -r pid child_stat; do
    [[ -n "$pid" ]] || continue
    pids+=("$pid")
    [[ "$child_stat" == Z* ]] && SERVER_ZOMBIE_NOW=$((SERVER_ZOMBIE_NOW + 1))
  done < <(ps -o pid=,stat= --ppid "$SERVER_PID" 2>/dev/null || true)
  for pid in "${pids[@]}"; do
    [[ -r "/proc/$pid/statm" ]] || continue
    read -r _ rss_pages _ <"/proc/$pid/statm"
    SERVER_RSS_NOW=$((SERVER_RSS_NOW + rss_pages * PAGE_KB))
    local -a fds=(/proc/"$pid"/fd/*)
    SERVER_FD_NOW=$((SERVER_FD_NOW + ${#fds[@]}))
  done
  stat="$(ps -o stat= -p "$SERVER_PID" 2>/dev/null | awk '{$1=$1;print}' || true)"
  [[ "$stat" == Z* ]] && SERVER_ZOMBIE_NOW=$((SERVER_ZOMBIE_NOW + 1))
  return 0
}

STAGES=0
RECOVERIES=0
METRIC_OK=0
ALIVE_STAGES=0
LOW_LOAD_OK=1
HIGH_REJECTION_OK=1
FIRST_LIMIT=none
TOTAL_WRITE_HTTP_200=0
CREATED_ALL=1
server_snapshot
INITIAL_RSS=$SERVER_RSS_NOW
INITIAL_FD=$SERVER_FD_NOW
for concurrency in 10 50 100 200 500 1000; do
  stage_id=$((STAGES + 1))
  server_snapshot
  rss_start=$SERVER_RSS_NOW; fd_start=$SERVER_FD_NOW
  rss_max=$rss_start; fd_max=$fd_start; zombies_max=$SERVER_ZOMBIE_NOW
  "$WORK/load-client" "$PORT" "$concurrency" 60 "$stage_id" "$ACK_SQL" >"$WORK/stage-$concurrency.log" 2>&1 &
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
  reject_pct="$(sed -n 's/.*rejection_pct=\([0-9.]*\).*/\1/p' <<<"$line")"
  errors="$(sed -n 's/.*errors=\([0-9]*\).*/\1/p' <<<"$line")"
  if (( concurrency <= 200 )) && [[ -n "$error_pct" ]] && awk -v p="$error_pct" 'BEGIN{exit !(p>=1.0)}'; then LOW_LOAD_OK=0; fi
  if (( concurrency >= 500 && ${errors:-0} > 0 )) &&
     { [[ -z "$reject_pct" ]] || ! awk -v p="$reject_pct" 'BEGIN{exit !(p>=90.0)}'; }; then HIGH_REJECTION_OK=0; fi
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

{ printf 'BEGIN;\n'; cat "$ACK_SQL"; printf 'COMMIT;\n'; } | sqlite3 -batch "$MIXSOAK_DB"
DB_ROWS="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*) FROM soak_writes;')"
ACK_ROWS="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*) FROM acknowledged_ids;')"
ACK_MISSING="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*) FROM acknowledged_ids a LEFT JOIN soak_writes w USING(request_id) WHERE w.request_id IS NULL;')"
DB_ONLY="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*) FROM soak_writes w LEFT JOIN acknowledged_ids a USING(request_id) WHERE a.request_id IS NULL;')"
DUPLICATES="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'SELECT count(*)-count(DISTINCT request_id) FROM soak_writes;')"
DB_INTEGRITY="$(sqlite3 -batch -noheader "$MIXSOAK_DB" 'PRAGMA integrity_check;')"
printf 'LOAD_WRITE_HTTP_200=%s\n' "$TOTAL_WRITE_HTTP_200"
printf 'LOAD_ACK_SQL_ROWS=%s\n' "$ACK_ROWS"
printf 'LOAD_DB_ROWS=%s\n' "$DB_ROWS"
printf 'LOAD_200_IDS_MISSING_FROM_DB=%s\n' "$ACK_MISSING"
printf 'LOAD_DB_ONLY_IDS=%s\n' "$DB_ONLY"
printf 'LOAD_DUPLICATE_IDS=%s\n' "$DUPLICATES"
printf 'LOAD_DB_WRITE_MATCH=%s\n' "$([[ "$DB_ROWS" == "$TOTAL_WRITE_HTTP_200" ]] && echo 1 || echo 0)"
printf 'LOAD_DB_INTEGRITY=%s\n' "$DB_INTEGRITY"
LOCK_ERRORS="$(grep -ic 'database is locked' "$WORK/server.log" || true)"
printf 'LOAD_DATABASE_IS_LOCKED=%s\n' "$LOCK_ERRORS"
server_snapshot
FINAL_RSS=$SERVER_RSS_NOW
FINAL_FD=$SERVER_FD_NOW
printf 'LOAD_RESOURCE_START rss_kb=%s fd=%s\n' "$INITIAL_RSS" "$INITIAL_FD"
printf 'LOAD_RESOURCE_END rss_kb=%s fd=%s\n' "$FINAL_RSS" "$FINAL_FD"
RESOURCE_STABLE=0
(( FINAL_RSS <= INITIAL_RSS + 2048 && FINAL_FD <= INITIAL_FD + 1 && INITIAL_FD <= FINAL_FD + 1 )) && RESOURCE_STABLE=1
printf 'LOAD_RESOURCE_STABLE=%s\n' "$RESOURCE_STABLE"
if kill -0 "$SERVER_PID" 2>/dev/null && [[ "$(ps -o stat= -p "$SERVER_PID" 2>/dev/null | awk '{$1=$1;print}')" != Z* ]]; then SERVER_ALIVE=1; else SERVER_ALIVE=0; fi
printf 'LOAD_SERVER_ALIVE=%s\n' "$SERVER_ALIVE"
printf 'LOAD_SERVER_ALIVE_STAGES=%s/6\n' "$ALIVE_STAGES"
printf 'LOAD_LIMIT_CONCURRENCY=%s\n' "$FIRST_LIMIT"
printf 'LOAD_LOW_CONCURRENCY_ERROR_RATE_OK=%s\n' "$LOW_LOAD_OK"
printf 'LOAD_HIGH_CONCURRENCY_REJECTIONS_OK=%s\n' "$HIGH_REJECTION_OK"
printf 'LOAD_CLIENTS_CREATED_ALL=%s\n' "$CREATED_ALL"
printf 'LOAD_ZOMBIE_STAGES=%s/6\n' "$METRIC_OK"
SUMMARY=0
(( STAGES == 6 && ALIVE_STAGES == 6 && SERVER_ALIVE == 1 )) && [[ "$CREATED_ALL" == 1 ]] && SUMMARY=$((SUMMARY + 1))
(( RECOVERIES == 6 )) && SUMMARY=$((SUMMARY + 1))
(( METRIC_OK == 6 )) && SUMMARY=$((SUMMARY + 1))
[[ "$LOW_LOAD_OK" == 1 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$HIGH_REJECTION_OK" == 1 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$LOCK_ERRORS" == 0 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$ACK_MISSING" == 0 && "$ACK_ROWS" == "$TOTAL_WRITE_HTTP_200" ]] && SUMMARY=$((SUMMARY + 1))
[[ "$DUPLICATES" == 0 ]] && SUMMARY=$((SUMMARY + 1))
[[ "$DB_INTEGRITY" == ok ]] && SUMMARY=$((SUMMARY + 1))
[[ "$RESOURCE_STABLE" == 1 ]] && SUMMARY=$((SUMMARY + 1))
printf 'LOAD2_SUMMARY=%s/10\n' "$SUMMARY" | tee "$WORK/final-summary.log"
test "$SUMMARY" -ge 9 && test "$BASE_RC" -eq 0

cleanup
trap - EXIT INT TERM

ACTIVE_CONNECTIONS_MAX="$(sed -n 's/^HTTP_ACTIVE_CONNECTIONS_MAX=//p' "$WORK/server.log" | tail -n 1)"
printf 'LOAD_ACTIVE_CONNECTIONS_MAX=%s\n' "$ACTIVE_CONNECTIONS_MAX"
if [[ ! "$ACTIVE_CONNECTIONS_MAX" =~ ^[0-9]+$ ]] || (( ACTIVE_CONNECTIONS_MAX > 256 )); then
  echo 'LOAD_ACTIVE_CONNECTIONS_MAX_INVALID=1' >&2
  exit 1
fi
FDFIX_PASSED=0
[[ -n "$FDFIX_ERROR" ]] && FDFIX_PASSED=$((FDFIX_PASSED + 1))
(( FDFIX_SIGNAL == 0 )) && FDFIX_PASSED=$((FDFIX_PASSED + 1))
(( FDFIX_RECOVERY_RC == 0 )) && [[ "$FDFIX_ROWS" == 1 ]] && FDFIX_PASSED=$((FDFIX_PASSED + 1))
[[ "$FDFIX_OOM_SUMMARY" == 'OOM_SUMMARY=12/12' ]] && FDFIX_PASSED=$((FDFIX_PASSED + 1))
grep -Fxq 'LOAD2_SUMMARY=10/10' "$WORK/final-summary.log" && FDFIX_PASSED=$((FDFIX_PASSED + 1))
printf 'FDFIX_SUMMARY=%s/5\n' "$FDFIX_PASSED"
test "$FDFIX_PASSED" -eq 5

if [[ -s "$WORK/base.log" ]]; then
  grep -E '^(FL_TEST_SUMMARY|TEST_EVIDENCE_SUMMARY|TCP_SUMMARY|HTTP_SUMMARY|AUDIT_SUMMARY|NATIVE_FORMS_SUMMARY|CGC_SYMBOL_SUMMARY|ERP_SUMMARY|ERP2_SUMMARY|ERP3_SUMMARY|CONC_SUMMARY|SEC_SUMMARY|AUTH_SUMMARY|PAGE_SUMMARY|NET2_SUMMARY|PW_SUMMARY|JWT_SUMMARY|STREAM_SUMMARY|JSONNUM_SUMMARY|PAR_SUMMARY|NAME_SUMMARY|WARN_SUMMARY|ABI_SUMMARY|BUILTIN2_SUMMARY|HOF_SUMMARY|OOM_SUMMARY|FORKFAIL_SUMMARY|STATIC_SUMMARY|TIMEOUT_SUMMARY|TIMEPREC_SUMMARY|HTTPATK_SUMMARY)=' "$WORK/base.log"
fi

MIXSOAK_DB="$WORK/cap.sqlite" FL_HTTP_PORT=0 \
  "$WORK/load-server" "$WORK/public" >"$WORK/cap-server.log" 2>&1 &
CAP_SERVER_PID=$!
cleanup_cap() {
  kill "$CAP_SERVER_PID" 2>/dev/null || true
  wait "$CAP_SERVER_PID" 2>/dev/null || true
}
trap cleanup_cap EXIT INT TERM
CAP_PORT=""
for _ in $(seq 1 100); do
  CAP_PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/cap-server.log" | head -n 1)"
  test -n "$CAP_PORT" && break
  kill -0 "$CAP_SERVER_PID"
  sleep 0.05
done
test -n "$CAP_PORT"
CAP_ZOMBIE_BEFORE="$(ps -o stat= --ppid "$CAP_SERVER_PID" 2>/dev/null | awk '$1 ~ /^Z/{n++} END{print n+0}' || true)"
"$WORK/load-client" "$CAP_PORT" 400 30 941 "$WORK/cap-acknowledged.sql" slow300 \
  >"$WORK/cap-client.log" 2>&1 &
CAP_CLIENT_PID=$!
while kill -0 "$CAP_CLIENT_PID" 2>/dev/null; do sleep 1; done
wait "$CAP_CLIENT_PID"
cat "$WORK/cap-client.log"
CAP_LINE="$(grep '^LOAD_STAGE ' "$WORK/cap-client.log")"
CAP_503="$(sed -n 's/.*status_503=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_RETRY_AFTER_MISSING="$(sed -n 's/.*retry_after_missing=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_OTHER_HTTP="$(sed -n 's/.*other_http=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_REFUSED="$(sed -n 's/.*connect_refused=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_TIMEOUT="$(sed -n 's/.*connect_timeout=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_CONNECT_OTHER="$(sed -n 's/.*connect_other=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_IO_ERRORS="$(sed -n 's/.*io_errors=\([0-9]*\).*/\1/p' <<<"$CAP_LINE")"
CAP_OTHER_ERRORS=$((CAP_OTHER_HTTP + CAP_REFUSED + CAP_TIMEOUT + CAP_CONNECT_OTHER + CAP_IO_ERRORS))
CAP_ALIVE=0
kill -0 "$CAP_SERVER_PID" 2>/dev/null && CAP_ALIVE=1
CAP_RECOVERY="$(curl --silent --max-time 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$CAP_PORT/ok" 2>/dev/null || echo 000)"
CAP_ZOMBIE_AFTER="$(ps -o stat= --ppid "$CAP_SERVER_PID" 2>/dev/null | awk '$1 ~ /^Z/{n++} END{print n+0}' || true)"
CAP_ZOMBIE_DELTA=$((CAP_ZOMBIE_AFTER - CAP_ZOMBIE_BEFORE))
kill "$CAP_SERVER_PID"
wait "$CAP_SERVER_PID" || true
trap - EXIT INT TERM
CAP_ACTIVE_MAX="$(sed -n 's/^HTTP_ACTIVE_CONNECTIONS_MAX=//p' "$WORK/cap-server.log" | tail -n 1)"
CAP_PASSED=0
[[ "$CAP_ACTIVE_MAX" =~ ^[0-9]+$ ]] && (( CAP_ACTIVE_MAX <= 256 )) && CAP_PASSED=$((CAP_PASSED + 1))
(( CAP_503 > 0 && CAP_RETRY_AFTER_MISSING == 0 )) && CAP_PASSED=$((CAP_PASSED + 1))
(( CAP_OTHER_ERRORS == 0 && CAP_OTHER_HTTP == 0 && CAP_REFUSED == 0 && CAP_TIMEOUT == 0 && CAP_CONNECT_OTHER == 0 && CAP_IO_ERRORS == 0 )) && CAP_PASSED=$((CAP_PASSED + 1))
(( CAP_ALIVE == 1 )) && CAP_PASSED=$((CAP_PASSED + 1))
[[ "$CAP_RECOVERY" == 200 ]] && CAP_PASSED=$((CAP_PASSED + 1))
(( CAP_ZOMBIE_DELTA == 0 && CAP_ZOMBIE_AFTER == 0 )) && CAP_PASSED=$((CAP_PASSED + 1))
printf 'CAP_ACTIVE_CONNECTIONS_MAX=%s\nCAP_503=%s\nCAP_RETRY_AFTER_MISSING=%s\nCAP_OTHER_ERRORS=%s\nCAP_SERVER_ALIVE=%s\nCAP_RECOVERY_HTTP=%s\nCAP_ZOMBIE_BEFORE=%s\nCAP_ZOMBIE_AFTER=%s\nCAP_ZOMBIE_DELTA=%s\n' \
  "$CAP_ACTIVE_MAX" "$CAP_503" "$CAP_RETRY_AFTER_MISSING" "$CAP_OTHER_ERRORS" "$CAP_ALIVE" "$CAP_RECOVERY" \
  "$CAP_ZOMBIE_BEFORE" "$CAP_ZOMBIE_AFTER" "$CAP_ZOMBIE_DELTA"
printf 'CAP_SUMMARY=%s/6\n' "$CAP_PASSED"
test "$CAP_PASSED" -eq 6
