#!/bin/bash
# scripts/fl-serve.sh — Y4 단계2 wrapper (FL 웹 서버 시작)
#
# 사용:
#   bash scripts/fl-serve.sh                    # ./app, port 3000
#   bash scripts/fl-serve.sh app/ --port 8080   # 디렉토리 + 포트
#   bash scripts/fl-serve.sh --mode isr         # SSR/ISR/SSG 선택
#
# 현황 (2026-04-25):
#   stage1 codegen 산출물의 server_* primitive 는 stub (return null).
#   진짜 HTTP 서버는 src/stdlib-http-server.ts (interpreter-bound) 가 제공.
#   따라서 현 단계는 bootstrap.js cli 로 fallback.
#
# Y4 단계2 풀 이관 계획:
#   - stage1 codegen prelude 에 runtime require 한 줄 추가
#   - self/runtime/http-server.js 분리 (현 src/stdlib-http-server.ts → JS module)
#   - 산출물에서 const __http = require('./runtime/http-server')(); 로 inject
#   - 그 후 server_* 가 stub → 실 동작으로 전환

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# 현 단계: bootstrap.js cli serve 로 직접 위임 (안전)
exec node --stack-size=8000 "$REPO/bootstrap.js" serve "$@"
