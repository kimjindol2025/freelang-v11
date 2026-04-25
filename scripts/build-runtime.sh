#!/bin/bash
# scripts/build-runtime.sh — Y4-2 풀 이관 단계A
#
# src/stdlib-*.ts 의 일부 모듈을 self/runtime/*.js 로 빌드.
# stage1 산출물에서 require() 가능한 단일 출처 모듈.
#
# 사용:
#   bash scripts/build-runtime.sh            # 모두 재빌드
#
# 빌드 대상:
#   src/stdlib-http-server.ts → self/runtime/http-server.js  (HTTP 서버)
#
# 향후 (Y4-3):
#   src/interpreter.ts + eval-*.ts → self/runtime/interpreter.js  (REPL/dynamic eval)

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ESBUILD="$REPO/node_modules/.bin/esbuild"

if [ ! -x "$ESBUILD" ]; then
  echo "esbuild not found. Run npm install first." >&2
  exit 2
fi

mkdir -p "$REPO/self/runtime"

echo "[build-runtime] http-server.js"
"$ESBUILD" "$REPO/src/stdlib-http-server.ts" \
  --bundle --platform=node --format=cjs \
  --outfile="$REPO/self/runtime/http-server.js" \
  --external:http --external:url --external:crypto \
  --log-level=warning

ls -la "$REPO/self/runtime/"
echo "✅ self/runtime/ 빌드 완료"
