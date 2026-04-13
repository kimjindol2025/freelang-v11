#!/bin/bash

# FreeLang v9 공식 홈페이지 시작 스크립트

PORT=${1:-3000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 FreeLang v9 공식 홈페이지 시작..."
echo "📍 포트: $PORT"
echo "📂 위치: $SCRIPT_DIR"
echo ""
echo "💡 Tip: 브라우저에서 http://localhost:$PORT 방문"
echo ""

# 홈페이지 실행
cd "$SCRIPT_DIR"

# v9 CLI가 설치되어 있으면 사용
if command -v v9 &> /dev/null; then
    echo "✅ v9 CLI 감지됨, 사용 중..."
    PORT=$PORT v9 main.fl
else
    echo "⚠️  v9 CLI를 찾을 수 없습니다."
    echo "📦 설치: npm install -g freelang-v9"
    echo ""
    echo "또는 소스에서 실행:"

    # 소스에서 실행 시도
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    if [ -f "$PROJECT_ROOT/src/cli.ts" ]; then
        echo "📂 프로젝트 루트: $PROJECT_ROOT"
        cd "$PROJECT_ROOT"
        PORT=$PORT npx ts-node src/cli.ts homepage/main.fl
    else
        echo "❌ FreeLang v9 소스를 찾을 수 없습니다."
        echo "📍 프로젝트 루트에서 실행해주세요: v9 homepage/main.fl"
        exit 1
    fi
fi
