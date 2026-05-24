#!/bin/bash
# build-general-program.sh — General FL Program Linker (No cgc-bridge)
# 목표: 사용자 FL 프로그램 C 코드 → 네이티브 바이너리 (General Profile)
# 사용: ./build-general-program.sh <input.c> <output-bin>
# 참고: cgc-bridge.c 제외 (lex/parse 불필요, 사용자 프로그램용)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$REPO_ROOT/runtime"

if [[ $# -lt 2 ]]; then
  echo "사용: $0 <input.c> <output-bin>"
  echo ""
  echo "예시:"
  echo "  $0 /tmp/test-gen.c /tmp/test-bin"
  exit 1
fi

INPUT_C="$1"
OUTPUT_BIN="$2"

if [[ ! -f "$INPUT_C" ]]; then
  echo "오류: 입력 파일을 찾을 수 없습니다: $INPUT_C"
  exit 1
fi

# 런타임 모듈 확인 (General Profile: cgc-bridge.c 제외)
RUNTIME_MODULES=(
  "core.c"
  "collection.c"
  "io.c"
  "math.c"
  "error.c"
  "process.c"
  "json.c"
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

echo "컴파일 중 (General Profile): $INPUT_C → $OUTPUT_BIN"
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
  echo "사용: $OUTPUT_BIN [args...]"
else
  echo "❌ 컴파일 실패"
  exit 1
fi
