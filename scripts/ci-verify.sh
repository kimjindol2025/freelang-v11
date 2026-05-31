#!/bin/bash
# scripts/ci-verify.sh — Phase 1E: CI Verification Gate
# 목표: L0+L1+L3+L4 통합 검증 + 자동 게이트
#
# 사용: bash scripts/ci-verify.sh [--fast]
# --fast: L0+L1만 (개발 빠른 피드백)
#
# 반환: 0 (모든 게이트 PASS), 1 (실패)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FAST="${1:---all}"

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║             FreeLang v11 CI Verification Gate              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Gate 결과 추적
GATES_PASS=0
GATES_FAIL=0

# L0: Static Validation
echo "──────────────────────────────────────────────────────────────"
echo "Gate L0: Static Validation"
echo "──────────────────────────────────────────────────────────────"

if cd "$REPO_ROOT" && bash test.sh static -q 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Static validation PASS"
  GATES_PASS=$((GATES_PASS + 1))
else
  echo -e "${RED}✗${NC} Static validation FAIL"
  GATES_FAIL=$((GATES_FAIL + 1))
fi

echo ""

# L1: Unit Tests
echo "──────────────────────────────────────────────────────────────"
echo "Gate L1: Unit Tests"
echo "──────────────────────────────────────────────────────────────"

if cd "$REPO_ROOT" && bash test.sh unit -q 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Unit tests PASS"
  GATES_PASS=$((GATES_PASS + 1))
else
  echo -e "${RED}✗${NC} Unit tests FAIL"
  GATES_FAIL=$((GATES_FAIL + 1))
fi

echo ""

# --fast 옵션 시 여기서 종료
if [[ "$FAST" == "--fast" ]]; then
  echo "══════════════════════════════════════════════════════════════"
  echo "Quick CI (L0+L1) Complete"
  echo "══════════════════════════════════════════════════════════════"
  if [[ $GATES_FAIL -eq 0 ]]; then
    echo -e "${GREEN}✓${NC} QUICK CI PASS ($GATES_PASS gates)"
    exit 0
  else
    echo -e "${RED}✗${NC} QUICK CI FAIL ($GATES_FAIL failures)"
    exit 1
  fi
fi

# L3: E2E Tests
echo "──────────────────────────────────────────────────────────────"
echo "Gate L3: E2E Tests (Deterministic Compilation)"
echo "──────────────────────────────────────────────────────────────"

if cd "$REPO_ROOT" && bash test.sh e2e -q 2>/dev/null; then
  echo -e "${GREEN}✓${NC} E2E tests PASS"
  GATES_PASS=$((GATES_PASS + 1))
else
  echo -e "${RED}✗${NC} E2E tests FAIL"
  GATES_FAIL=$((GATES_FAIL + 1))
fi

echo ""

# L4: Fixed-point Verification
echo "──────────────────────────────────────────────────────────────"
echo "Gate L4: Fixed-point (Self-hosting Stability)"
echo "──────────────────────────────────────────────────────────────"

if cd "$REPO_ROOT" && bash test.sh fixpoint -q 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Fixpoint PASS (gen1==gen2==gen3)"
  GATES_PASS=$((GATES_PASS + 1))
else
  echo -e "${RED}✗${NC} Fixpoint FAIL"
  GATES_FAIL=$((GATES_FAIL + 1))
fi

echo ""

# 최종 요약
echo "════════════════════════════════════════════════════════════════"
echo "CI Verification Summary"
echo "════════════════════════════════════════════════════════════════"

TOTAL=$((GATES_PASS + GATES_FAIL))

echo ""
echo "Gates:"
echo "  L0 Static      : $([ $GATES_PASS -ge 1 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  L1 Unit        : $([ $GATES_PASS -ge 2 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  L3 E2E         : $([ $GATES_PASS -ge 3 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  L4 Fixpoint    : $([ $GATES_PASS -ge 4 ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"

echo ""
echo "Result: $(echo -e "${GREEN}${GATES_PASS}${NC}") PASS / $(echo -e "${RED}${GATES_FAIL}${NC}") FAIL (${TOTAL} total)"

echo ""

if [[ $GATES_FAIL -eq 0 ]]; then
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║             ${GREEN}✓ CI VERIFICATION PASS${NC}                     ║"
  echo "║                                                            ║"
  echo "║  All gates passed. Safe to commit/merge.                 ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  exit 0
else
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║             ${RED}✗ CI VERIFICATION FAIL${NC}                     ║"
  echo "║                                                            ║"
  echo "║  Fix failing gates before committing.                    ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  exit 1
fi
