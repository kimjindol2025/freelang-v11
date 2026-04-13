#!/bin/bash

# notion-clone 실행 스크립트

PORT=${1:-4000}
WS_PORT=${2:-4001}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 v9-Notion 시작"
echo "   HTTP 포트: $PORT"
echo "   WebSocket 포트: $WS_PORT"

cd "$SCRIPT_DIR"

if command -v v9 &> /dev/null; then
    # v9가 전역으로 설치된 경우
    PORT=$PORT WS_PORT=$WS_PORT v9 run main.fl
else
    # 컴파일된 JS에서 실행
    cd /data/data/com.termux/files/home/freelang-v9
    PORT=$PORT WS_PORT=$WS_PORT node dist/cli.js run notion-clone/main.fl
fi
