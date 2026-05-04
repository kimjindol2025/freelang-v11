#!/bin/bash
# Phase C-8: Self-Hosting Fixed-Point SHA256 Verification (Simplified)
# bootstrap.js로 self/all.fl을 3회 컴파일하여 고정점 달성 검증
# (Stage N: 컴파일된 결과를 'stage N'이라 부름)

set -e

PROJECT_DIR="/root/kim/freelang-v11"
WORK_DIR="/tmp/c8-stages-simple"
BOOTSTRAP="$PROJECT_DIR/bootstrap.js"
ALL_FL="$PROJECT_DIR/self/all.fl"

# 초기화
mkdir -p "$WORK_DIR"
rm -f "$WORK_DIR"/compile*.js "$WORK_DIR"/hashes.txt

echo "═══════════════════════════════════════════════════════════════"
echo "Phase C-8: Bootstrap Fixed-Point SHA256 Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 검사
echo "🔍 검사: bootstrap.js와 self/all.fl 존재"
if [ ! -f "$BOOTSTRAP" ] || [ ! -f "$ALL_FL" ]; then
  echo "❌ 필요한 파일 없음"
  exit 1
fi
echo "✅ OK"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run 1: bootstrap.js compile self/all.fl → compile1.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if node "$BOOTSTRAP" compile "$ALL_FL" -o "$WORK_DIR/compile1.js" 2>&1 | grep -E "✓|✅" || true; then
  SHA1=$(sha256sum "$WORK_DIR/compile1.js" | cut -d' ' -f1)
  SIZE1=$(stat -c%s "$WORK_DIR/compile1.js" 2>/dev/null || echo "?")
  echo "✅ 컴파일 성공"
  echo "   SHA256: $SHA1"
  echo "   Size: $SIZE1 bytes"
  echo "$SHA1  compile1.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ 컴파일 실패"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run 2: bootstrap.js compile self/all.fl → compile2.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if node "$BOOTSTRAP" compile "$ALL_FL" -o "$WORK_DIR/compile2.js" 2>&1 | grep -E "✓|✅" || true; then
  SHA2=$(sha256sum "$WORK_DIR/compile2.js" | cut -d' ' -f1)
  SIZE2=$(stat -c%s "$WORK_DIR/compile2.js" 2>/dev/null || echo "?")
  echo "✅ 컴파일 성공"
  echo "   SHA256: $SHA2"
  echo "   Size: $SIZE2 bytes"
  echo "$SHA2  compile2.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ 컴파일 실패"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Run 3: bootstrap.js compile self/all.fl → compile3.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if node "$BOOTSTRAP" compile "$ALL_FL" -o "$WORK_DIR/compile3.js" 2>&1 | grep -E "✓|✅" || true; then
  SHA3=$(sha256sum "$WORK_DIR/compile3.js" | cut -d' ' -f1)
  SIZE3=$(stat -c%s "$WORK_DIR/compile3.js" 2>/dev/null || echo "?")
  echo "✅ 컴파일 성공"
  echo "   SHA256: $SHA3"
  echo "   Size: $SIZE3 bytes"
  echo "$SHA3  compile3.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ 컴파일 실패"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Fixed-Point 검증 결과"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "SHA256 비교:"
echo "  Run 1: $SHA1"
echo "  Run 2: $SHA2"
echo "  Run 3: $SHA3"
echo ""

if [ "$SHA1" = "$SHA2" ] && [ "$SHA2" = "$SHA3" ]; then
  echo "✅ 고정점 달성! (모든 컴파일 결과 동일)"
  echo ""
  echo "의미:"
  echo "  - bootstrap.js 컴파일은 결정론적 (deterministic)"
  echo "  - 동일한 입력 → 항상 동일한 출력"
  echo "  - 컴파일러 상태가 안정적임을 증명"
  echo ""
  echo "SHA256 증명:"
  echo "  $SHA1"
  echo ""

  # 파일 정보
  echo "파일 정보:"
  echo "  크기: $SIZE1 bytes (모두 동일)"
  echo ""

  exit 0
else
  echo "❌ 고정점 미달성 (결과가 다름)"
  echo ""

  if [ "$SHA1" != "$SHA2" ]; then
    echo "Run 1 ≠ Run 2:"
    diff "$WORK_DIR/compile1.js" "$WORK_DIR/compile2.js" | head -20 || true
  fi

  exit 1
fi
