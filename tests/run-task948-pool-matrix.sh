#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task948-pool-matrix.sh <stage2-compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task948-pool-matrix.sh <stage2-compiler> <empty-work-dir>}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-48 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"
printf 'TASK948_EXECUTION_LOCATION=freelang-v11\n'

run_one() {
  local condition="$1" repeat="$2" mode="$3" traced="$4"
  local run_work="$WORK/$condition-$repeat"
  local log="$run_work.log" trace="$run_work.strace" rc=0
  mkdir -p "$WORK"
  if [[ "$mode" == standalone ]]; then
    if [[ "$traced" == 1 ]]; then
      strace -f -e trace=execve -o "$trace" timeout --signal=TERM --kill-after=10s 900s \
        bash "$ROOT/tests/run-task944-worker16-ok.sh" "$ROOT/bin/cgc-bin-x86_64-seed-v11" "$run_work" \
        >"$log" 2>&1 || rc=$?
    else
      timeout --signal=TERM --kill-after=10s 900s \
        bash "$ROOT/tests/run-task944-worker16-ok.sh" "$ROOT/bin/cgc-bin-x86_64-seed-v11" "$run_work" \
        >"$log" 2>&1 || rc=$?
    fi
    printf 'MATRIX condition=%s repeat=%s rc=%s\n' "$condition" "$repeat" "$rc"
    grep '^LOAD_STAGE stage=94401 ' "$log" || true
  else
    if [[ "$traced" == 1 ]]; then
      strace -f -e trace=execve -o "$trace" timeout --signal=TERM --kill-after=10s 1800s \
        bash "$ROOT/tests/run-task942-pool.sh" "$COMPILER" "$run_work" >"$log" 2>&1 || rc=$?
    else
      timeout --signal=TERM --kill-after=10s 1800s \
        bash "$ROOT/tests/run-task942-pool.sh" "$COMPILER" "$run_work" >"$log" 2>&1 || rc=$?
    fi
    printf 'MATRIX condition=%s repeat=%s rc=%s\n' "$condition" "$repeat" "$rc"
    grep '^POOL_BENCH workers=16 route=ok ' "$log" || true
  fi
  if (( rc != 0 )); then
    printf 'MATRIX_LOG_TAIL_BEGIN condition=%s repeat=%s\n' "$condition" "$repeat"
    tail -n 30 "$log"
    printf 'MATRIX_LOG_TAIL_END condition=%s repeat=%s\n' "$condition" "$repeat"
  fi
  (( rc == 0 ))
}

run_group() {
  local condition="$1" mode="$2" traced="$3"
  for repeat in 1 2 3; do run_one "$condition" "$repeat" "$mode" "$traced"; done
}

run_group standalone-no-strace standalone 0
run_group standalone-strace standalone 1
run_group pool-no-strace pool 0
run_group pool-strace pool 1
