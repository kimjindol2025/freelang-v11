#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-db-fork-main.sh <compiler> <empty-temp-dir>}"
WORK="${2:?usage: run-db-fork-main.sh <compiler> <empty-temp-dir>}"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"
R="$ROOT/runtime"
"$COMPILER" "$ROOT/tests/task932/forkfail.fl" "$WORK/forkfail.c" >"$WORK/compile.log" 2>&1
gcc -w -I "$R" -o "$WORK/forkfail" "$WORK/forkfail.c" \
  "$R/core.c" "$R/collection.c" "$R/io.c" "$R/math.c" "$R/error.c" \
  "$R/process.c" "$R/json.c" "$R/cgc-bridge.c" "$R/db.c" \
  "$R/http_server.c" "$R/auth.c" "$ROOT/tests/db-fork-probe.c" \
  -lsqlite3 -lcrypto -lm -Wl,--wrap=fork

passed=0
for i in $(seq 1 20); do
  user_processes="$(ps -u "$(id -u)" -o pid= | wc -l | tr -d ' ')"
  user_tasks="$(ps -u "$(id -u)" -L -o lwp= | wc -l | tr -d ' ')"
  limit=$((user_tasks + 5))
  rc=0
  (ulimit -u "$limit"; printf 'PARALLEL_EFFECTIVE_ULIMIT_U='; ulimit -u; exec "$WORK/forkfail") \
    >"$WORK/run-$i.out" 2>"$WORK/run-$i.err" || rc=$?
  failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/run-$i.out" || true)"
  succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/run-$i.out" || true)"
  first_fork="$(rg -m1 '^DB_FORK_PRE_TASKS=' "$WORK/run-$i.err" || true)"
  first_failure="$(rg -m1 'DB_FORK_RESULT=fail' "$WORK/run-$i.err" || true)"
  verdict=FAIL
  if test "$rc" -eq 0 && test "$failed" -gt 0 && test "$succeeded" -gt 0 &&
     test $((failed + succeeded)) -eq 20 && grep -Fxq 'PARALLEL_DONE' "$WORK/run-$i.out"; then
    verdict=PASS
    passed=$((passed + 1))
  fi
  printf 'D4_MAIN_RUN=%s VERDICT=%s RC=%s USER_PROCESSES=%s USER_TASKS=%s LIMIT=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s FIRST_FORK="%s" FIRST_FAILURE="%s"\n' \
    "$i" "$verdict" "$rc" "$user_processes" "$user_tasks" "$limit" \
    "$failed" "$succeeded" "$first_fork" "$first_failure"
done
printf 'D4_MAIN_PASS=%s/20\n' "$passed"
printf 'D4_MAIN_FAIL=%s/20\n' "$((20 - passed))"
