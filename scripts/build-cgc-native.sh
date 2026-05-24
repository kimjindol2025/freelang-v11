#!/bin/bash
# build-cgc-native.sh — Native FreeLang Compiler Builder
# 목표: C 코드 → 네이티브 바이너리 (Node/Bun 없음)
# 사용: ./build-cgc-native.sh <input.c> <output-bin>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$REPO_ROOT/runtime"

if [[ $# -lt 2 ]]; then
  echo "사용: $0 <input.c> <output-bin>"
  echo ""
  echo "예시:"
  echo "  $0 /tmp/gen1.c /tmp/gen1-bin"
  exit 1
fi

INPUT_C="$1"
OUTPUT_BIN="$2"

if [[ ! -f "$INPUT_C" ]]; then
  echo "오류: 입력 파일을 찾을 수 없습니다: $INPUT_C"
  exit 1
fi

# 런타임 모듈 확인
RUNTIME_MODULES=(
  "core.c"
  "collection.c"
  "io.c"
  "math.c"
  "error.c"
  "process.c"
  "json.c"
  "cgc-bridge.c"
)

for module in "${RUNTIME_MODULES[@]}"; do
  if [[ ! -f "$RUNTIME_DIR/$module" ]]; then
    echo "오류: 런타임 모듈 없음: $RUNTIME_DIR/$module"
    exit 1
  fi
done

# 컴파일 명령
RUNTIME_SOURCES=""
for module in "${RUNTIME_MODULES[@]}"; do
  RUNTIME_SOURCES="$RUNTIME_SOURCES $RUNTIME_DIR/$module"
done

echo "컴파일 중: $INPUT_C → $OUTPUT_BIN"
gcc -Wall -Wextra \
  -I "$RUNTIME_DIR" \
  -o "$OUTPUT_BIN" \
  "$INPUT_C" \
  $RUNTIME_SOURCES \
  -lm

if [[ $? -eq 0 ]]; then
  echo "✅ 성공: $OUTPUT_BIN ($(stat --format=%s "$OUTPUT_BIN") bytes)"
  echo ""
  echo "런타임 확인:"
  ldd "$OUTPUT_BIN" | grep -E "libm|libc|ld-linux" | head -3
  echo ""
  echo "사용: $OUTPUT_BIN <input.fl> <output.c>"
else
  echo "❌ 컴파일 실패"
  exit 1
fi
