#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task942-all.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task942-all.sh <stage2-compiler> <empty-work-dir>}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-42 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"

printf 'TASK942_LEGACY_BEGIN\n'
timeout --signal=TERM --kill-after=10s 1800s env FL_HTTP_WORKERS=0 \
  bash "$ROOT/tests/run-task938-load.sh" "$COMPILER" "$WORK/legacy"
printf 'TASK942_POOL_BEGIN\n'
timeout --signal=TERM --kill-after=10s 1800s \
  bash "$ROOT/tests/run-task942-pool.sh" "$COMPILER" "$WORK/pool"
printf 'TASK942_ALL=PASS\n'
