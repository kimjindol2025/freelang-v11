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
  snapshot "ROUND_${round}_PRE"
  printf 'ROUND_%s_BASE_START_UTC=%s\n' "$round" "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
  strace -f -e trace=execve -o "$WORK/round-$round/base.trace" \
    bash "$BASE/tests/run-task938-load.sh" "$BASE_COMPILER" "$WORK/round-$round/base" \
    >"$WORK/round-$round/base.log" 2>&1 &
  base_pid=$!
  printf 'ROUND_%s_TARGET_START_UTC=%s\n' "$round" "$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
  strace -f -e trace=execve -o "$WORK/round-$round/target.trace" \
    bash "$TARGET/tests/run-task938-load.sh" "$TARGET_COMPILER" "$WORK/round-$round/target" \
    >"$WORK/round-$round/target.log" 2>&1 &
  target_pid=$!
  base_rc=0; wait "$base_pid" || base_rc=$?
  target_rc=0; wait "$target_pid" || target_rc=$?
  printf 'ROUND_%s_BASE_RC=%s\n' "$round" "$base_rc"
  printf 'ROUND_%s_TARGET_RC=%s\n' "$round" "$target_rc"
  for side in base target; do
    printf 'ROUND_%s_%s_RESULTS_BEGIN\n' "$round" "${side^^}"
    rg '^(LOAD_FAST_SUITE_RC=|FDFIX_CASE=|FDFIX_RECOVERY_RC=|FDFIX_RECOVERY_OR_OOM=|FDFIX_SUMMARY=|LOAD2_SUMMARY=)' \
      "$WORK/round-$round/$side.log" || true
    rg '^(CASE=process-limit-run-parallel|OOM_SUMMARY=|FORKFAIL_SUMMARY=)' \
      "$WORK/round-$round/$side/base/oom.log" || true
    printf 'ROUND_%s_%s_RESULTS_END\n' "$round" "${side^^}"
  done
  snapshot "ROUND_${round}_POST"
done
