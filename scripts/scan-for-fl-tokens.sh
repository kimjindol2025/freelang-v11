#!/bin/bash
# scan-for-fl-tokens.sh — FL Token Scanner Wrapper
# Usage: ./scripts/scan-for-fl-tokens.sh <file1.js> [<file2.js> ...]
# or: ./scripts/scan-for-fl-tokens.sh build/*.js

set -e

if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/scan-for-fl-tokens.sh <file.js> [<file2.js> ...]"
  echo "Example:"
  echo "  ./scripts/scan-for-fl-tokens.sh stage1.js stage2.js"
  echo "  ./scripts/scan-for-fl-tokens.sh build/*.js"
  exit 1
fi

# Node 스크립트 실행
node "$(dirname "$0")/scan-fl-tokens.js" "$@"
