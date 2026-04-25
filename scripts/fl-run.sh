#!/bin/bash
# scripts/fl-run.sh — stage1.js로 .fl 파일 compile + 즉시 실행 (bootstrap.js 우회)
#
# Y4 (Year 2 Q2) 점진 폐기: bootstrap.js의 'run' 명령을 stage1.js로 대체.
# 사용:
#   bash scripts/fl-run.sh my.fl              # 컴파일 후 실행
#   bash scripts/fl-run.sh my.fl arg1 arg2    # 추가 인자 전달
#
# 검증된 차이:
#   node bootstrap.js run X.fl    → interpret (직접 평가)
#   bash scripts/fl-run.sh X.fl   → compile (stage1) + node 실행 (2단계)
# → 결과 동일, bootstrap.js 의존 없음

set -e

if [ -z "$1" ]; then
  echo "사용: bash scripts/fl-run.sh <file.fl> [args...]" >&2
  exit 2
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="$1"
shift  # 나머지는 .fl 실행 인자

if [ ! -f "$INPUT" ]; then
  echo "파일 없음: $INPUT" >&2
  exit 2
fi

TMP="$(mktemp --suffix=.fl-out.js)"
trap 'rm -f "$TMP"' EXIT

# stage1.js로 컴파일
node --stack-size=8000 "$REPO/stage1.js" "$INPUT" "$TMP" > /dev/null 2>&1
if [ ! -s "$TMP" ]; then
  echo "compile 실패: $INPUT" >&2
  exit 1
fi

# 컴파일된 JS 실행 (인자 전달)
exec node --stack-size=8000 "$TMP" "$@"
