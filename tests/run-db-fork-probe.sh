#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-db-fork-probe.sh <compiler> <empty-temp-dir>}"
WORK="${2:?usage: run-db-fork-probe.sh <compiler> <empty-temp-dir>}"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"
BIN_DIR="$(mktemp -d /tmp/db-fork-bin.XXXXXX)"
trap 'rm -rf -- "$BIN_DIR"' EXIT
chmod 711 "$BIN_DIR"
R="$ROOT/runtime"
"$COMPILER" "$ROOT/tests/task932/forkfail.fl" "$BIN_DIR/forkfail.c" >"$WORK/compile.log" 2>&1
gcc -w -I "$R" -o "$BIN_DIR/forkfail" "$BIN_DIR/forkfail.c" \
  "$R/core.c" "$R/collection.c" "$R/io.c" "$R/math.c" "$R/error.c" \
  "$R/process.c" "$R/json.c" "$R/cgc-bridge.c" "$R/db.c" \
  "$R/http_server.c" "$R/auth.c" "$ROOT/tests/db-fork-probe.c" \
  -lsqlite3 -lcrypto -lm -Wl,--wrap=fork

passed=0
for i in $(seq 1 20); do
  rc=0
  DB_FORK_ISOLATED=1 unshare --map-auto --setuid 1 --setgid 1 -- "$BIN_DIR/forkfail" >"$WORK/run-$i.out" 2>"$WORK/run-$i.err" || rc=$?
  failed="$(rg -c '"code":"E_RUN_PARALLEL_FORK"' "$WORK/run-$i.out" || true)"
  succeeded="$(rg -c '^SLOT[0-9]+=[0-9]+$' "$WORK/run-$i.out" || true)"
  failed="${failed:-0}"
  succeeded="${succeeded:-0}"
  first_failure="$(rg -m1 'DB_FORK_RESULT=fail' "$WORK/run-$i.err" || true)"
  measured="$(rg -m1 '^DB_FORK_MEASURED_TASKS=' "$WORK/run-$i.err" || true)"
  verdict=FAIL
  if test "$rc" -eq 0 && test "$failed" -gt 0 && test "$succeeded" -gt 0 &&
     test $((failed + succeeded)) -eq 20 &&
     grep -Fxq 'PARALLEL_DONE' "$WORK/run-$i.out" && test -n "$first_failure"; then
    verdict=PASS
    passed=$((passed + 1))
  fi
  printf 'DB_FLAKY_RUN=%s VERDICT=%s RC=%s FAILED_SLOTS=%s SUCCESSFUL_SLOTS=%s %s %s\n' \
    "$i" "$verdict" "$rc" "$failed" "$succeeded" "$measured" "$first_failure"
done
printf 'DB_FLAKY_SUMMARY=%s/20\n' "$passed"
printf 'DB_FLAKY_VARIANCE=%s\n' "$((20 - passed))"
test "$passed" -eq 20
