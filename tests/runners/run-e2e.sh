#!/bin/bash
# tests/runners/run-e2e.sh — L3 E2E Test Runner
# Golden 코드 생성 기준 파일 검증 (deterministic compilation)
#
# 호출: bash tests/runners/run-e2e.sh
# 반환: 0 (모든 테스트 통과), 1 (일부 실패)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
E2E_DIR="${SCRIPT_DIR}/tests/e2e"
TOOLS_ROOT="${FL_TOOLS_DISPATCH_ROOT:-${SCRIPT_DIR}/../freelang-tools}"
CGC="${TOOLS_ROOT}/scripts/cgc-native"
RUNNER="${TOOLS_ROOT}/scripts/fl-cgc-run"
RUNTIME="${FREELANG_V11_RUNTIME:-${SCRIPT_DIR}/runtime}"
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_BLOCKED=0

# E2E 테스트 파일 목록
E2E_TESTS=(hello loop fib factorial)

if [[ ! -x "$CGC" ]]; then
  echo "E2E=BLOCKED"
  echo "CAUSE=native-compiler-missing" >&2
  exit 2
fi

echo "Running E2E tests..."
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fl-v11-native-e2e.XXXXXX")"
cleanup() {
  local file
  for file in "$WORK_DIR"/*; do
    [[ -e "$file" ]] && rm -f -- "$file"
  done
  rmdir -- "$WORK_DIR"
}
trap cleanup EXIT INT TERM

for test_name in "${E2E_TESTS[@]}"; do
  test_file="${E2E_DIR}/${test_name}.fl"
  first_c="${WORK_DIR}/${test_name}-1.c"
  second_c="${WORK_DIR}/${test_name}-2.c"
  executable="${WORK_DIR}/${test_name}"
  expected_output="${WORK_DIR}/${test_name}-runner.out"
  actual_output="${WORK_DIR}/${test_name}-native.out"
gcc_log="${WORK_DIR}/${test_name}-gcc.log"

  if [[ ! -f "$test_file" ]]; then
    echo "  ⚠ Test file not found: $test_file"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  if ! "$CGC" "$test_file" "$first_c" --print-last >/dev/null 2>&1 || \
     ! "$CGC" "$test_file" "$second_c" --print-last >/dev/null 2>&1; then
    echo "  ✗ $test_name (compile error)"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  if ! cmp -s "$first_c" "$second_c"; then
    echo "  ✗ $test_name (native C output is not deterministic)"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  if ! gcc -Wno-unused -I "$RUNTIME" -o "$executable" "$first_c" \
      "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" \
      "$RUNTIME/math.c" "$RUNTIME/error.c" "$RUNTIME/process.c" \
      "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" -lm >"$gcc_log" 2>&1; then
    if grep -Fq "too few arguments to function ‘range’" "$gcc_log"; then
      echo "  ! $test_name (native runtime does not support legacy range/1 form)"
      TOTAL_BLOCKED=$((TOTAL_BLOCKED + 1))
    else
      echo "  ✗ $test_name (native C link error)"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
    continue
  fi

  if ! FREELANG_V11_RUNTIME="$RUNTIME" "$RUNNER" "$test_file" >"$expected_output" 2>&1 || \
     ! "$executable" >"$actual_output" 2>&1 || \
     ! cmp -s "$expected_output" "$actual_output"; then
    echo "  ✗ $test_name (native execution mismatch)"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  echo "  ✓ $test_name (deterministic C and native output match)"
  TOTAL_PASS=$((TOTAL_PASS + 1))
done

echo ""
echo "E2E: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed, ${TOTAL_BLOCKED} blocked"

if [[ "$TOTAL_BLOCKED" -gt 0 ]]; then
  echo 'E2E=BLOCKED'
  echo 'CAUSE=native-runtime-lacks-legacy-range-arity' >&2
  exit 2
fi

if [[ $TOTAL_FAIL -eq 0 ]]; then
  exit 0
else
  exit 1
fi
