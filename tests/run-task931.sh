#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task931.sh <compiler> <work-dir>}"
WORK="${2:?usage: run-task931.sh <compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"
baseline_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
SOURCES=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
LINK=(); for source in "${SOURCES[@]}"; do LINK+=("$RUNTIME/$source"); done
segv_count=0

for mode in vector string json; do
  "$COMPILER" "$ROOT/tests/task931/memory.fl" "$WORK/oom-memory.c" >"$WORK/oom-memory.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$WORK/oom-memory" "$WORK/oom-memory.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm
  set +e
  limit=32768
  test "$mode" = string && limit=24576 || true
  test "$mode" = json && limit=49152 || true
  (ulimit -v "$limit"; exec "$WORK/oom-memory" "$mode") >"$WORK/oom-$mode.out" 2>"$WORK/oom-$mode.err"
  rc=$?
  set -e
  signal=0; test "$rc" -gt 128 && signal=$((rc - 128)) || true
  test "$signal" -eq 11 && segv_count=$((segv_count + 1)) || true
  error="$(head -n 1 "$WORK/oom-$mode.err" || true)"
  printf 'CASE=%s RC=%s SIGNAL=%s ERROR=%s\n' "$mode" "$rc" "$signal" "$error"
  test "$rc" -eq 71 && grep -Fxq 'FreeLang runtime: out of memory' "$WORK/oom-$mode.err"
done

"$COMPILER" "$ROOT/tests/task932/forkfail.fl" "$WORK/forkfail.c" >"$WORK/forkfail.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/forkfail" "$WORK/forkfail.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm
set +e
parallel_rc=1
parallel_selected=0
for headroom in $(seq 1 32); do
  (
    current_uid="$(id -u)"
    tasks_now="$(ps -u "$current_uid" -L -o lwp= | wc -l | tr -d ' ')"
    processes_now="$(ps -u "$current_uid" -o pid= | wc -l | tr -d ' ')"
    parallel_nproc_limit=$((tasks_now + headroom))
    printf '%s\n' "$parallel_nproc_limit" >"$WORK/parallel-nproc-limit"
    printf '%s\n' "$tasks_now" >"$WORK/parallel-user-tasks"
    printf '%s\n' "$processes_now" >"$WORK/parallel-user-processes"
    ulimit -u "$parallel_nproc_limit"
    printf 'PARALLEL_EFFECTIVE_ULIMIT_U='; ulimit -u
    exec "$WORK/forkfail"
  ) >"$WORK/forkfail-attempt.out" 2>"$WORK/forkfail-attempt.err"
  parallel_rc=$?
  parallel_failed_try="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/forkfail-attempt.out" || true)"
  parallel_succeeded_try="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/forkfail-attempt.out" || true)"
  if (( parallel_failed_try > 0 && parallel_succeeded_try > 0 )); then
    mv "$WORK/forkfail-attempt.out" "$WORK/forkfail.out"
    mv "$WORK/forkfail-attempt.err" "$WORK/forkfail.err"
    parallel_selected=1
    break
  fi
done
set -e
test "$parallel_selected" -eq 1
parallel_nproc_limit="$(cat "$WORK/parallel-nproc-limit")"
parallel_user_tasks="$(cat "$WORK/parallel-user-tasks")"
parallel_user_processes="$(cat "$WORK/parallel-user-processes")"
printf 'PARALLEL_USER_PROCESS_COUNT=%s\n' "$parallel_user_processes"
printf 'PARALLEL_USER_TASK_COUNT=%s\n' "$parallel_user_tasks"
printf 'PARALLEL_ULIMIT_U=%s\n' "$parallel_nproc_limit"
parallel_signal=0; test "$parallel_rc" -gt 128 && parallel_signal=$((parallel_rc - 128)) || true
test "$parallel_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
parallel_failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/forkfail.out" || true)"
parallel_succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/forkfail.out" || true)"
grep '^PARALLEL_EFFECTIVE_ULIMIT_U=' "$WORK/forkfail.out"
printf 'CASE=process-limit-run-parallel RC=%s SIGNAL=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK\n' "$parallel_rc" "$parallel_signal" "$parallel_failed" "$parallel_succeeded"
grep '^SLOT[0-9]*=' "$WORK/forkfail.out"
test "$parallel_rc" -eq 0 && test "$parallel_signal" -eq 0
test "$parallel_failed" -gt 0 && test "$parallel_succeeded" -gt 0
test $((parallel_failed + parallel_succeeded)) -eq 20
grep -Fxq 'PARALLEL_DONE' "$WORK/forkfail.out"
parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
printf 'FORKFAIL_CASE=run-parallel FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$parallel_failed" "$parallel_succeeded" "$parallel_rc" "$parallel_signal" "$parallel_zombie_delta"

"$COMPILER" "$ROOT/tests/task931/disk.fl" "$WORK/oom-disk.c" >"$WORK/oom-disk.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/oom-disk" "$WORK/oom-disk.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm
set +e
(ulimit -f 8; exec "$WORK/oom-disk" file "$WORK/limited-file") >"$WORK/oom-file.out" 2>"$WORK/oom-file.err"
file_rc=$?
set -e
file_signal=0; test "$file_rc" -gt 128 && file_signal=$((file_rc - 128)) || true
test "$file_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
printf 'CASE=file-size-limit RC=%s SIGNAL=%s ERROR=%s\n' "$file_rc" "$file_signal" "$(grep -m1 -o 'file-write-failed' "$WORK/oom-file.err" || head -n 1 "$WORK/oom-file.err" || true)"
test "$file_rc" -eq 1 && grep -q 'file-write-failed' "$WORK/oom-file.err"

sqlite3 "$WORK/limited.sqlite" 'CREATE TABLE payload(value TEXT);'
set +e
(ulimit -f 8; exec "$WORK/oom-disk" db "$WORK/limited.sqlite") >"$WORK/oom-dbwrite.out" 2>"$WORK/oom-dbwrite.err"
db_rc=$?
set -e
db_signal=0; test "$db_rc" -gt 128 && db_signal=$((db_rc - 128)) || true
test "$db_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
printf 'CASE=sqlite-file-size-limit RC=%s SIGNAL=%s ERROR=%s\n' "$db_rc" "$db_signal" "$(grep -m1 -o 'db-exec: .*' "$WORK/oom-dbwrite.err" || head -n 1 "$WORK/oom-dbwrite.err" || true)"
test "$db_rc" -eq 1 && grep -q 'db-exec:' "$WORK/oom-dbwrite.err"

sqlite3 "$WORK/fd-limit.sqlite" 'CREATE TABLE payload(value TEXT);'
set +e
(ulimit -n 4; exec "$WORK/oom-disk" db "$WORK/fd-limit.sqlite") >"$WORK/oom-fd.out" 2>"$WORK/oom-fd.err"
fd_rc=$?
set -e
fd_signal=0; test "$fd_rc" -gt 128 && fd_signal=$((fd_rc - 128)) || true
test "$fd_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
printf 'CASE=file-descriptor-limit-sqlite RC=%s SIGNAL=%s ERROR=%s\n' "$fd_rc" "$fd_signal" "$(grep -m1 -o 'db-exec: .*' "$WORK/oom-fd.err" || head -n 1 "$WORK/oom-fd.err" || true)"
test "$fd_rc" -eq 1 && grep -q 'db-exec:' "$WORK/oom-fd.err"

sqlite_integrity="$(sqlite3 "$WORK/limited.sqlite" 'PRAGMA integrity_check;')"
sqlite_rows="$(sqlite3 "$WORK/limited.sqlite" 'SELECT count(*) FROM payload;')"
printf 'SQLITE_INTEGRITY_CHECK=%s\n' "$sqlite_integrity"
printf 'SQLITE_ROWS_AFTER_FAILED_WRITE=%s\n' "$sqlite_rows"
test "$sqlite_integrity" = ok && test "$sqlite_rows" = 0

"$COMPILER" "$ROOT/tests/task931/server.fl" "$WORK/oom-server.c" >"$WORK/oom-server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/oom-server" "$WORK/oom-server.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm

start_server() {
  local work="$1" limit="$2" max="$3" fd_limit="$4"
  mkdir -p "$work"
  (if test -n "$limit"; then ulimit -u "$limit"; printf 'HTTP_EFFECTIVE_ULIMIT_U='; ulimit -u; fi; ulimit -n "$fd_limit"; export FL_HTTP_MAX_REQUESTS="$max" FL_HTTP_WORKERS=0; exec "$WORK/oom-server") >"$work/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 100); do
    if grep -q '^HTTP_LISTENING=' "$work/server.log"; then break; fi
    sleep 0.02
  done
  SERVER_PORT="$(sed -n 's/^HTTP_LISTENING=127.0.0.1://p' "$work/server.log" | head -n 1)"
  test -n "$SERVER_PORT"
}

http_user_processes="$(ps -u "$(id -u)" -o pid= | wc -l | tr -d ' ')"
printf 'HTTP_USER_PROCESS_COUNT=%s\n' "$http_user_processes"
printf 'HTTP_ULIMIT_U=1\n'
start_server "$WORK/oom-nproc" 1 30 32
grep '^HTTP_EFFECTIVE_ULIMIT_U=' "$WORK/oom-nproc/server.log"
mkdir -p "$WORK/oom-nproc/codes"
CURL_PIDS=()
for i in $(seq 1 30); do
  curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}\n' "http://127.0.0.1:$SERVER_PORT/" >"$WORK/oom-nproc/codes/$i" 2>/dev/null &
  CURL_PIDS+=("$!")
done
for pid in "${CURL_PIDS[@]}"; do wait "$pid" || true; done
set +e; wait "$SERVER_PID"; server_rc=$?; set -e
server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
nproc_codes="$(cat "$WORK"/oom-nproc/codes/*)"
nproc_total="$(printf '%s\n' "$nproc_codes" | grep -Ec '^(200|503)$' || true)"
nproc_503="$(printf '%s\n' "$nproc_codes" | grep -Ec '^503$' || true)"
server_error="$(grep -im1 -E 'error|failed' "$WORK/oom-nproc/server.log" || true)"
test -n "$server_error" || server_error=none
printf 'CASE=http-process-limit-30-requests SERVER_RC=%s SIGNAL=%s ERROR=%s RESPONSES=%s/30 HTTP_503=%s\n' "$server_rc" "$server_signal" "$server_error" "$nproc_total" "$nproc_503"
test "$nproc_total" -eq 30 && test "$nproc_503" -gt 0
parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
printf 'FORKFAIL_CASE=http-process-limit FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=HTTP_503 RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$nproc_503" "$((nproc_total - nproc_503))" "$server_rc" "$server_signal" "$parallel_zombie_delta"

start_server "$WORK/oom-nofile" 64 30 5
mkdir -p "$WORK/oom-nofile/codes"
CURL_PIDS=()
for i in $(seq 1 30); do
  curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}\n' "http://127.0.0.1:$SERVER_PORT/" >"$WORK/oom-nofile/codes/$i" 2>/dev/null &
  CURL_PIDS+=("$!")
done
for pid in "${CURL_PIDS[@]}"; do wait "$pid" || true; done
set +e; wait "$SERVER_PID"; server_rc=$?; set -e
server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
nofile_codes="$(cat "$WORK"/oom-nofile/codes/*)"
nofile_total="$(printf '%s\n' "$nofile_codes" | grep -Ec '^200$' || true)"
nofile_responses="$(printf '%s\n' "$nofile_codes" | grep -Ec '^(200|503)$' || true)"
server_error="$(grep -im1 -E 'error|failed' "$WORK/oom-nofile/server.log" || true)"
test -n "$server_error" || server_error=none
nofile_503="$(printf '%s\n' "$nofile_codes" | grep -Ec '^503$' || true)"
printf 'CASE=http-descriptor-limit-30-requests SERVER_RC=%s SIGNAL=%s ERROR=%s RESPONSES=%s/30 HTTP_200=%s HTTP_503=%s\n' "$server_rc" "$server_signal" "$server_error" "$nofile_responses" "$nofile_total" "$nofile_503"
test "$nofile_responses" -eq 30 && test "$nofile_503" -gt 0

start_server "$WORK/oom-recovery" "" 1 32
recovery_code="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$SERVER_PORT/")"
set +e; wait "$SERVER_PID"; server_rc=$?; set -e
server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
server_error="$(grep -im1 -E 'error|failed' "$WORK/oom-recovery/server.log" || true)"
test -n "$server_error" || server_error=none
printf 'CASE=http-recovery SERVER_RC=%s SIGNAL=%s ERROR=%s HTTP_STATUS=%s\n' "$server_rc" "$server_signal" "$server_error" "$recovery_code"
test "$recovery_code" = 200
sleep 0.2
parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
printf 'FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$server_rc" "$server_signal" "$parallel_zombie_delta"

zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
zombie_delta=$((zombies - baseline_zombies))
test_zombies="$(ps -eo ppid=,stat= | awk -v p="$$" '$1 == p && $2 ~ /^Z/ {n++} END {print n+0}')"
printf 'SEGV_COUNT=%s\n' "$segv_count"
printf 'ZOMBIE_COUNT=%s\n' "$zombies"
printf 'ZOMBIE_BASELINE=%s ZOMBIE_DELTA=%s\n' "$baseline_zombies" "$zombie_delta"
printf 'TEST_PARENT_ZOMBIE_COUNT=%s\n' "$test_zombies"
printf 'ZOMBIE_PS_RAW_BEGIN\n'; ps -eo pid,ppid,stat,comm | awk 'NR==1 || $3 ~ /^Z/'; printf 'ZOMBIE_PS_RAW_END\n'
passed=11
test "$zombie_delta" -eq 0 && test "$test_zombies" -eq 0 && passed=12 || true
test "$segv_count" -eq 0 && test "$zombie_delta" -eq 0 && test "$test_zombies" -eq 0
printf 'OOM_SUMMARY=%s/12\n' "$passed"

# Global zombies may predate this test; compare the baseline and count only zombies parented by this test.
forkfail_passed=0
test "$parallel_user_processes" -gt 0 && forkfail_passed=$((forkfail_passed + 1))
test "$parallel_nproc_limit" -gt "$parallel_user_tasks" && forkfail_passed=$((forkfail_passed + 1))
test "$parallel_failed" -gt 0 && forkfail_passed=$((forkfail_passed + 1))
test "$parallel_succeeded" -gt 0 && forkfail_passed=$((forkfail_passed + 1))
test $((parallel_failed + parallel_succeeded)) -eq 20 && forkfail_passed=$((forkfail_passed + 1))
test "$parallel_rc" -eq 0 && test "$parallel_signal" -eq 0 && forkfail_passed=$((forkfail_passed + 1))
test "$nproc_total" -eq 30 && test "$nproc_503" -gt 0 && forkfail_passed=$((forkfail_passed + 1))
test "$recovery_code" = 200 && forkfail_passed=$((forkfail_passed + 1))
test "$zombie_delta" -eq 0 && test "$test_zombies" -eq 0 && forkfail_passed=$((forkfail_passed + 1))
printf 'FORKFAIL_SUMMARY=%s/9\n' "$forkfail_passed"
test "$forkfail_passed" -eq 9
