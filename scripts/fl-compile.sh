#!/bin/bash
# FL → JS 컴파일 파이프라인
# 사용법: bash scripts/fl-compile.sh <input.fl> [<output.js>]

set -e
INPUT="$1"
OUTPUT="${2:-${INPUT}.out.js}"

if [ -z "$INPUT" ]; then
  echo "usage: $0 <input.fl> [<output.js>]" >&2
  exit 1
fi

node bootstrap.js run self/codegen.fl "$INPUT" "$OUTPUT"
