#!/bin/bash
set -euo pipefail

# Phase 3-C: L2 증명 — Semantic Preservation 검증 (bootstrap vs stage1)
# 목표: 12개 테스트 케이스에서 bootstrap과 stage1의 의미 동등성 검증

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests/l2"
WORK_DIR="/tmp/l2-proof-$$"
RESULTS_FILE="$PROJECT_ROOT/L2-PROOF-RESULTS.json"

mkdir -p "$WORK_DIR" "$TEST_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
RESET='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${1}${RESET}"; }
log_pass() { echo -e "${GREEN}✅ ${1}${RESET}"; }
log_fail() { echo -e "${RED}❌ ${1}${RESET}"; }
log_warn() { echo -e "${YELLOW}⚠️  ${1}${RESET}"; }
log_header() { echo -e "\n${BLUE}════════════════════════════════${RESET}\n  ${1}\n${BLUE}════════════════════════════════${RESET}\n"; }

# 1단계: 환경 준비 (--prepare)
prepare() {
  log_header "1단계: 환경 초기화"
  log_info "TS → bootstrap.js 생성 중..."
  cd "$PROJECT_ROOT"
  npm run build >/dev/null 2>&1 || { log_fail "bootstrap.js 생성 실패"; exit 1; }

  log_info "bootstrap으로 stage1.js 컴파일 중..."
  node --stack-size=8000 bootstrap.js run self/all.fl self/all.fl stage1.js >/dev/null 2>&1 || { log_fail "stage1.js 컴파일 실패"; exit 1; }

  log_pass "환경 준비 완료"
  echo "  bootstrap.js ✓"
  echo "  stage1.js ✓"
}

# 2단계: 테스트 케이스 실행 (--run)
run_tests() {
  log_header "2단계: L2 검증 테스트 실행"

  if [ ! -d "$TEST_DIR" ] || [ -z "$(ls -A "$TEST_DIR"/*.fl 2>/dev/null)" ]; then
    log_warn "테스트 케이스 없음: $TEST_DIR/*.fl"
    return
  fi

  local total=0 passed=0 failed=0
  local -a results=()

  for test_file in $(ls -1 "$TEST_DIR"/*.fl 2>/dev/null | sort); do
    test_name=$(basename "$test_file")
    total=$((total + 1))

    log_info "실행 중: $test_name"

    local bootstrap_out="$WORK_DIR/bootstrap-$test_name.js"
    local stage1_out="$WORK_DIR/stage1-$test_name.js"
    local bootstrap_result="$WORK_DIR/bootstrap-result-$test_name.txt"
    local stage1_result="$WORK_DIR/stage1-result-$test_name.txt"

    if ! node bootstrap.js run self/codegen.fl "$test_file" "$bootstrap_out" 2>/dev/null; then
      log_fail "  bootstrap 컴파일 실패"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"bootstrap compile\" }")
      continue
    fi

    if ! node stage1.js run self/codegen.fl "$test_file" "$stage1_out" 2>/dev/null; then
      log_fail "  stage1 컴파일 실패"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"stage1 compile\" }")
      continue
    fi

    if ! node --check "$bootstrap_out" 2>/dev/null; then
      log_fail "  bootstrap JS 문법 오류"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"bootstrap invalid JS\" }")
      continue
    fi

    if ! node --check "$stage1_out" 2>/dev/null; then
      log_fail "  stage1 JS 문법 오류"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"stage1 invalid JS\" }")
      continue
    fi

    if ! node "$bootstrap_out" >"$bootstrap_result" 2>/dev/null; then
      log_fail "  bootstrap 실행 오류"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"bootstrap runtime\" }")
      continue
    fi

    if ! node "$stage1_out" >"$stage1_result" 2>/dev/null; then
      log_fail "  stage1 실행 오류"; failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"stage1 runtime\" }")
      continue
    fi

    local bootstrap_output=$(cat "$bootstrap_result")
    local stage1_output=$(cat "$stage1_result")

    if [ "$bootstrap_output" = "$stage1_output" ]; then
      log_pass "  $test_name"
      passed=$((passed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"PASS\" }")
    else
      log_fail "  $test_name (출력 불일치)"
      failed=$((failed + 1))
      results+=("{ \"name\": \"$test_name\", \"status\": \"FAIL\", \"reason\": \"output mismatch\" }")
    fi
  done

  echo ""
  log_header "최종 결과"
  echo "총 테스트: $total개"
  echo -e "${GREEN}통과: $passed개${RESET}"
  echo -e "${RED}실패: $failed개${RESET}"

  local pass_rate=0
  [ $total -gt 0 ] && pass_rate=$((passed * 100 / total))
  echo "통과율: ${pass_rate}%"

  cat > "$RESULTS_FILE" <<EOM
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "total": $total,
  "passed": $passed,
  "failed": $failed,
  "pass_rate": $pass_rate,
  "cases": [
    $(IFS=','; echo "${results[*]}")
  ]
}
EOM

  log_pass "결과 저장: $RESULTS_FILE"
  [ $failed -eq 0 ] && return 0 || return 1
}

# 3단계: 정리 (--clean)
clean() {
  log_header "정리"
  log_info "임시 파일 제거: $WORK_DIR"
  rm -rf "$WORK_DIR"
  log_pass "정리 완료"
}

# 메인 진입점
case "${1:-}" in
  --prepare) prepare ;;
  --run) run_tests ;;
  --clean) clean ;;
  *)
    cat <<'USAGE'
사용법:
  bash scripts/verify-l2-proof.sh --prepare    환경 준비 (bootstrap + stage1)
  bash scripts/verify-l2-proof.sh --run        테스트 실행
  bash scripts/verify-l2-proof.sh --clean      임시 파일 정리

전체 흐름:
  bash scripts/verify-l2-proof.sh --prepare && bash scripts/verify-l2-proof.sh --run && bash scripts/verify-l2-proof.sh --clean
USAGE
    ;;
esac
