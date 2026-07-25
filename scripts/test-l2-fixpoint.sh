#!/bin/bash

echo "=== L2 고정점 검증 시작 ==="
echo ""

# Step 1: L0 → L1: bootstrap.js로 완결 단일 컴파일러(all.fl) 컴파일
echo "[Step 1] L0 → L1: bootstrap.js로 all.fl 컴파일"
node bootstrap.js compile self/all.fl -o /tmp/L1_all.js >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ L1 생성 실패"
  exit 1
fi
echo "✅ L1_all.js 생성 ($(wc -c < /tmp/L1_all.js) bytes)"
echo ""

# Step 2: L1 → L2: L1_all.js를 독립 CLI로 실행
echo "[Step 2] L1 → L2: L1_all.js로 all.fl 컴파일"
node /tmp/L1_all.js compile self/all.fl -o /tmp/L2_all.js >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ L2 생성 실패"
  exit 1
fi
echo "✅ L2_all.js 생성 ($(wc -c < /tmp/L2_all.js) bytes)"
echo ""

# Step 3: L2 → L3: L2_all.js를 독립 CLI로 실행
echo "[Step 3] L2 → L3: L2_all.js로 all.fl 컴파일"
node /tmp/L2_all.js compile self/all.fl -o /tmp/L3_all.js >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ L3 생성 실패"
  exit 1
fi
echo "✅ L3_all.js 생성 ($(wc -c < /tmp/L3_all.js) bytes)"
echo ""

# Step 4: L2 vs L3 비교
echo "[Step 4] L2 vs L3 고정점 비교"
echo ""
echo "L2 MD5: $(md5sum /tmp/L2_all.js | cut -d' ' -f1)"
echo "L3 MD5: $(md5sum /tmp/L3_all.js | cut -d' ' -f1)"
echo ""

if diff -q /tmp/L2_all.js /tmp/L3_all.js > /dev/null 2>&1; then
  echo "✅ L2 = L3 (고정점 달성!)"
  echo ""
  echo "🎉 L2 고정점 검증 완료: 100% 동일"
  exit 0
else
  echo "❌ L2 ≠ L3 (고정점 미달성)"
  echo ""
  echo "차이 분석:"
  diff /tmp/L2_all.js /tmp/L3_all.js | head -50
  exit 1
fi
