#!/bin/bash

echo "=== L2 고정점 검증 시작 ==="
echo ""

# Step 1: L0 → L1: bootstrap.js로 codegen.fl 컴파일
echo "[Step 1] L0 → L1: bootstrap.js로 codegen.fl 컴파일"
node bootstrap.js compile self/codegen.fl > /tmp/L1_codegen.js 2>/dev/null
if [ $? -ne 0 ]; then
  echo "❌ L1 생성 실패"
  exit 1
fi
echo "✅ L1_codegen.js 생성 ($(wc -c < /tmp/L1_codegen.js) bytes)"
echo ""

# Step 2: L1 → L2: L1_codegen.js로 codegen.fl 컴파일
echo "[Step 2] L1 → L2: L1_codegen.js로 codegen.fl 컴파일"
node /tmp/L1_codegen.js compile self/codegen.fl > /tmp/L2_codegen.js 2>/dev/null
if [ $? -ne 0 ]; then
  echo "❌ L2 생성 실패"
  exit 1
fi
echo "✅ L2_codegen.js 생성 ($(wc -c < /tmp/L2_codegen.js) bytes)"
echo ""

# Step 3: L2 → L3: L2_codegen.js로 codegen.fl 컴파일
echo "[Step 3] L2 → L3: L2_codegen.js로 codegen.fl 컴파일"
node /tmp/L2_codegen.js compile self/codegen.fl > /tmp/L3_codegen.js 2>/dev/null
if [ $? -ne 0 ]; then
  echo "❌ L3 생성 실패"
  exit 1
fi
echo "✅ L3_codegen.js 생성 ($(wc -c < /tmp/L3_codegen.js) bytes)"
echo ""

# Step 4: L2 vs L3 비교
echo "[Step 4] L2 vs L3 고정점 비교"
echo ""
echo "L2 MD5: $(md5sum /tmp/L2_codegen.js | cut -d' ' -f1)"
echo "L3 MD5: $(md5sum /tmp/L3_codegen.js | cut -d' ' -f1)"
echo ""

if diff -q /tmp/L2_codegen.js /tmp/L3_codegen.js > /dev/null 2>&1; then
  echo "✅ L2 = L3 (고정점 달성!)"
  echo ""
  echo "🎉 L2 고정점 검증 완료: 100% 동일"
  exit 0
else
  echo "❌ L2 ≠ L3 (고정점 미달성)"
  echo ""
  echo "차이 분석:"
  diff /tmp/L2_codegen.js /tmp/L3_codegen.js | head -50
  exit 1
fi
