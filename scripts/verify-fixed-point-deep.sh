#!/bin/bash
# verify-fixed-point-deep.sh — stage1 → stage_N self-host chain SHA256 검증
#
# 진정한 self-hosting 결정론 증명:
#   stage1.js  ─compile self/all.fl─→ stage2.js
#   stage2.js  ─compile self/all.fl─→ stage3.js
#   ...
#   stage_{N-1} ─compile self/all.fl─→ stage_N.js
#
# 모든 stage가 SHA256 동일하면 fixed-point 안정.
# 차이가 발생하면 비결정론 또는 codegen 버그.
#
# 사용:
#   bash scripts/verify-fixed-point-deep.sh         # depth=10 (기본)
#   bash scripts/verify-fixed-point-deep.sh 5       # depth=5
#   bash scripts/verify-fixed-point-deep.sh --json  # JSON 결과만
#
# 결과 저장: L2-PROOF-DEEP-RESULTS.json

set -e

cd "$(dirname "$0")/.."

DEPTH="${1:-10}"
JSON_ONLY=false
[ "$1" = "--json" ] && { DEPTH=10; JSON_ONLY=true; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if ! $JSON_ONLY; then
  echo "════════════════════════════════════════════"
  echo "  FreeLang v11 Deep Fixed-Point Verification"
  echo "  Chain depth: $DEPTH stages"
  echo "════════════════════════════════════════════"
  echo ""
fi

# stage1.js 존재 확인
if [ ! -f stage1.js ]; then
  echo "❌ stage1.js 없음. 먼저 npm run build 또는 bootstrap.js로 생성하세요." >&2
  exit 2
fi

# 첫 stage 복사
cp stage1.js "$WORK/stage1.js"
HASHES=()
HASHES[1]=$(sha256sum stage1.js | cut -d' ' -f1)

if ! $JSON_ONLY; then
  echo "🔗 Chain (stage_n → stage_{n+1} via self/all.fl):"
  echo "  stage1: ${HASHES[1]:0:16}... (baseline)"
fi

PASS=1
FAIL=0
T0=$(date +%s)

for i in $(seq 2 $DEPTH); do
  PREV=$((i - 1))
  PREV_PATH="$WORK/stage${PREV}.js"
  CUR_PATH="$WORK/stage${i}.js"

  # stage_{i-1}.js로 self/all.fl을 컴파일하여 stage_i.js 생성
  node --stack-size=8000 "$PREV_PATH" self/all.fl "$CUR_PATH" > /dev/null 2>&1 || {
    if ! $JSON_ONLY; then
      echo "  ❌ stage$i 생성 실패"
    fi
    FAIL=$((FAIL + 1))
    continue
  }

  HASHES[$i]=$(sha256sum "$CUR_PATH" | cut -d' ' -f1)
  SHORT="${HASHES[$i]:0:16}"

  if [ "${HASHES[$i]}" = "${HASHES[1]}" ]; then
    if ! $JSON_ONLY; then
      echo "  stage$i: $SHORT... ✅"
    fi
    PASS=$((PASS + 1))
  else
    if ! $JSON_ONLY; then
      echo "  stage$i: $SHORT... ❌ (differs from stage1)"
    fi
    FAIL=$((FAIL + 1))
  fi
done

ELAPSED=$(( $(date +%s) - T0 ))

if ! $JSON_ONLY; then
  echo ""
  echo "════════════════════════════════════════════"
  if [ $FAIL -eq 0 ]; then
    echo "✅ Deep Fixed-Point Verified: $PASS/$DEPTH stages match"
    echo "   stage1 SHA256: ${HASHES[1]}"
    echo "   Elapsed: ${ELAPSED}s"
  else
    echo "❌ Deep Fixed-Point Failed: $FAIL divergence(s)"
    echo "   stage1 SHA256: ${HASHES[1]}"
  fi
fi

# JSON 결과 저장
{
  echo "{"
  echo "  \"depth\": $DEPTH,"
  echo "  \"pass\": $PASS,"
  echo "  \"fail\": $FAIL,"
  echo "  \"elapsed_seconds\": $ELAPSED,"
  echo "  \"baseline_sha256\": \"${HASHES[1]}\","
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"stages\": ["
  for i in $(seq 1 $DEPTH); do
    SEP=","
    [ $i -eq $DEPTH ] && SEP=""
    MATCH="false"
    [ "${HASHES[$i]:-x}" = "${HASHES[1]}" ] && MATCH="true"
    echo "    {\"stage\": $i, \"sha256\": \"${HASHES[$i]:-null}\", \"match\": $MATCH}$SEP"
  done
  echo "  ]"
  echo "}"
} > L2-PROOF-DEEP-RESULTS.json

if ! $JSON_ONLY; then
  echo "   결과: L2-PROOF-DEEP-RESULTS.json"
fi

if $JSON_ONLY; then
  cat L2-PROOF-DEEP-RESULTS.json
fi

[ $FAIL -eq 0 ] && exit 0 || exit 1
