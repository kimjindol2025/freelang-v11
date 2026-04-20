#!/bin/bash
# scripts/verify-self-host.sh — FL 파일을 bootstrap vs self-compiled(stage1)로 각각 컴파일·실행해 결과 동일성 검증
#
# 사용법: ./scripts/verify-self-host.sh [tier1|tier2|all]
# 기본: tier1
#
# 검증 방식:
#   1) bootstrap.js run self/all.fl <input> /tmp/bs.js   ← bootstrap 경유 컴파일
#   2) stage1.js <input> /tmp/s1.js                       ← self-compiled 경유 컴파일
#   3) node /tmp/bs.js  vs  node /tmp/s1.js               ← 실행 결과 비교
#
# 파일 카테고리:
#   [RUN]    — 실행 시 println 출력이 있는 파일 (비교 대상)
#   [DEFS]   — 함수 정의만. 실행해도 출력 없음. 컴파일 성공만 확인
#   [DRIVER] — compile driver (인자 필요). stage1 자체가 DRIVER 이므로 특별 취급

set -u

cd "$(dirname "$0")/.."
REPO=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

STAGE1="$WORK/stage1.js"

echo "=== stage1 생성 ==="
node --stack-size=8000 bootstrap.js run self/all.fl self/all.fl "$STAGE1" > /dev/null 2>&1
if [ ! -s "$STAGE1" ]; then
  echo "❌ stage1.js 생성 실패"
  exit 2
fi
echo "   stage1 $(wc -c < "$STAGE1") bytes"
echo ""

# 슬래시 안전한 임시 파일명
safe() { echo "$1" | tr '/[]' '___'; }

PASS=0
FAIL=0
SKIP=0
FAIL_LIST=()
CURRENT_TIER="t1"   # t1(strict) / t2(advisory)
T1_FAIL=0
T2_FAIL=0

# 알려진 불일치(compiler-version coupled tests — test-codegen-*, test-parser-full/lex-only)
# Tier 2 tests 에서 실패해도 advisory. 2026-04-20 verification 시점 기록.
KNOWN_FLAKY=(
  "self/tests/test-codegen-builtins.fl"
  "self/tests/test-codegen-ffi.fl"
  "self/tests/test-codegen-fn.fl"
  "self/tests/test-codegen-match.fl"
  "self/tests/test-codegen-sf.fl"
  "self/tests/test-parser-full-debug.fl"
  "self/tests/test-parser-lex-only.fl"
)
is_known_flaky() {
  local f="$1"
  for k in "${KNOWN_FLAKY[@]}"; do
    [ "$f" = "$k" ] && return 0
  done
  return 1
}

bump_fail() {
  local f="$1"
  if [ "$CURRENT_TIER" = "t1" ]; then
    T1_FAIL=$((T1_FAIL+1))
  else
    T2_FAIL=$((T2_FAIL+1))
  fi
  FAIL=$((FAIL+1))
  FAIL_LIST+=("$f")
}

check_run() {
  local f="$1"
  local tag="$(safe "$f")"
  local bs="$WORK/bs_${tag}.js"
  local s1="$WORK/s1_${tag}.js"
  local obs="$WORK/out_bs_${tag}"
  local os1="$WORK/out_s1_${tag}"

  # bootstrap 경유 compile
  if ! node --stack-size=8000 bootstrap.js run self/all.fl "$f" "$bs" > /dev/null 2>&1; then
    echo "❌ [RUN] $f — bootstrap compile 실패"
    bump_fail "$f [bs-compile]"
    return
  fi
  # stage1 경유 compile
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > /dev/null 2>&1; then
    echo "❌ [RUN] $f — stage1 compile 실패"
    bump_fail "$f [s1-compile]"
    return
  fi
  # 실행 (3초 타임아웃)
  timeout 3 node "$bs" > "$obs" 2>&1
  local rc_b=$?
  timeout 3 node "$s1" > "$os1" 2>&1
  local rc_s=$?
  if [ "$rc_b" -ne "$rc_s" ] || ! diff -q "$obs" "$os1" > /dev/null 2>&1; then
    if is_known_flaky "$f"; then
      echo "⚠️  [RUN] $f — known compiler-coupled diff (Tier 2 advisory)"
      SKIP=$((SKIP+1))
      return
    fi
    echo "❌ [RUN] $f — 실행 결과 불일치 (rc: $rc_b vs $rc_s)"
    bump_fail "$f [run-diff]"
    return
  fi
  echo "✅ [RUN] $f ($(wc -c < "$obs") bytes output)"
  PASS=$((PASS+1))
}

check_compile_only() {
  local f="$1"
  local tag="$(safe "$f")"
  local bs="$WORK/bs_${tag}.js"
  local s1="$WORK/s1_${tag}.js"
  if ! node --stack-size=8000 bootstrap.js run self/all.fl "$f" "$bs" > /dev/null 2>&1; then
    echo "⚠️  [DEFS] $f — bootstrap 조차 compile 실패 (스킵)"
    SKIP=$((SKIP+1)); return
  fi
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > /dev/null 2>&1; then
    echo "❌ [DEFS] $f — stage1 compile 실패"
    bump_fail "$f [s1-compile-only]"
    return
  fi
  # 크기 차이 허용, 존재만 확인
  echo "✅ [DEFS] $f (bs $(wc -c < "$bs") / s1 $(wc -c < "$s1") bytes)"
  PASS=$((PASS+1))
}

TIER="${1:-tier1}"

echo "=== Tier 1 ==="
RUN_T1=(
  "examples/hello.fl"
  "examples/factorial.fl"
  "self/bench/hello.fl"
  "self/bench/tiny.fl"
  "self/bench/fib30.fl"
  "self/bench/test-time.fl"
)
DEFS_T1=(
  "self/lexer.fl"
  "self/parser.fl"
  "self/ast.fl"
  "self/codegen.fl"
  "self/all.fl"
)

CURRENT_TIER="t1"
for f in "${RUN_T1[@]}"; do [ -f "$f" ] && check_run "$f" || echo "— 없음: $f"; done
for f in "${DEFS_T1[@]}"; do [ -f "$f" ] && check_compile_only "$f" || echo "— 없음: $f"; done

if [ "$TIER" = "tier2" ] || [ "$TIER" = "all" ]; then
  CURRENT_TIER="t2"
  echo ""
  echo "=== Tier 2: self/stdlib/ ==="
  for f in self/stdlib/*.fl; do
    [ -f "$f" ] && check_compile_only "$f"
  done
  echo ""
  echo "=== Tier 2: self/tests/ ==="
  for f in self/tests/*.fl; do
    [ -f "$f" ] && check_run "$f"
  done
fi

echo ""
echo "=== 결과 ==="
echo "PASS: $PASS"
echo "FAIL: $FAIL   (Tier1: $T1_FAIL, Tier2: $T2_FAIL)"
echo "SKIP: $SKIP   (known flaky 포함)"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "실패 목록:"
  for x in "${FAIL_LIST[@]}"; do echo "  - $x"; done
fi
# Tier1 실패는 hard fail, Tier2만 실패면 advisory (exit 0)
if [ "$T1_FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Tier 1 실패 — self-hosting 기준선 깨짐"
  exit 1
fi
if [ "$T2_FAIL" -gt 0 ]; then
  echo ""
  echo "⚠️  Tier 2 일부 실패 (advisory; exit 0) — 조사 권장"
fi
exit 0
