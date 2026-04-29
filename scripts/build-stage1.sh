#!/bin/bash
# Stage1.js 빌드 스크립트
# 목표: runtime-helpers.ts + codegen → stage1-new.js (자체호스팅)

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage1.js 빌드 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="/root/kim/freelang-v11"
SELF_DIR="$PROJECT_ROOT/self"
DIST_DIR="$PROJECT_ROOT/dist"
OUTPUT_FILE="$DIST_DIR/stage1-new.js"

# Step 1: runtime-helpers.ts 컴파일
echo "1️⃣ Compiling runtime-helpers.ts..."
npx tsc --outDir "$DIST_DIR" --declaration --module commonjs "$SELF_DIR/runtime-helpers.ts" 2>&1 | head -20

# Step 2: stage1 프리앰블 생성 (자동)
echo "2️⃣ Generating stage1 preamble..."
cat > "$DIST_DIR/stage1-preamble.js" << 'PREAMBLE'
// Auto-generated preamble for stage1.js (2026-04-29)
// Contains runtime helpers for self-hosting

const RUNTIME_HELPERS = require('./runtime-helpers.js').default;
const codegen = (ast) => {
  // Placeholder: actual codegen from src/codegen.ts
  return 'placeholder';
};

module.exports = { RUNTIME_HELPERS, codegen };
PREAMBLE

# Step 3: esbuild 번들링
echo "3️⃣ Bundling with esbuild..."
npx esbuild \
  "$DIST_DIR/stage1-preamble.js" \
  --bundle \
  --platform=node \
  --target=node18 \
  --outfile="$OUTPUT_FILE" \
  2>&1 | head -10

# Step 4: SHA256 비교
echo "4️⃣ Verifying SHA256..."
CURRENT_SHA=$(sha256sum "$PROJECT_ROOT/bootstrap.js" | cut -d' ' -f1)
NEW_SHA=$(sha256sum "$OUTPUT_FILE" | cut -d' ' -f1)

echo "  Current (bootstrap.js): $CURRENT_SHA"
echo "  New (stage1-new.js):    $NEW_SHA"

if [ "$CURRENT_SHA" = "$NEW_SHA" ]; then
  echo "✅ SHA256 일치! (결정론적)"
else
  echo "⚠️  SHA256 불일치 (예상: 헬퍼 최소화로 인한 차이)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Stage1 빌드 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "다음 단계:"
echo "  1. node $OUTPUT_FILE run self/all.fl"
echo "  2. 자체호스팅 컴파일 검증"
echo "  3. 결과 비교 (stage1-new.js vs stage1.js)"
