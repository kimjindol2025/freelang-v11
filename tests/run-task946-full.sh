#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task946-full.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task946-full.sh <stage2-compiler> <empty-work-dir>}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-46 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"
LEGACY_RC=0
POOL_RC=0
printf 'TASK942_LEGACY_BEGIN\n'
timeout --signal=TERM --kill-after=10s 1800s env FL_HTTP_WORKERS=0 \
  bash "$ROOT/tests/run-task938-load.sh" "$COMPILER" "$WORK/legacy" || LEGACY_RC=$?
printf 'TASK942_LEGACY_RC=%s\n' "$LEGACY_RC"
printf 'TASK942_POOL_BEGIN\n'
timeout --signal=TERM --kill-after=10s 1800s \
  bash "$ROOT/tests/run-task942-pool.sh" "$COMPILER" "$WORK/pool" || POOL_RC=$?
printf 'TASK942_POOL_RC=%s\n' "$POOL_RC"
PASSED=0
(( LEGACY_RC == 0 )) && PASSED=$((PASSED + 1))
(( POOL_RC == 0 )) && PASSED=$((PASSED + 1))
printf 'TASK946_FAST_SUMMARY=%s/2\n' "$PASSED"
(( LEGACY_RC == 0 && POOL_RC == 0 ))
