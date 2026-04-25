#!/bin/bash
# scripts/fl-repl.sh — Y4 단계3 wrapper (FL REPL 시작)
#
# 사용:
#   bash scripts/fl-repl.sh
#
# 현황 (2026-04-25):
#   REPL 은 Interpreter 인스턴스 + 영속 세션 (define/defn 누적).
#   stage1 산출물은 사전 컴파일된 JS 만 실행하므로 동적 평가 불가능.
#   따라서 현 단계는 bootstrap.js cli 로 fallback.
#
# Y4 단계3 풀 이관 계획 (1주+):
#   옵션 A — self/repl.fl: lex/parse/eval 전부 FL 로 작성 (evaluator 신규)
#   옵션 B — self/runtime/interpreter.js 로 src/interpreter.ts 분리,
#           stage1 prelude 에서 require → REPL 산출물이 인터프리터 임포트
#   현 시점 권장: 옵션 B (작업량 적음)

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"

exec node --stack-size=8000 "$REPO/bootstrap.js" repl "$@"
