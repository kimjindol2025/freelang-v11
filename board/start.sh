#!/bin/bash

# 간단한 게시판 실행 스크립트

PORT=${1:-5000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 간단한 게시판 시작"
echo "   HTTP 포트: $PORT"
echo "   정적 파일: $SCRIPT_DIR/static"

cd "$SCRIPT_DIR"

# 정적 파일 서버를 백그라운드에서 실행
echo "[STATIC] Python HTTP 서버 시작 (포트 3000)..."
python3 -m http.server 3000 --directory ./static > /dev/null 2>&1 &
STATIC_PID=$!

# v9 서버 실행
PORT=$PORT node /data/data/com.termux/files/home/freelang-v9/dist/cli.js run "$SCRIPT_DIR/main.fl"

# 종료 시 정적 파일 서버도 종료
kill $STATIC_PID 2>/dev/null
