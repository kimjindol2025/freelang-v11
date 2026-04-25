#!/bin/bash
# scripts/fl-repl.sh — Y4-3 단계B (self/runtime 직접 실행)
#
# 사용:
#   bash scripts/fl-repl.sh
#   FL_REPL_BOOTSTRAP=1 bash scripts/fl-repl.sh   # bootstrap.js fallback
#
# 단계A: src/interpreter.ts → self/runtime/interpreter.js 추출 (esbuild)
# 단계B: self/runtime/repl.js 작성 — readline + Interpreter wrapper
# → bootstrap.js 의존 없이 REPL 진입 가능

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$REPO/self/runtime/repl.js"

if [ "${FL_REPL_BOOTSTRAP:-0}" = "1" ] || [ ! -f "$RUNTIME" ]; then
  exec node --stack-size=8000 "$REPO/bootstrap.js" repl "$@"
fi

exec node --stack-size=8000 "$RUNTIME" "$@"
