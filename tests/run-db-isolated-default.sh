#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-db-isolated-default.sh <compiler> <empty-work-dir>}"
WORK="${2:?usage: run-db-isolated-default.sh <compiler> <empty-work-dir>}"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"

mkdir "$WORK/fake-bin"
printf '#!/bin/sh\nprintf "simulated-unshare-unavailable\\n" >&2\nexit 1\n' >"$WORK/fake-bin/unshare"
chmod +x "$WORK/fake-bin/unshare"
skip_rc=0
PATH="$WORK/fake-bin:$PATH" bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/skip" >"$WORK/skip.log" 2>&1 || skip_rc=$?
skip_reason="$(grep -m1 '^SKIP_REASON=' "$WORK/skip.log" || true)"
printf 'D6_SKIP_RC=%s %s\n' "$skip_rc" "${skip_reason:-SKIP_REASON=missing}"
test "$skip_rc" -ne 0 && test "$skip_reason" = 'SKIP_REASON=isolated-uid-or-limit-setup-failed'
! grep -Fxq 'FORKFAIL_SUMMARY=9/9' "$WORK/skip.log"

main_rc=0
FL_FORK_LIMIT_MODE=main bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/main-option" >"$WORK/main-option.log" 2>&1 || main_rc=$?
printf 'D6_MAIN_OPTION_RC=%s MODE=%s\n' "$main_rc" "$(grep -m1 '^PARALLEL_MODE=' "$WORK/main-option.log" || true)"
grep -Fxq 'PARALLEL_MODE=main' "$WORK/main-option.log"
grep -q '^PARALLEL_ULIMIT_U=' "$WORK/main-option.log"

passed=0
for i in $(seq 1 50); do
  rc=0
  bash "$ROOT/tests/run-task931.sh" "$COMPILER" "$WORK/run-$i" >"$WORK/run-$i.log" 2>&1 || rc=$?
  if ! grep -q '^PARALLEL_USER_PROCESS_COUNT=' "$WORK/run-$i.log" ||
     grep -q 'unbound variable' "$WORK/run-$i.log"; then
    printf 'D6_SETUP_ERROR=default-run-incomplete RUN=%s\n' "$i" >&2
    exit 2
  fi
  mode="$(grep -m1 '^PARALLEL_MODE=' "$WORK/run-$i.log" || true)"
  case_line="$(grep -m1 '^CASE=process-limit-run-parallel ' "$WORK/run-$i.log" || true)"
  verdict=FAIL
  if test "$rc" -eq 0 && test "$mode" = 'PARALLEL_MODE=isolated' &&
     grep -Fxq 'FORKFAIL_SUMMARY=9/9' "$WORK/run-$i.log"; then
    verdict=PASS
    passed=$((passed + 1))
  fi
  printf 'D6_DEFAULT_RUN=%s VERDICT=%s RC=%s %s %s\n' "$i" "$verdict" "$rc" "$mode" "$case_line"
done
printf 'D6_DEFAULT_PASS=%s/50\nD6_DEFAULT_FAIL=%s/50\n' "$passed" "$((50 - passed))"
test "$passed" -eq 50
