#!/usr/bin/env bash
set -Eeuo pipefail

BASE="${1:?usage: run-db-regress.sh <base-repo> <base-compiler> <target-compiler> <empty-work-dir>}"
BASE_COMPILER="${2:?usage: run-db-regress.sh <base-repo> <base-compiler> <target-compiler> <empty-work-dir>}"
TARGET_COMPILER="${3:?usage: run-db-regress.sh <base-repo> <base-compiler> <target-compiler> <empty-work-dir>}"
WORK="${4:?usage: run-db-regress.sh <base-repo> <base-compiler> <target-compiler> <empty-work-dir>}"
TARGET="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"

snapshot() {
  local label="$1"
  printf '%s_UTC=%s\n' "$label" "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
  printf '%s_USER_PROCESSES=%s\n' "$label" "$(ps -u "$(id -u)" -o pid= | wc -l | tr -d ' ')"
  printf '%s_USER_TASKS=%s\n' "$label" "$(ps -u "$(id -u)" -L -o lwp= | wc -l | tr -d ' ')"
  printf '%s_AGENT_PROCESSES=%s\n' "$label" "$(ps -u "$(id -u)" -o comm= | rg -ic 'codex|orca' || true)"
  printf '%s_ULIMIT_U=%s\n' "$label" "$(ulimit -u)"
  printf '%s_ULIMIT_N=%s\n' "$label" "$(ulimit -n)"
}

printf 'BASE_HEAD=%s\n' "$(git -C "$BASE" rev-parse HEAD)"
printf 'TARGET_HEAD=%s\n' "$(git -C "$TARGET" rev-parse HEAD)"
for round in 1 2 3; do
  mkdir -p "$WORK/round-$round"
  sides=(base target)
  if test "$round" -eq 2; then sides=(target base); fi
  printf 'ROUND_%s_ORDER=%s,%s\n' "$round" "${sides[0]}" "${sides[1]}"
  for side in "${sides[@]}"; do
    snapshot "ROUND_${round}_${side^^}_PRE"
    if test "$side" = base; then
      repo="$BASE"; compiler="$BASE_COMPILER"
    else
      repo="$TARGET"; compiler="$TARGET_COMPILER"
    fi
    printf 'ROUND_%s_%s_START_UTC=%s\n' "$round" "${side^^}" "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
    rc=0
    strace -f -e trace=execve -o "$WORK/round-$round/$side.trace" \
      bash "$repo/tests/run-task938-load.sh" "$compiler" "$WORK/round-$round/$side" \
      >"$WORK/round-$round/$side.log" 2>&1 || rc=$?
    printf 'ROUND_%s_%s_RC=%s\n' "$round" "${side^^}" "$rc"
    printf 'ROUND_%s_%s_RESULTS_BEGIN\n' "$round" "${side^^}"
    rg '^(LOAD_FAST_SUITE_RC=|FDFIX_CASE=|FDFIX_RECOVERY_RC=|FDFIX_RECOVERY_OR_OOM=|FDFIX_SUMMARY=|LOAD2_SUMMARY=)' \
      "$WORK/round-$round/$side.log" || true
    rg '^(CASE=process-limit-run-parallel|OOM_SUMMARY=|FORKFAIL_SUMMARY=)' \
      "$WORK/round-$round/$side/base/oom.log" || true
    printf 'ROUND_%s_%s_RESULTS_END\n' "$round" "${side^^}"
    snapshot "ROUND_${round}_${side^^}_POST"
  done
done
