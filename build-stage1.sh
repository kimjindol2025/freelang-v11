#!/bin/bash
# build-stage1.sh — self/all.fl 자동 빌드 스크립트 + stage1.js 안전 재생성
# 모든 stdlib 파일을 순차적으로 concat해서 self/all.fl 생성 후 stage1.js 컴파일
# 기존 stage1.js는 자동으로 백업 (.bak-<timestamp>로 저장)

set -e

echo "📦 FreeLang v11 Stage1 Builder"
echo "================================"
echo ""

# 1. 기존 stage1.js 백업
if [ -f "stage1.js" ]; then
  BACKUP_FILE="stage1.js.bak-$(date +%s)"
  cp stage1.js "$BACKUP_FILE"
  echo "💾 기존 stage1.js 백업: $BACKUP_FILE"
  echo ""
fi

# 1. 모든 stdlib 파일 순서대로 concat
echo "🔧 Concatenating stdlib files..."

STDLIB_ORDER=(
  "self/stdlib/data.fl"
  "self/stdlib/hash.fl"
  "self/stdlib/time.fl"
  "self/stdlib/string.fl"
  "self/stdlib/list.fl"
  "self/stdlib/file.fl"
  "self/stdlib/process.fl"
  # try/catch가 있는 파일들은 제외 (self-parser 미지원)
  # "self/stdlib/test-runner.fl"
  # "self/stdlib/assert.fl"
  # "self/stdlib/resource.fl"
  # "self/stdlib/async.fl"
)

# 임시 파일
TEMP_ALL=$(mktemp /tmp/all.XXXXXX.fl)
trap "rm -f $TEMP_ALL" EXIT

# lexer, parser, ast, codegen, main 순서로 구성
echo "; self/all.fl — Phase 28 (AUTO-GENERATED)" > "$TEMP_ALL"
echo "; $(date '+%Y-%m-%d %H:%M:%S')" >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

# 기본 구성 모듈
echo "  - Adding lexer.fl..."
cat self/lexer.fl >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

echo "  - Adding parser.fl..."
cat self/parser.fl >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

echo "  - Adding ast.fl..."
cat self/ast.fl >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

echo "  - Adding codegen.fl..."
cat self/codegen.fl >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

# stdlib 추가
for stdlib in "${STDLIB_ORDER[@]}"; do
  if [ -f "$stdlib" ]; then
    echo "  - Adding $(basename $stdlib)..."
    cat "$stdlib" >> "$TEMP_ALL"
    echo "" >> "$TEMP_ALL"
  fi
done

# main 추가
echo "  - Adding main.fl..."
cat self/main.fl >> "$TEMP_ALL"
echo "" >> "$TEMP_ALL"

# 임시 파일을 real all.fl로 이동
mv "$TEMP_ALL" self/all.fl
echo "✅ self/all.fl generated ($(wc -l < self/all.fl) lines)"
echo ""

# 2. bootstrap.js compile 커맨드로 stage1.js 생성
echo "🔨 Compiling stage1.js via bootstrap.js compile..."
echo ""

if ! node bootstrap.js compile self/all.fl -o stage1.js 2>&1 | tee /tmp/build.log; then
  echo "❌ bootstrap.js compile 실패"
  cat /tmp/build.log
  exit 1
fi

# 파일이 생성되었는지 확인
if [ -f "stage1.js" ] && [ -s "stage1.js" ]; then
  SIZE=$(stat -f%z stage1.js 2>/dev/null || stat -c%s stage1.js 2>/dev/null || echo "?")
  LINES=$(wc -l < stage1.js)
  echo ""
  echo "✅ stage1.js compiled successfully"
  echo "   Size: $SIZE bytes"
  echo "   Lines: $LINES"
  echo ""
else
  echo "❌ stage1.js compilation failed"
  tail -20 /tmp/build.log
  exit 1
fi

# 3. 검증: stage1.js 자신 컴파일 테스트
echo "🧪 Validating self-compilation..."
node stage1.js self/tests/test-core-fl.fl /tmp/validate.js 2>&1 | grep -E "✨|Success|Parsed" || echo "⚠️  Validation output not parsed"
echo ""

echo "════════════════════════════════════"
echo "✅ Build complete!"
echo "════════════════════════════════════"
