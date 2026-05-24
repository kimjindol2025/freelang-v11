#!/bin/bash
# tests/runners/run-e2e.sh — L3 E2E Test Runner
# Golden 코드 생성 기준 파일 검증 (deterministic compilation)
#
# 호출: bash tests/runners/run-e2e.sh
# 반환: 0 (모든 테스트 통과), 1 (일부 실패)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
E2E_DIR="${SCRIPT_DIR}/tests/e2e"
GOLDEN_DIR="${SCRIPT_DIR}/tests/golden"
RUNNER="${SCRIPT_DIR}/bootstrap.js"
COMPILER="${SCRIPT_DIR}/self/cgc-main.fl"
TOTAL_PASS=0
TOTAL_FAIL=0

# E2E 테스트 파일 목록
E2E_TESTS=(hello loop fib factorial)

if [[ ! -f "$COMPILER" ]]; then
  echo "❌ Compiler not found: $COMPILER"
  exit 1
fi

echo "Running E2E tests..."

for test_name in "${E2E_TESTS[@]}"; do
  test_file="${E2E_DIR}/${test_name}.fl"
  golden_file="${GOLDEN_DIR}/${test_name}.expected.c"
  temp_file="/tmp/${test_name}-e2e-gen.c"

  if [[ ! -f "$test_file" ]]; then
    echo "  ⚠ Test file not found: $test_file"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  if [[ ! -f "$golden_file" ]]; then
    echo "  ⚠ Golden file not found: $golden_file"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  # C 코드 생성
  if ! node --stack-size=8192 "$RUNNER" run "$COMPILER" "$test_file" "$temp_file" 2>&1 | grep -q "Compiled"; then
    echo "  ✗ $test_name (compile error)"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    continue
  fi

  # Golden 파일과 비교
  if diff -q "$golden_file" "$temp_file" >/dev/null 2>&1; then
    echo "  ✓ $test_name"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo "  ✗ $test_name (golden mismatch)"
    echo "    Golden: $(sha256sum "$golden_file" | cut -d' ' -f1)"
    echo "    Gen:    $(sha256sum "$temp_file" | cut -d' ' -f1)"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi

  # 임시 파일 정리
  rm -f "$temp_file"
done

echo ""
echo "E2E: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed"

if [[ $TOTAL_FAIL -eq 0 ]]; then
  exit 0
else
  exit 1
fi
