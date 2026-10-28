#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-db-fork-cause.sh <compiler> <empty-work-dir>}"
WORK="${2:?usage: run-db-fork-cause.sh <compiler> <empty-work-dir>}"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"
chmod 711 "$WORK"

main_pass=0
for i in $(seq 1 50); do
  run="$WORK/main-$i"
  mkdir -p "$run"
  rc=0
  DB_FORK_SNAPSHOT="$run/names" bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$run/test" >"$run/out" 2>&1 || rc=$?
  verdict=FAIL
  if test "$rc" -eq 0 && grep -Fxq 'FORKFAIL_SUMMARY=9/9' "$run/out"; then
    verdict=PASS
    main_pass=$((main_pass + 1))
  fi
  printf 'D5_MAIN_RUN=%s VERDICT=%s RC=%s\n' "$i" "$verdict" "$rc"
  if test "$verdict" = FAIL; then
    task_count="$(sed -n 's/^PARALLEL_USER_TASK_COUNT=//p' "$run/out" | head -n 1)"
    limit="$(sed -n 's/^PARALLEL_ULIMIT_U=//p' "$run/out" | head -n 1)"
    first_failure="$(grep -m1 'DB_FORK_RESULT=fail' "$run/test/forkfail.err" || true)"
    top=none
    if test -s "$run/names" && test -s "$run/names.baseline"; then
      top="$(awk 'NR==FNR {base[$0]++; next} {now[$0]++} END {for (name in now) if (name != "forkfail" && now[name] > base[name]) print name, now[name]-base[name]}' "$run/names.baseline" "$run/names" | sort -k2,2nr -k1,1 | head -n 5 | awk '{printf "%s%s:%s", (NR==1 ? "" : ","), $1, $2} END {print ""}')"
      top="${top:-none}"
    fi
    printf 'D5_MAIN_FAILURE=%s BASE_TASKS=%s LIMIT=%s %s OTHER_TOP5=%s\n' "$i" "${task_count:-unknown}" "${limit:-unknown}" "${first_failure:-none}" "$top"
  fi
done
printf 'D5_MAIN_PASS=%s/50\nD5_MAIN_FAIL=%s/50\n' "$main_pass" "$((50 - main_pass))"

bin="$WORK/isolated-bin"
mkdir -m 711 "$bin"
runtime="$ROOT/runtime"
"$COMPILER" "$ROOT/tests/task932/forkfail.fl" "$bin/forkfail.c" >"$WORK/isolated-compile.log" 2>&1
gcc -w -I "$runtime" -o "$bin/forkfail" "$bin/forkfail.c" \
  "$runtime/core.c" "$runtime/collection.c" "$runtime/io.c" "$runtime/math.c" \
  "$runtime/error.c" "$runtime/process.c" "$runtime/json.c" "$runtime/cgc-bridge.c" \
  "$runtime/db.c" "$runtime/http_server.c" "$runtime/auth.c" \
  "$ROOT/tests/db-fork-probe.c" -lsqlite3 -lcrypto -lm -Wl,--wrap=fork
isolated_pass=0
for i in $(seq 1 50); do
  rc=0
  DB_FORK_ISOLATED=1 unshare --map-auto --setuid 1 --setgid 1 -- "$bin/forkfail" \
    >"$WORK/isolated-$i.out" 2>"$WORK/isolated-$i.err" || rc=$?
  failed="$(grep -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/isolated-$i.out" || true)"
  succeeded="$(grep -Ec '^SLOT[0-9]+=[0-9]+$' "$WORK/isolated-$i.out" || true)"
  verdict=FAIL
  if test "$rc" -eq 0 && test "$failed" -gt 0 && test "$succeeded" -gt 0 &&
     test $((failed + succeeded)) -eq 20 && grep -Fxq 'PARALLEL_DONE' "$WORK/isolated-$i.out"; then
    verdict=PASS
    isolated_pass=$((isolated_pass + 1))
  fi
  measured="$(grep -m1 '^DB_FORK_MEASURED_TASKS=' "$WORK/isolated-$i.err" || true)"
  first_failure="$(grep -m1 'DB_FORK_RESULT=fail' "$WORK/isolated-$i.err" || true)"
  printf 'D5_ISOLATED_RUN=%s VERDICT=%s RC=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s %s %s\n' \
    "$i" "$verdict" "$rc" "$failed" "$succeeded" "$measured" "$first_failure"
done
printf 'D5_ISOLATED_PASS=%s/50\nD5_ISOLATED_FAIL=%s/50\n' "$isolated_pass" "$((50 - isolated_pass))"
