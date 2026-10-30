# D-7 legacy DB lock

## D-7a 충돌 처리 기록

병합 대상: `db-stability` HEAD `c7e19161c56024dd4c8dc6682166fa1ad77a54cc` ← GitHub `master` `29c57e38b3bd014822cf33fe3df8c1815fee707e`.

### 양쪽 파일을 마지막으로 바꾼 커밋

| 측 | 커밋 | 날짜 | 제목 |
|---|---|---|---|
| db-stability | `ab9d37bc0ceeb88683803f08abed3f4df6fb25ed` | `2026-10-28T19:32:17+09:00` | `test: reuse isolated UID namespace during strace runs` |
| GitHub master | `78c5ed1b1bbd01bcc39f72c38dd8990c9e806296` | `2026-10-27T21:29:07+09:00` | `test: fail task 931 on missing overload responses` |

### db-stability 쪽 원문 전체: `tests/run-task931.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

if test -n "${DB_FORK_SNAPSHOT:-}"; then
  trap 'rc=$?; if test "$rc" -ne 0; then printf "D5_SCRIPT_FAILURE_TASKS=%s D5_SCRIPT_FAILURE_LIMIT=%s\n" "$(ps -u "$(id -u)" -L -o lwp= | wc -l | tr -d " ")" "${parallel_nproc_limit:-unknown}" >"$DB_FORK_SNAPSHOT.final.meta"; ps -u "$(id -u)" -L -o comm= | sed "s/^[[:space:]]*//" >"$DB_FORK_SNAPSHOT.final.names"; fi' EXIT
fi

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
fork_mode="${FL_FORK_LIMIT_MODE:-isolated}"
case "$fork_mode" in
  isolated|main) ;;
  *) printf 'FORK_MODE_ERROR=unsupported-mode:%s\n' "$fork_mode" >&2; exit 2 ;;
esac
printf 'PARALLEL_MODE=%s\n' "$fork_mode"
probe_link=()
if test "$fork_mode" = isolated || test -n "${DB_FORK_SNAPSHOT:-}"; then
  probe_link=("$ROOT/tests/db-fork-probe.c" -Wl,--wrap=fork)
fi
gcc -w -I "$RUNTIME" -o "$WORK/forkfail" "$WORK/forkfail.c" "${LINK[@]}" "${probe_link[@]}" -lsqlite3 -lcrypto -lm
if test "$fork_mode" = main; then
  parallel_user_processes="$(ps -u "$(id -u)" -o pid= | wc -l | tr -d ' ')"
  parallel_user_tasks="$(ps -u "$(id -u)" -L -o lwp= | wc -l | tr -d ' ')"
  if test -n "${DB_FORK_SNAPSHOT:-}"; then
    ps -u "$(id -u)" -L -o comm= | sed 's/^[[:space:]]*//' >"$DB_FORK_SNAPSHOT.baseline"
  fi
  # RLIMIT_NPROC counts tasks here; leave fewer than eight worker slots after setup.
  parallel_nproc_limit=$((parallel_user_tasks + 5))
  printf 'PARALLEL_USER_PROCESS_COUNT=%s\n' "$parallel_user_processes"
  printf 'PARALLEL_USER_TASK_COUNT=%s\n' "$parallel_user_tasks"
  printf 'PARALLEL_ULIMIT_U=%s\n' "$parallel_nproc_limit"
  set +e
  (ulimit -u "$parallel_nproc_limit"; printf 'PARALLEL_EFFECTIVE_ULIMIT_U='; ulimit -u; exec "$WORK/forkfail") >"$WORK/forkfail.out" 2>"$WORK/forkfail.err"
  parallel_rc=$?
  set -e
else
  if test -n "${FL_FORK_NAMESPACE_PID:-}"; then
    if ! command -v nsenter >/dev/null 2>&1; then
      printf 'SKIP_REASON=nsenter-command-missing\n' >&2
      exit 2
    fi
  elif ! command -v unshare >/dev/null 2>&1; then
    printf 'SKIP_REASON=unshare-command-missing\n' >&2
    exit 2
  fi
  set +e
  (
    isolated_bin_dir="$(mktemp -d /tmp/fl-task931-fork.XXXXXX)" || exit 2
    trap 'rm -rf -- "$isolated_bin_dir"' EXIT
    chmod 711 "$isolated_bin_dir" || exit 2
    cp "$WORK/forkfail" "$isolated_bin_dir/forkfail" || exit 2
    if test -n "${FL_FORK_NAMESPACE_PID:-}"; then
      DB_FORK_ISOLATED=1 nsenter --target "$FL_FORK_NAMESPACE_PID" --user --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
    else
      DB_FORK_ISOLATED=1 unshare --map-auto --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
    fi
  ) >"$WORK/forkfail.out" 2>"$WORK/forkfail.err"
  parallel_rc=$?
  set -e
  parallel_user_tasks="$(sed -n 's/^DB_FORK_MEASURED_TASKS=\([0-9]*\) DB_FORK_SET_LIMIT=.*/\1/p' "$WORK/forkfail.err" | head -n 1)"
  parallel_nproc_limit="$(sed -n 's/^DB_FORK_MEASURED_TASKS=[0-9]* DB_FORK_SET_LIMIT=\([0-9]*\)/\1/p' "$WORK/forkfail.err" | head -n 1)"
  parallel_user_processes="$(sed -n 's/^DB_FORK_MEASURED_PROCESSES=\([0-9]*\)$/\1/p' "$WORK/forkfail.err" | head -n 1)"
  if test -z "$parallel_user_tasks" || test -z "$parallel_nproc_limit" || test -z "$parallel_user_processes"; then
    printf 'SKIP_REASON=isolated-uid-or-limit-setup-failed\n' >&2
    head -n 1 "$WORK/forkfail.err" >&2 || true
    exit 2
  fi
  printf 'PARALLEL_USER_PROCESS_COUNT=%s\n' "$parallel_user_processes"
  printf 'PARALLEL_USER_TASK_COUNT=%s\n' "$parallel_user_tasks"
  printf 'PARALLEL_ULIMIT_U=%s\n' "$parallel_nproc_limit"
  printf 'PARALLEL_EFFECTIVE_ULIMIT_U=%s\n' "$parallel_nproc_limit" >>"$WORK/forkfail.out"
fi
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
test "$parallel_zombie_delta" -eq 0

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
  (if test -n "$limit"; then ulimit -u "$limit"; printf 'HTTP_EFFECTIVE_ULIMIT_U='; ulimit -u; fi; ulimit -n "$fd_limit"; export FL_HTTP_MAX_REQUESTS="$max"; exec "$WORK/oom-server") >"$work/server.log" 2>&1 &
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
test "$parallel_zombie_delta" -eq 0

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
parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
printf 'FORKFAIL_CASE=http-recovery FAILED_SLOTS=0 SUCCESSFUL_SLOTS=1 ERROR=none RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$server_rc" "$server_signal" "$parallel_zombie_delta"
test "$parallel_zombie_delta" -eq 0

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
```

### GitHub master 쪽 원문 전체: `tests/run-task931.sh`

```bash
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

wait_server_bounded() {
  local pid="$1" seconds="$2" state
  for _ in $(seq 1 "$((seconds * 10))"); do
    state="$(ps -o stat= -p "$pid" 2>/dev/null || true)"
    if [[ -z "$state" || "$state" == Z* ]]; then
      wait "$pid"
      return $?
    fi
    sleep 0.1
  done
  printf 'SERVER_WAIT_TIMEOUT pid=%s seconds=%s\n' "$pid" "$seconds"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  return 124
}

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
set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
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
set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
nofile_codes="$(cat "$WORK"/oom-nofile/codes/*)"
nofile_total="$(printf '%s\n' "$nofile_codes" | grep -Ec '^200$' || true)"
nofile_responses="$(printf '%s\n' "$nofile_codes" | grep -Ec '^(200|503)$' || true)"
server_error="$(grep -im1 -E 'error|failed' "$WORK/oom-nofile/server.log" || true)"
test -n "$server_error" || server_error=none
nofile_503="$(printf '%s\n' "$nofile_codes" | grep -Ec '^503$' || true)"
printf 'CASE=http-descriptor-limit-30-requests SERVER_RC=%s SIGNAL=%s ERROR=%s RESPONSES=%s/30 HTTP_200=%s HTTP_503=%s\n' "$server_rc" "$server_signal" "$server_error" "$nofile_responses" "$nofile_total" "$nofile_503"
if (( nofile_responses != 30 || nofile_503 == 0 )); then
  printf 'OOM_FAILURE=http-descriptor-limit expected_responses=30 expected_http_503_at_least=1\n' >&2
  exit 1
fi

start_server "$WORK/oom-recovery" "" 1 32
recovery_code="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$SERVER_PORT/")"
set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
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
zombie_raw_delta=$((zombies - baseline_zombies))
zombie_delta=$zombie_raw_delta
(( zombie_delta < 0 )) && zombie_delta=0
test_zombies="$(ps -eo ppid=,stat= | awk -v p="$$" '$1 == p && $2 ~ /^Z/ {n++} END {print n+0}')"
printf 'SEGV_COUNT=%s\n' "$segv_count"
printf 'ZOMBIE_COUNT=%s\n' "$zombies"
printf 'ZOMBIE_BASELINE=%s ZOMBIE_DELTA=%s ZOMBIE_RAW_DELTA=%s\n' "$baseline_zombies" "$zombie_delta" "$zombie_raw_delta"
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
```

### D-7a2 판정

두 쪽은 모두 `process-limit-run-parallel`에서 20개 슬롯 중 성공과 `E_RUN_PARALLEL_FORK` 실패가 섞여야 한다고 검사하지만, 검사 방식이 다릅니다. db-stability 쪽은 기본 격리 UID(또는 명시된 `main` 모드)에서 한 번 실행하고 측정·환경 정보를 확인합니다. GitHub master 쪽은 같은 UID에서 headroom 1부터 32까지 재시도해 혼합 결과를 선택합니다. 같은 항목의 서로 다른 검사이므로 지시서 a2에 따라 병합 충돌을 해결하지 않고 여기서 중단합니다.

`git merge-tree --write-tree HEAD origin/master` 결과: exit code `1`; 충돌 파일 `tests/run-task931.sh`. 병합 커밋을 만들지 않았고 충돌 시험을 실행하지 않았습니다. D-7 b~f는 미착수입니다.

## D-7b a1–a3 병합 해결 기록

D-7b 결정에 따라 두 검사 방식을 모두 보존했습니다. 격리 UID 또는 `main` 모드 검사는 `process-limit-run-parallel-isolated-or-main`으로, 같은 UID에서 headroom 1..32를 다시 시도하는 검사는 `process-limit-run-parallel-same-uid-headroom-retry`로 별도 출력합니다. 두 검사 각각 기존의 혼합 슬롯 조건(20개 중 성공·`E_RUN_PARALLEL_FORK` 실패가 모두 존재)을 유지하며, 실패하면 스크립트가 실패합니다. 격리 UID 준비를 못 하면 해당 검사에 `SKIP_REASON`/`ISOLATED_MAIN_SUMMARY=SKIP`를 출력하고 통과 수에 포함하지 않습니다. 같은 UID 검사는 계속 실행되며, skip은 최종 `FORKFAIL_SUMMARY`를 통과로 만들지 않습니다.

GitHub master 쪽의 서버 wait 제한도 보존했습니다. 병합 대상 경로는 `<가림>/tests/run-task931.sh`입니다.

### 해결 전후 diff 원문 (db-stability HEAD 기준)

```diff
diff --git <가림>/tests/run-task931.sh <가림>/tests/run-task931.sh
index 21446e46..db6ca7e9 100644
--- <가림>/tests/run-task931.sh
+++ <가림>/tests/run-task931.sh
@@ -15,6 +15,22 @@ SOURCES=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c d
 LINK=(); for source in "${SOURCES[@]}"; do LINK+=("$RUNTIME/$source"); done
 segv_count=0
 
+wait_server_bounded() {
+  local pid="$1" seconds="$2" state
+  for _ in $(seq 1 "$((seconds * 10))"); do
+    state="$(ps -o stat= -p "$pid" 2>/dev/null || true)"
+    if [[ -z "$state" || "$state" == Z* ]]; then
+      wait "$pid"
+      return $?
+    fi
+    sleep 0.1
+  done
+  printf 'SERVER_WAIT_TIMEOUT pid=%s seconds=%s\n' "$pid" "$seconds"
+  kill "$pid" 2>/dev/null || true
+  wait "$pid" 2>/dev/null || true
+  return 124
+}
+
 for mode in vector string json; do
   "$COMPILER" "$ROOT/tests/task931/memory.fl" "$WORK/oom-memory.c" >"$WORK/oom-memory.compile" 2>&1
   gcc -w -I "$RUNTIME" -o "$WORK/oom-memory" "$WORK/oom-memory.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm
@@ -60,57 +76,112 @@ if test "$fork_mode" = main; then
   parallel_rc=$?
   set -e
 else
+  isolated_skip_reason=""
   if test -n "${FL_FORK_NAMESPACE_PID:-}"; then
     if ! command -v nsenter >/dev/null 2>&1; then
-      printf 'SKIP_REASON=nsenter-command-missing\n' >&2
-      exit 2
+      isolated_skip_reason=nsenter-command-missing
     fi
   elif ! command -v unshare >/dev/null 2>&1; then
-    printf 'SKIP_REASON=unshare-command-missing\n' >&2
-    exit 2
+    isolated_skip_reason=unshare-command-missing
   fi
-  set +e
-  (
-    isolated_bin_dir="$(mktemp -d /tmp/fl-task931-fork.XXXXXX)" || exit 2
-    trap 'rm -rf -- "$isolated_bin_dir"' EXIT
-    chmod 711 "$isolated_bin_dir" || exit 2
-    cp "$WORK/forkfail" "$isolated_bin_dir/forkfail" || exit 2
-    if test -n "${FL_FORK_NAMESPACE_PID:-}"; then
-      DB_FORK_ISOLATED=1 nsenter --target "$FL_FORK_NAMESPACE_PID" --user --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
-    else
-      DB_FORK_ISOLATED=1 unshare --map-auto --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
+  if test -z "$isolated_skip_reason"; then
+    set +e
+    (
+      isolated_bin_dir="$(mktemp -d /tmp/fl-task931-fork.XXXXXX)" || exit 2
+      trap 'rm -rf -- "$isolated_bin_dir"' EXIT
+      chmod 711 "$isolated_bin_dir" || exit 2
+      cp "$WORK/forkfail" "$isolated_bin_dir/forkfail" || exit 2
+      if test -n "${FL_FORK_NAMESPACE_PID:-}"; then
+        DB_FORK_ISOLATED=1 nsenter --target "$FL_FORK_NAMESPACE_PID" --user --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
+      else
+        DB_FORK_ISOLATED=1 unshare --map-auto --setuid 1 --setgid 1 -- "$isolated_bin_dir/forkfail"
+      fi
+    ) >"$WORK/forkfail.out" 2>"$WORK/forkfail.err"
+    parallel_rc=$?
+    set -e
+    parallel_user_tasks="$(sed -n 's/^DB_FORK_MEASURED_TASKS=\([0-9]*\) DB_FORK_SET_LIMIT=.*/\1/p' "$WORK/forkfail.err" | head -n 1)"
+    parallel_nproc_limit="$(sed -n 's/^DB_FORK_MEASURED_TASKS=[0-9]* DB_FORK_SET_LIMIT=\([0-9]*\)/\1/p' "$WORK/forkfail.err" | head -n 1)"
+    parallel_user_processes="$(sed -n 's/^DB_FORK_MEASURED_PROCESSES=\([0-9]*\)$/\1/p' "$WORK/forkfail.err" | head -n 1)"
+    if test -z "$parallel_user_tasks" || test -z "$parallel_nproc_limit" || test -z "$parallel_user_processes"; then
+      isolated_skip_reason=isolated-uid-or-limit-setup-failed
+      head -n 1 "$WORK/forkfail.err" >&2 || true
     fi
-  ) >"$WORK/forkfail.out" 2>"$WORK/forkfail.err"
-  parallel_rc=$?
-  set -e
-  parallel_user_tasks="$(sed -n 's/^DB_FORK_MEASURED_TASKS=\([0-9]*\) DB_FORK_SET_LIMIT=.*/\1/p' "$WORK/forkfail.err" | head -n 1)"
-  parallel_nproc_limit="$(sed -n 's/^DB_FORK_MEASURED_TASKS=[0-9]* DB_FORK_SET_LIMIT=\([0-9]*\)/\1/p' "$WORK/forkfail.err" | head -n 1)"
-  parallel_user_processes="$(sed -n 's/^DB_FORK_MEASURED_PROCESSES=\([0-9]*\)$/\1/p' "$WORK/forkfail.err" | head -n 1)"
-  if test -z "$parallel_user_tasks" || test -z "$parallel_nproc_limit" || test -z "$parallel_user_processes"; then
-    printf 'SKIP_REASON=isolated-uid-or-limit-setup-failed\n' >&2
-    head -n 1 "$WORK/forkfail.err" >&2 || true
-    exit 2
   fi
-  printf 'PARALLEL_USER_PROCESS_COUNT=%s\n' "$parallel_user_processes"
-  printf 'PARALLEL_USER_TASK_COUNT=%s\n' "$parallel_user_tasks"
-  printf 'PARALLEL_ULIMIT_U=%s\n' "$parallel_nproc_limit"
-  printf 'PARALLEL_EFFECTIVE_ULIMIT_U=%s\n' "$parallel_nproc_limit" >>"$WORK/forkfail.out"
+  if test -n "$isolated_skip_reason"; then
+    printf 'CASE=process-limit-run-parallel-isolated SKIP_REASON=%s\n' "$isolated_skip_reason"
+    printf 'ISOLATED_MAIN_SUMMARY=SKIP reason=%s\n' "$isolated_skip_reason"
+    printf 'SKIP_REASON=%s\n' "$isolated_skip_reason"
+  else
+    printf 'PARALLEL_USER_PROCESS_COUNT=%s\n' "$parallel_user_processes"
+    printf 'PARALLEL_USER_TASK_COUNT=%s\n' "$parallel_user_tasks"
+    printf 'PARALLEL_ULIMIT_U=%s\n' "$parallel_nproc_limit"
+    printf 'PARALLEL_EFFECTIVE_ULIMIT_U=%s\n' "$parallel_nproc_limit" >>"$WORK/forkfail.out"
+  fi
+fi
+if test "$fork_mode" = main || test -z "${isolated_skip_reason:-}"; then
+  parallel_signal=0; test "$parallel_rc" -gt 128 && parallel_signal=$((parallel_rc - 128)) || true
+  test "$parallel_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
+  parallel_failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/forkfail.out" || true)"
+  parallel_succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/forkfail.out" || true)"
+  grep '^PARALLEL_EFFECTIVE_ULIMIT_U=' "$WORK/forkfail.out"
+  printf 'CASE=process-limit-run-parallel-isolated-or-main RC=%s SIGNAL=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK\n' "$parallel_rc" "$parallel_signal" "$parallel_failed" "$parallel_succeeded"
+  printf 'CASE=process-limit-run-parallel RC=%s SIGNAL=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK\n' "$parallel_rc" "$parallel_signal" "$parallel_failed" "$parallel_succeeded"
+  grep '^SLOT[0-9]*=' "$WORK/forkfail.out"
+  test "$parallel_rc" -eq 0 && test "$parallel_signal" -eq 0
+  test "$parallel_failed" -gt 0 && test "$parallel_succeeded" -gt 0
+  test $((parallel_failed + parallel_succeeded)) -eq 20
+  grep -Fxq 'PARALLEL_DONE' "$WORK/forkfail.out"
+  parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
+  parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
+  printf 'FORKFAIL_CASE=run-parallel FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$parallel_failed" "$parallel_succeeded" "$parallel_rc" "$parallel_signal" "$parallel_zombie_delta"
+  test "$parallel_zombie_delta" -eq 0
 fi
-parallel_signal=0; test "$parallel_rc" -gt 128 && parallel_signal=$((parallel_rc - 128)) || true
-test "$parallel_signal" -eq 11 && segv_count=$((segv_count + 1)) || true
-parallel_failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/forkfail.out" || true)"
-parallel_succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/forkfail.out" || true)"
-grep '^PARALLEL_EFFECTIVE_ULIMIT_U=' "$WORK/forkfail.out"
-printf 'CASE=process-limit-run-parallel RC=%s SIGNAL=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK\n' "$parallel_rc" "$parallel_signal" "$parallel_failed" "$parallel_succeeded"
-grep '^SLOT[0-9]*=' "$WORK/forkfail.out"
-test "$parallel_rc" -eq 0 && test "$parallel_signal" -eq 0
-test "$parallel_failed" -gt 0 && test "$parallel_succeeded" -gt 0
-test $((parallel_failed + parallel_succeeded)) -eq 20
-grep -Fxq 'PARALLEL_DONE' "$WORK/forkfail.out"
-parallel_zombies="$(ps -eo stat= | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
-parallel_zombie_delta=$((parallel_zombies - baseline_zombies))
-printf 'FORKFAIL_CASE=run-parallel FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK RC=%s SIGNAL=%s ZOMBIE_DELTA=%s\n' "$parallel_failed" "$parallel_succeeded" "$parallel_rc" "$parallel_signal" "$parallel_zombie_delta"
-test "$parallel_zombie_delta" -eq 0
+
+mkdir -p "$WORK/same-uid-headroom"
+set +e
+same_uid_selected=0
+same_uid_rc=1
+for headroom in $(seq 1 32); do
+  (
+    current_uid="$(id -u)"
+    same_uid_tasks="$(ps -u "$current_uid" -L -o lwp= | wc -l | tr -d ' ')"
+    same_uid_processes="$(ps -u "$current_uid" -o pid= | wc -l | tr -d ' ')"
+    same_uid_limit=$((same_uid_tasks + headroom))
+    printf '%s\n' "$same_uid_limit" >"$WORK/same-uid-headroom/limit"
+    printf '%s\n' "$same_uid_tasks" >"$WORK/same-uid-headroom/tasks"
+    printf '%s\n' "$same_uid_processes" >"$WORK/same-uid-headroom/processes"
+    ulimit -u "$same_uid_limit"
+    printf 'PARALLEL_EFFECTIVE_ULIMIT_U='; ulimit -u
+    exec "$WORK/forkfail"
+  ) >"$WORK/same-uid-headroom/attempt.out" 2>"$WORK/same-uid-headroom/attempt.err"
+  same_uid_rc=$?
+  same_uid_failed_try="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/same-uid-headroom/attempt.out" || true)"
+  same_uid_succeeded_try="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/same-uid-headroom/attempt.out" || true)"
+  if (( same_uid_failed_try > 0 && same_uid_succeeded_try > 0 )); then
+    mv "$WORK/same-uid-headroom/attempt.out" "$WORK/same-uid-headroom/forkfail.out"
+    mv "$WORK/same-uid-headroom/attempt.err" "$WORK/same-uid-headroom/forkfail.err"
+    same_uid_selected=1
+    break
+  fi
+done
+set -e
+test "$same_uid_selected" -eq 1
+same_uid_limit="$(cat "$WORK/same-uid-headroom/limit")"
+same_uid_tasks="$(cat "$WORK/same-uid-headroom/tasks")"
+same_uid_processes="$(cat "$WORK/same-uid-headroom/processes")"
+same_uid_signal=0; test "$same_uid_rc" -gt 128 && same_uid_signal=$((same_uid_rc - 128)) || true
+same_uid_failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/same-uid-headroom/forkfail.out" || true)"
+same_uid_succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/same-uid-headroom/forkfail.out" || true)"
+printf 'SAME_UID_HEADROOM_PROCESS_COUNT=%s\n' "$same_uid_processes"
+printf 'SAME_UID_HEADROOM_TASK_COUNT=%s\n' "$same_uid_tasks"
+printf 'SAME_UID_HEADROOM_ULIMIT_U=%s\n' "$same_uid_limit"
+printf 'CASE=process-limit-run-parallel-same-uid-headroom-retry RC=%s SIGNAL=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s ERROR=E_RUN_PARALLEL_FORK\n' "$same_uid_rc" "$same_uid_signal" "$same_uid_failed" "$same_uid_succeeded"
+grep '^SLOT[0-9]*=' "$WORK/same-uid-headroom/forkfail.out"
+test "$same_uid_rc" -eq 0 && test "$same_uid_signal" -eq 0
+test "$same_uid_failed" -gt 0 && test "$same_uid_succeeded" -gt 0
+test $((same_uid_failed + same_uid_succeeded)) -eq 20
+grep -Fxq 'PARALLEL_DONE' "$WORK/same-uid-headroom/forkfail.out"
+printf 'SAME_UID_HEADROOM_SUMMARY=PASS\n'
 
 "$COMPILER" "$ROOT/tests/task931/disk.fl" "$WORK/oom-disk.c" >"$WORK/oom-disk.compile" 2>&1
 gcc -w -I "$RUNTIME" -o "$WORK/oom-disk" "$WORK/oom-disk.c" "${LINK[@]}" -lsqlite3 -lcrypto -lm
@@ -155,7 +226,7 @@ gcc -w -I "$RUNTIME" -o "$WORK/oom-server" "$WORK/oom-server.c" "${LINK[@]}" -ls
 start_server() {
   local work="$1" limit="$2" max="$3" fd_limit="$4"
   mkdir -p "$work"
-  (if test -n "$limit"; then ulimit -u "$limit"; printf 'HTTP_EFFECTIVE_ULIMIT_U='; ulimit -u; fi; ulimit -n "$fd_limit"; export FL_HTTP_MAX_REQUESTS="$max"; exec "$WORK/oom-server") >"$work/server.log" 2>&1 &
+  (if test -n "$limit"; then ulimit -u "$limit"; printf 'HTTP_EFFECTIVE_ULIMIT_U='; ulimit -u; fi; ulimit -n "$fd_limit"; export FL_HTTP_MAX_REQUESTS="$max" FL_HTTP_WORKERS=0; exec "$WORK/oom-server") >"$work/server.log" 2>&1 &
   SERVER_PID=$!
   for _ in $(seq 1 100); do
     if grep -q '^HTTP_LISTENING=' "$work/server.log"; then break; fi
@@ -177,7 +248,7 @@ for i in $(seq 1 30); do
   CURL_PIDS+=("$!")
 done
 for pid in "${CURL_PIDS[@]}"; do wait "$pid" || true; done
-set +e; wait "$SERVER_PID"; server_rc=$?; set -e
+set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
 server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
 nproc_codes="$(cat "$WORK"/oom-nproc/codes/*)"
 nproc_total="$(printf '%s\n' "$nproc_codes" | grep -Ec '^(200|503)$' || true)"
@@ -199,7 +270,7 @@ for i in $(seq 1 30); do
   CURL_PIDS+=("$!")
 done
 for pid in "${CURL_PIDS[@]}"; do wait "$pid" || true; done
-set +e; wait "$SERVER_PID"; server_rc=$?; set -e
+set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
 server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
 nofile_codes="$(cat "$WORK"/oom-nofile/codes/*)"
 nofile_total="$(printf '%s\n' "$nofile_codes" | grep -Ec '^200$' || true)"
@@ -212,7 +283,7 @@ test "$nofile_responses" -eq 30 && test "$nofile_503" -gt 0
 
 start_server "$WORK/oom-recovery" "" 1 32
 recovery_code="$(curl --silent --show-error --max-time 5 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$SERVER_PORT/")"
-set +e; wait "$SERVER_PID"; server_rc=$?; set -e
+set +e; wait_server_bounded "$SERVER_PID" 10; server_rc=$?; set -e
 server_signal=0; test "$server_rc" -gt 128 && server_signal=$((server_rc - 128)) || true
 server_error="$(grep -im1 -E 'error|failed' "$WORK/oom-recovery/server.log" || true)"
 test -n "$server_error" || server_error=none
@@ -237,6 +308,10 @@ test "$segv_count" -eq 0 && test "$zombie_delta" -eq 0 && test "$test_zombies" -
 printf 'OOM_SUMMARY=%s/12\n' "$passed"
 
 # Global zombies may predate this test; compare the baseline and count only zombies parented by this test.
+if test -n "${isolated_skip_reason:-}"; then
+  printf 'FORKFAIL_SUMMARY=SKIP/9 reason=%s\n' "$isolated_skip_reason"
+  exit 2
+fi
 forkfail_passed=0
 test "$parallel_user_processes" -gt 0 && forkfail_passed=$((forkfail_passed + 1))
 test "$parallel_nproc_limit" -gt "$parallel_user_tasks" && forkfail_passed=$((forkfail_passed + 1))
```

### a3 결과

```text
6e7d42ab31e4a908ea29648447f5392ca3d9699d Merge GitHub master into db-stability for D-7
parent 1: c7e19161c56024dd4c8dc6682166fa1ad77a54cc
parent 2: 29c57e38b3bd014822cf33fe3df8c1815fee707e
```

`tests/run-task931.sh`만 충돌했다. 해결 전후 원문 diff는 위에 기록했다. `bash -n tests/run-task931.sh` 종료 코드는 `0`이었다.

### a4. run-task931.sh 1회 실행

실행 위치: `<가림>`.

```text
<가림>/oom-memory.c:24:466: error: implicit declaration of function ‘throw’ [-Wimplicit-function-declaration]
<가림>/oom-memory.c:24:464: error: type mismatch in conditional expression
RUN_TASK931_RC=1
```

직접 1회 실행은 seed compiler로 시작했고 C 출력이 gcc에서 실패해 process-limit 검사 두 개에 도달하지 못했다. 전체 시험의 stage2 compiler 실행 결과로 두 검사 각각을 확인했다.

```text
CASE=process-limit-run-parallel-isolated SKIP_REASON=isolated-uid-or-limit-setup-failed
ISOLATED_MAIN_SUMMARY=SKIP reason=isolated-uid-or-limit-setup-failed
CASE=process-limit-run-parallel-same-uid-headroom-retry RC=0 SIGNAL=0 FAILED_SLOTS=16 SUCCESSFUL_SLOTS=4 ERROR=E_RUN_PARALLEL_FORK
CASE=http-descriptor-limit-30-requests SERVER_RC=0 SIGNAL=0 ERROR=none RESPONSES=30/30 HTTP_200=0 HTTP_503=30
OOM_SUMMARY=12/12
FORKFAIL_SUMMARY=SKIP/9 reason=isolated-uid-or-limit-setup-failed
```

다른 same-UID 표본은 `FAILED_SLOTS=10 SUCCESSFUL_SLOTS=10`, `FAILED_SLOTS=18 SUCCESSFUL_SLOTS=2`였다. 세 표본 모두 `RC=0`, `SIGNAL=0`이고 합계 20이다. 격리 검사 skip을 통과로 세지 않아 `FORKFAIL_SUMMARY=9/9`는 아니다.

### b. legacy와 pool DB 사용 방식

| 항목 | legacy | pool | 근거 |
|---|---|---|---|
| open flags | `SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX` | 동일 | `runtime/db.c:38-42` |
| busy timeout | `sqlite3_busy_timeout(db, 30000)` | 동일 | `runtime/db.c:50` |
| journal/write | 최초 open에서 `PRAGMA journal_mode = WAL`, 실패 시 `DELETE` fallback | 동일한 open 함수 | `runtime/db.c:52-76` |
| fork 후 연결 | PID 변경 시 child에서 path로 재개방, `configure_wal=false`; WAL은 파일에 유지 | pool child도 같은 PID 재개방 | `runtime/db.c:87-114` |
| 요청 처리 | accept 뒤 요청별 fork, 처리 후 child 종료 | worker가 accept/처리를 반복하고 종료 시 교체 | `runtime/http_server.c:219-240, 299-329, 1347-1361` |
| 연결 수 | server cap `256`; parent 및 동시 요청 child가 연결 보유 가능 | parent와 pool worker별 연결 재사용 | `tests/task936/soak-server.fl:41`; `runtime/http_server.c:1340-1361` |

실제 연결 수는 동시 요청량과 제한에 달린다. 연결 수 문장은 소스 구조에서 도출한 추론이다. open flags, 30초 busy timeout, WAL 구성에서 legacy/pool 차이는 확인되지 않았다.

### c-d. 기존 실패 시험과 세 차례 측정

실패 검출 시험의 마지막 변경은 DB 소스 변경보다 앞선 커밋이다.

```text
826af7930a7400b14b67794e2c675de61e4efb3a 2026-10-29T20:53:13+09:00 test: use about route for liveness probes
```

DB 구현은 수정하지 않았다. 세 번의 `run-task942-all.sh`에서 legacy `LOAD_DATABASE_IS_LOCKED=0`이었고, pool 단독 2회와 trial 3 pool 실행도 lock은 0이었다.

```text
trial 1 legacy: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=9/10 FDFIX_SUMMARY=4/5 LOAD_RESOURCE_STABLE=0
trial 2 legacy: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=9/10 FDFIX_SUMMARY=4/5 LOAD_RESOURCE_STABLE=0
trial 3 legacy: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=10/10 FDFIX_SUMMARY=5/5 LOAD_RESOURCE_STABLE=1
trial 3 pool: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=10/10 FDFIX_SUMMARY=5/5 POOL_SUMMARY=8/8 TASK942_ALL=PASS
pool standalone trial 1: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=10/10 FDFIX_SUMMARY=5/5 POOL_SUMMARY=8/8
pool standalone trial 2: LOAD_DATABASE_IS_LOCKED=0 LOAD2_SUMMARY=10/10 FDFIX_SUMMARY=5/5 POOL_SUMMARY=8/8
```

첫 두 legacy `LOAD2_SUMMARY=9/10`은 `LOAD_RESOURCE_STABLE=0`이었다. lock 카운터는 모두 0이어서 이번에는 lock 오류를 재현하지 못했고 DB 수정 근거가 없었다.

### e. 전체 빠른 시험·고정점·분류

실행 위치: `<가림>`. 전체 시험은 실행 전 `ACTIVE_DB_OR_LOAD_TESTS=0`, `ACTIVE_BUILD_PROCESSES=0`을 확인하고 `flock -o /tmp/fl-heavy.lock` 및 `strace -f -e trace=execve` 아래 1회 실행했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>/bin/cgc-bin-x86_64-seed-v11
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage2.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage3.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
FULL_CHECK_RC=1
FULL_FAST_RC=1
LOAD2_SUMMARY=10/10
TASK942_LEGACY_RC=1
TASK942_POOL_RC=2
TASK946_FAST_SUMMARY=0/2
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
CGC_SYMBOL_RC=0
ABI_SUMMARY=8/8
TASK920_RC=0
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
NPX_EXEC_COUNT=0
JS_EXEC_COUNT=0
PYTHON_EXEC_COUNT=0
TRACE_EXECVE_LINES=68353
```

legacy/pool run-task931은 격리 UID 검사가 `SKIP`이어서 `FORKFAIL_SUMMARY=SKIP/9`로 실패했다. 이는 격리 UID/namespace가 준비되지 않은 시험 환경 실패다. `docs/9-53-fdlimit-gcc.md`는 fd-limit 시험에서 다음 결과를 5회 기록했다.

```text
FDFIX_CASE=fd-limit RC=1 ERROR=db-exec: unable to open database file (sqlite=14)
EMFILE_EVENTS=4
```

이 fd-limit 결과는 시험 환경의 파일 descriptor 한도 항목으로 분류한다. 이번 full pool 부하 원문은 다음과 같다.

```text
POOL_BENCH workers=16 route=ok LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=62.068 requests=19845 rps=319.73 p50_ms=3071.766 p99_ms=4097.875 max_ms=5183.637 errors=15153 error_pct=76.357 connect_refused=0 connect_timeout=14 connect_other=0 io_errors=15139 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=15139 recv_other=0 incomplete_response=0 invalid_status=15139 route_counts=ok:19845,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:15153,200:4692
POOL_BENCH workers=16 route=mixed LOAD_STAGE stage=948 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.442 requests=26972 rps=438.98 p50_ms=2243.895 p99_ms=2933.634 max_ms=3426.162 errors=225 error_pct=0.834 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=225 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=5173 send_timeout=0 send_other=0 recv_timeout=225 recv_other=0 incomplete_response=0 invalid_status=225 route_counts=ok:5390,static:5392,jwt:5396,read:5396,write:5398,slow300:0 status_codes=0:225,200:26747
```

`TASK942_POOL_RC=2` 및 `TASK946_FAST_SUMMARY=0/2`는 통과가 아니다. 16-worker 요청 손실 원인은 이 실행에서 더 추적하지 않아 미확인이다. lock 카운터는 0이었다.

### D-7b 판정

- 충돌 파일 양쪽 검사 방식을 모두 보존했다. 격리 UID 검사 skip은 pass로 세지 않는다.
- 관측한 여섯 lock 집계 모두 `LOAD_DATABASE_IS_LOCKED=0`; lock 실패는 재현되지 않아 DB 구현 변경은 하지 않았다.
- 전체 빠른 시험은 실패했다. namespace 및 fd-limit은 시험 환경 항목, 16-worker pool 오류 원인은 미확인이다.
- 실행 위치: `<가림>`.
