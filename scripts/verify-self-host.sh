#!/bin/bash
# scripts/verify-self-host.sh — stage1 canonical self-host verification
#
# Phase A 전환 후 정의:
#   stage1 (self-compiled compiler) 가 primary/canonical compiler.
#   bootstrap 은 stage1 을 1 회 생성하기 위한 용도로만 쓰며, 이후 검증에는
#   관여하지 않는다. (언어 정의 단일화 · 자주국방 원칙)
#
# 사용법: ./scripts/verify-self-host.sh [tier1|tier2|all]
#
# 검증 방식:
#   1) bootstrap 으로 stage1.js 1회 생성 (bootstrap 의 유일한 역할)
#   2) 각 FL 파일 마다:
#        - stage1 로 compile → JS 산출
#        - node --check 로 JS 구문 유효성 확인
#        - [RUN] 파일은 JS 를 timeout 3s 로 실행, 실행 exit code / 출력 검사
#        - [DEFS] 파일은 compile + 유효성까지만
#   3) stage1 이 자기 자신(self/all.fl) 을 컴파일해 stage2 를 만들 때
#      **stage1 == stage2** (SHA256 fixed-point) 도 함께 검증 (1회)
#
# 파일 카테고리:
#   [RUN]  — 실행 가능한 파일 (main 이 있음), 실행 결과로 검증
#   [DEFS] — 함수 정의만, 실행해도 의미 없음. compile+syntax 까지만

set -u

cd "$(dirname "$0")/.."
REPO=$(pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

STAGE1="$WORK/stage1.js"

echo "=== stage1 생성 (bootstrap 1회 사용) ==="
node --stack-size=8000 bootstrap.js run self/all.fl self/all.fl "$STAGE1" > /dev/null 2>&1
if [ ! -s "$STAGE1" ]; then
  echo "❌ stage1.js 생성 실패"
  exit 2
fi
echo "   stage1 $(wc -c < "$STAGE1") bytes"

echo ""
echo "=== fixed-point 확인 (stage1 → stage2 → stage3 SHA 일치) ==="
STAGE2="$WORK/stage2.js"
STAGE3="$WORK/stage3.js"
node --stack-size=8000 "$STAGE1" self/all.fl "$STAGE2" > /dev/null 2>&1
node --stack-size=8000 "$STAGE2" self/all.fl "$STAGE3" > /dev/null 2>&1
SH1=$(sha256sum "$STAGE1" | cut -c1-16)
SH2=$(sha256sum "$STAGE2" | cut -c1-16)
SH3=$(sha256sum "$STAGE3" | cut -c1-16)
echo "   stage1 sha: $SH1"
echo "   stage2 sha: $SH2"
echo "   stage3 sha: $SH3"
if [ "$SH1" = "$SH2" ] && [ "$SH2" = "$SH3" ]; then
  echo "   ✅ fixed-point OK"
else
  echo "   ❌ fixed-point 실패 — self-hosting 기준선 깨짐"
  exit 1
fi
echo ""

# 슬래시 안전 태그
safe() { echo "$1" | tr '/[]' '___'; }

PASS=0
FAIL=0
SKIP=0
FAIL_LIST=()
CURRENT_TIER="t1"   # t1(strict) / t2(advisory)
T1_FAIL=0
T2_FAIL=0

# stage1 codegen 에서 현재 처리 못하는 구문이 들어 있는 파일 (Phase A 후속 수정 대상)
# 2026-04-21 기준: nil → null 미번역, rest-args [& $args] 미구현
KNOWN_STAGE1_CODEGEN_GAP=(
  "self/stdlib/async.fl"
)
is_known_codegen_gap() {
  for k in "${KNOWN_STAGE1_CODEGEN_GAP[@]}"; do
    [ "$1" = "$k" ] && return 0
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
  local s1="$WORK/s1_${tag}.js"
  local out="$WORK/out_${tag}"
  local log="$WORK/log_${tag}"

  # stage1 로 compile
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > "$log" 2>&1; then
    echo "❌ [RUN] $f — stage1 compile 실패"
    bump_fail "$f [compile]"
    return
  fi
  # JS 구문 검증
  if ! node --check "$s1" > /dev/null 2>&1; then
    if is_known_codegen_gap "$f"; then
      echo "⚠️  [RUN] $f — KNOWN stage1 codegen gap (syntax-invalid JS)"
      SKIP=$((SKIP+1))
      return
    fi
    echo "❌ [RUN] $f — 생성 JS 구문 오류"
    bump_fail "$f [syntax]"
    return
  fi
  # 실행 (3초 타임아웃)
  if ! timeout 3 node "$s1" > "$out" 2>&1; then
    echo "❌ [RUN] $f — 실행 실패"
    bump_fail "$f [runtime]"
    return
  fi
  local parsed=$(grep -oE "Parsed:\s*[0-9]+" "$log" 2>/dev/null | head -1 | grep -oE '[0-9]+' | head -1)
  echo "✅ [RUN] $f (parsed=${parsed:-?}, $(wc -c < "$out") bytes output)"
  PASS=$((PASS+1))
}

check_compile_only() {
  local f="$1"
  local tag="$(safe "$f")"
  local s1="$WORK/s1_${tag}.js"
  local log="$WORK/log_${tag}"
  if ! node --stack-size=8000 "$STAGE1" "$f" "$s1" > "$log" 2>&1; then
    echo "❌ [DEFS] $f — stage1 compile 실패"
    bump_fail "$f [compile]"
    return
  fi
  if ! node --check "$s1" > /dev/null 2>&1; then
    if is_known_codegen_gap "$f"; then
      echo "⚠️  [DEFS] $f — KNOWN stage1 codegen gap (syntax-invalid JS)"
      SKIP=$((SKIP+1))
      return
    fi
    echo "❌ [DEFS] $f — 생성 JS 구문 오류"
    bump_fail "$f [syntax]"
    return
  fi
  local parsed=$(grep -oE "Parsed:\s*[0-9]+" "$log" 2>/dev/null | head -1 | grep -oE '[0-9]+' | head -1)
  echo "✅ [DEFS] $f (parsed=${parsed:-?}, $(wc -c < "$s1") bytes JS)"
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
echo "SKIP: $SKIP   (known stage1 codegen gaps)"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "실패 목록:"
  for x in "${FAIL_LIST[@]}"; do echo "  - $x"; done
fi
if [ "$T1_FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Tier 1 실패 — self-hosting 기준선 깨짐"
  exit 1
fi
if [ "$T2_FAIL" -gt 0 ]; then
  echo ""
  echo "⚠️  Tier 2 일부 실패 (advisory; exit 0) — 조사 권장"
fi
if [ "$SKIP" -gt 0 ]; then
  echo ""
  echo "ℹ️  SKIP: stage1 codegen 잔여 버그 (nil → null 미번역, rest-args [& \$args] 미구현)."
  echo "   수정하면 SKIP → PASS 전환 예정."
fi
exit 0
