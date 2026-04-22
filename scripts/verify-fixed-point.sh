#!/bin/bash
# verify-fixed-point.sh — Stage1~5 고정점(결정론성) 검증
# Phase C: 자가호스팅 고정점 확인 (SHA256 체인)

set -e

echo "════════════════════════════════════════════"
echo "  FreeLang v11 Fixed-Point Verification"
echo "════════════════════════════════════════════"
echo ""

# 현재 stage1.js 백업
BACKUP="stage1.js.bak.verify-$(date +%s)"
cp stage1.js "$BACKUP"
echo "💾 Backed up stage1.js → $BACKUP"
echo ""

# Stage 체인 생성 (5단계)
echo "🔗 Generating stage chain (1-5)..."
declare -a STAGES
STAGES[1]="stage1.js"  # 기존

for i in {2..5}; do
  STAGES[$i]="stage$i.js"
  echo "  ▸ Compiling stage$i.js..."
  node bootstrap.js compile self/all.fl -o "${STAGES[$i]}" 2>&1 | grep -E "✓|완료" || true
done

echo ""
echo "📊 SHA256 Chain:"

declare -a HASHES
PASS=0
FAIL=0

for i in {1..5}; do
  HASH=$(sha256sum "${STAGES[$i]}" | cut -d' ' -f1)
  HASHES[$i]="$HASH"
  SHORT="${HASH:0:16}"

  if [ $i -eq 1 ]; then
    echo "stage$i: $SHORT... (baseline)"
    PASS=$((PASS + 1))
  else
    if [ "${HASHES[$i]}" = "${HASHES[1]}" ]; then
      echo "stage$i: $SHORT... ✅"
      PASS=$((PASS + 1))
    else
      echo "stage$i: $SHORT... ❌ (differs from stage1)"
      FAIL=$((FAIL + 1))
    fi
  fi
done

echo ""
echo "════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo "✅ Fixed-Point Verified: $PASS/5 stages match"
  echo "   Deterministic compilation confirmed"
  exit 0
else
  echo "❌ Fixed-Point Failed: $FAIL divergence(s) detected"
  echo "   Check codegen/stdlib for non-determinism"
  exit 1
fi
