#!/bin/bash
# Phase C-8: Self-Hosting Fixed-Point SHA256 Verification
# Stage 1 → Stage 2 → Stage 3 컴파일로 고정점 달성 검증

set -e

PROJECT_DIR="/root/kim/freelang-v11"
WORK_DIR="/tmp/c8-stages"
BOOTSTRAP="$PROJECT_DIR/bootstrap.js"
ALL_FL="$PROJECT_DIR/self/all.fl"

# 초기화
mkdir -p "$WORK_DIR"
rm -f "$WORK_DIR"/stage*.js "$WORK_DIR"/hashes.txt

echo "═══════════════════════════════════════════════════════════════"
echo "Phase C-8: Self-Hosting Fixed-Point SHA256 Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Stage 0: Check prerequisites
echo "🔍 검사: bootstrap.js 존재"
if [ ! -f "$BOOTSTRAP" ]; then
  echo "❌ bootstrap.js를 찾을 수 없음: $BOOTSTRAP"
  exit 1
fi
echo "✅ OK"

echo ""
echo "🔍 검사: self/all.fl 존재"
if [ ! -f "$ALL_FL" ]; then
  echo "❌ self/all.fl을 찾을 수 없음: $ALL_FL"
  exit 1
fi
echo "✅ OK"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 1: bootstrap.js compile (내장 parser) → stage1.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stage 1: Use built-in bootstrap.js
if node "$BOOTSTRAP" compile "$ALL_FL" -o "$WORK_DIR/stage1.js" 2>&1; then
  echo "✅ Stage 1 컴파일 성공"
  SHA1=$(sha256sum "$WORK_DIR/stage1.js" | cut -d' ' -f1)
  SIZE=$(stat -c%s "$WORK_DIR/stage1.js" 2>/dev/null || echo "?")
  echo "   SHA256: $SHA1"
  echo "   Size: $SIZE bytes"
  echo "$SHA1  stage1.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ Stage 1 컴파일 실패"
  ls -la "$WORK_DIR/stage1.js" 2>/dev/null || echo "파일 없음"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 2: stage1.js로 self/all.fl 재컴파일"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stage 2: Use stage1.js as runtime to compile all.fl
if node "$WORK_DIR/stage1.js" compile "$ALL_FL" -o "$WORK_DIR/stage2.js" > /tmp/stage2-build.log 2>&1; then
  echo "✅ Stage 2 컴파일 성공"
  SHA2=$(sha256sum "$WORK_DIR/stage2.js" | cut -d' ' -f1)
  SIZE2=$(stat -c%s "$WORK_DIR/stage2.js" 2>/dev/null || echo "?")
  echo "   SHA256: $SHA2"
  echo "   Size: $SIZE2 bytes"
  echo "$SHA2  stage2.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ Stage 2 컴파일 실패"
  echo "로그:"
  cat /tmp/stage2-build.log
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 3: stage2.js로 self/all.fl 다시 재컴파일"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stage 3: Use stage2.js as runtime to compile all.fl
if node "$WORK_DIR/stage2.js" compile "$ALL_FL" -o "$WORK_DIR/stage3.js" > /tmp/stage3-build.log 2>&1; then
  echo "✅ Stage 3 컴파일 성공"
  SHA3=$(sha256sum "$WORK_DIR/stage3.js" | cut -d' ' -f1)
  SIZE3=$(stat -c%s "$WORK_DIR/stage3.js" 2>/dev/null || echo "?")
  echo "   SHA256: $SHA3"
  echo "   Size: $SIZE3 bytes"
  echo "$SHA3  stage3.js" >> "$WORK_DIR/hashes.txt"
else
  echo "❌ Stage 3 컴파일 실패"
  echo "로그:"
  cat /tmp/stage3-build.log
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Fixed-Point 검증 결과"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "SHA256 비교:"
echo "  Stage 1: $SHA1"
echo "  Stage 2: $SHA2"
echo "  Stage 3: $SHA3"
echo ""

if [ "$SHA2" = "$SHA3" ]; then
  echo "✅ 고정점 달성!"
  echo ""
  echo "Stage 2 === Stage 3"
  echo "자체호스팅 완전성 증명: ✅"
  echo ""
  echo "의미:"
  echo "  - self/parser.fl이 올바르게 컴파일됨"
  echo "  - stage1.js와 stage2.js가 의미상 동일함"
  echo "  - 추가 컴파일은 결과를 변경하지 않음"

  # 파일 크기 비교
  echo ""
  echo "파일 크기:"
  ls -lh "$WORK_DIR"/stage*.js | awk '{print "  " $9 ": " $5}'

  exit 0
else
  echo "❌ 고정점 미달성"
  echo ""
  echo "Stage 2 ≠ Stage 3"
  echo "차이점:"
  diff "$WORK_DIR/stage2.js" "$WORK_DIR/stage3.js" | head -30 || true

  exit 1
fi
