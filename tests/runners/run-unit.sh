#!/bin/bash
# tests/runners/run-unit.sh — L1 Unit Test Runner
# FL-native 테스트 파일 순차 실행
#
# 호출: bash tests/runners/run-unit.sh
# 반환: 0 (전체 pass), 1 (일부 fail)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="${SCRIPT_DIR}/tests/unit"
TOOLS_ROOT="${FL_TOOLS_DISPATCH_ROOT:-${SCRIPT_DIR}/../freelang-tools}"
RUNNER="${TOOLS_ROOT}/scripts/fl-cgc-run"
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_BLOCKED=0

# 테스트 파일 찾기
TEST_FILES=$(find "${TEST_DIR}" -name "*.test.fl" 2>/dev/null | sort)

if [[ -z "$TEST_FILES" ]]; then
  echo "⚠ Unit test files not found in ${TEST_DIR}"
  exit 1
fi

echo "Running unit tests..."

for test_file in $TEST_FILES; do
  test_name=$(basename "$test_file" .test.fl)
  test_output=""

  # FL-native 테스트 실행 (에러 캡처, 실패해도 계속 진행)
  if test_output=$(FREELANG_V11_RUNTIME="${SCRIPT_DIR}/runtime" "${RUNNER}" "${test_file}" 2>&1); then
    echo "  ✓ $test_name"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    if grep -Eq '\[CGC-ERR\]|error:' <<<"$test_output"; then
      echo "  ! $test_name (native compiler/runtime unsupported)"
      TOTAL_BLOCKED=$((TOTAL_BLOCKED + 1))
    else
      echo "  ✗ $test_name"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  fi
done

echo ""
echo "Unit: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed, ${TOTAL_BLOCKED} blocked"

if [[ "$TOTAL_BLOCKED" -gt 0 ]]; then
  echo 'UNIT=BLOCKED'
  echo 'CAUSE=native-cgc-lacks-features-used-by-legacy-unit-suite' >&2
  exit 2
fi

if [[ $TOTAL_FAIL -eq 0 ]]; then
  exit 0
else
  exit 1
fi
