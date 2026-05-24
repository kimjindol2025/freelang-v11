#!/bin/bash
# test.sh — FreeLang v11 통합 테스트 진입점
# 사용: ./test.sh [layer] [options]
#
# layer:  static|unit|integration|e2e|fixpoint (기본: 전체)
# options: --fast (L0+L1), --verbose (상세), -q (조용함)
#
# 예: ./test.sh           # 전체 테스트
#     ./test.sh --fast     # 빠른 테스트 (L0+L1)
#     ./test.sh unit       # L1만

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYER="${1:---all}"
VERBOSE=""
QUIET=""

# 옵션 파싱
while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose) VERBOSE="1"; shift ;;
    --fast)    LAYER="fast"; shift ;;
    -q)        QUIET="1"; shift ;;
    static|unit|integration|e2e|fixpoint|--all) LAYER="$1"; shift ;;
    --all)     LAYER="all"; shift ;;
    *)         shift ;;
  esac
done

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 결과 저장
RESULTS_FILE="${SCRIPT_DIR}/tests/RESULTS.json"
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TIME=0

log_section() {
  if [[ -z "$QUIET" ]]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "[$1] $2"
    echo "════════════════════════════════════════════════════════════════"
  fi
}

log_pass() {
  if [[ -z "$QUIET" ]]; then
    echo -e "${GREEN}✓${NC} $1"
  fi
  TOTAL_PASS=$((TOTAL_PASS + 1))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
}

# L0: Static Validation
run_static() {
  log_section "L0" "Static Validation"

  # check-parens
  if python3 "${SCRIPT_DIR}/scripts/check-parens.py" \
    "${SCRIPT_DIR}"/self/*.fl \
    "${SCRIPT_DIR}"/tests/unit/*.fl \
    "${SCRIPT_DIR}"/tests/integration/*.fl 2>/dev/null; then
    log_pass "check-parens: 괄호/브래킷 균형"
  else
    log_fail "check-parens: 괄호 오류"
  fi

  # lint-p0
  if python3 "${SCRIPT_DIR}/scripts/lint-p0.py" \
    "${SCRIPT_DIR}"/self/*.fl \
    "${SCRIPT_DIR}"/tests/unit/*.fl 2>/dev/null | grep -q "violation"; then
    log_fail "lint-p0: P0 규칙 위반"
  else
    log_pass "lint-p0: P0 규칙 (5개) 준수"
  fi
}

# L1: Unit Tests
run_unit() {
  log_section "L1" "Unit Tests"

  if [[ -f "${SCRIPT_DIR}/tests/runners/run-unit.sh" ]]; then
    if bash "${SCRIPT_DIR}/tests/runners/run-unit.sh" 2>/dev/null; then
      log_pass "Unit tests: 모든 테스트 통과"
    else
      log_fail "Unit tests: 일부 테스트 실패"
    fi
  else
    log_fail "Unit runner not found: tests/runners/run-unit.sh"
  fi
}

# L2: Integration Tests (선택)
run_integration() {
  log_section "L2" "Integration Tests"

  if [[ -f "${SCRIPT_DIR}/tests/runners/run-integration.sh" ]]; then
    if bash "${SCRIPT_DIR}/tests/runners/run-integration.sh" 2>/dev/null; then
      log_pass "Integration tests: HTTP/DB/auth 통과"
    else
      log_fail "Integration tests: 일부 실패"
    fi
  else
    log_fail "Integration runner not found: tests/runners/run-integration.sh"
  fi
}

# L3: E2E Tests
run_e2e() {
  log_section "L3" "E2E Tests"

  if [[ -f "${SCRIPT_DIR}/tests/runners/run-e2e.sh" ]]; then
    if bash "${SCRIPT_DIR}/tests/runners/run-e2e.sh" 2>/dev/null; then
      log_pass "E2E tests: compile-*.sh 파이프라인 통과"
    else
      log_fail "E2E tests: 일부 컴파일 실패"
    fi
  else
    log_fail "E2E runner not found: tests/runners/run-e2e.sh"
  fi
}

# L4: Self-Host Fixpoint
run_fixpoint() {
  log_section "L4" "Self-Host Fixpoint"

  if [[ -f "${SCRIPT_DIR}/scripts/verify-l4-fixpoint.sh" ]]; then
    if bash "${SCRIPT_DIR}/scripts/verify-l4-fixpoint.sh" 2>/dev/null | grep -q "Fixed-point"; then
      log_pass "Fixpoint: gen1.c == gen2.c == gen3.c (SHA 일치)"
    else
      log_fail "Fixpoint: 고정점 미달성"
    fi
  else
    log_fail "Fixpoint script not found: scripts/verify-l4-fixpoint.sh"
  fi
}

# 메인 로직
main() {
  START_TIME=$(date +%s)

  case "$LAYER" in
    all|--all)
      run_static
      run_unit
      run_e2e
      run_fixpoint
      ;;
    fast)
      run_static
      run_unit
      ;;
    static)
      run_static
      ;;
    unit)
      run_unit
      ;;
    integration)
      run_integration
      ;;
    e2e)
      run_e2e
      ;;
    fixpoint)
      run_fixpoint
      ;;
    *)
      # 기본: 전체 테스트
      run_static
      run_unit
      run_e2e
      run_fixpoint
      ;;
  esac

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # 요약
  if [[ -z "$QUIET" ]]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "SUMMARY"
    echo "════════════════════════════════════════════════════════════════"
    echo -e "Passed:  ${GREEN}${TOTAL_PASS}${NC}"
    echo -e "Failed:  ${RED}${TOTAL_FAIL}${NC}"
    if [[ $TOTAL_FAIL -eq 0 ]]; then
      TOTAL=$((TOTAL_PASS + TOTAL_FAIL))
      echo -e "Status:  ${GREEN}ALL PASS${NC} (${TOTAL}/${TOTAL})"
      echo "Runtime: ${DURATION}s"
    else
      TOTAL=$((TOTAL_PASS + TOTAL_FAIL))
      PCT=$((TOTAL_PASS * 100 / TOTAL))
      echo -e "Status:  ${RED}FAIL${NC} (${TOTAL_PASS}/${TOTAL}, ${PCT}%)"
      echo "Runtime: ${DURATION}s"
      exit 1
    fi
  fi
}

main "$@"
