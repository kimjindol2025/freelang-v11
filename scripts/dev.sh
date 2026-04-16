#!/bin/bash
# FreeLang v11 개발 서버 자동 포트 할당 스크립트

echo ""
echo "🚀 FreeLang v11 개발 서버 시작..."
echo ""

# 포트 범위
START_PORT=30000
END_PORT=35000

# 사용 가능한 첫 번째 포트 찾기
ASSIGNED_PORT=""
for PORT in $(seq $START_PORT $END_PORT); do
  if ! nc -z localhost $PORT 2>/dev/null; then
    ASSIGNED_PORT=$PORT
    break
  fi
done

if [ -z "$ASSIGNED_PORT" ]; then
  echo "❌ 사용 가능한 포트가 없습니다 (30000~35000)"
  echo "다른 포트를 지정해주세요:"
  echo "  PORT=30000 npm run dev"
  exit 1
fi

echo "📍 자동 할당 포트: $ASSIGNED_PORT"
echo ""
echo "🔗 접근 URL:"
echo "  http://localhost:$ASSIGNED_PORT"
echo ""
echo "💡 Ctrl+C 로 서버 중지"
echo ""

# 환경변수로 포트 지정하고 서버 실행
PORT=$ASSIGNED_PORT npm run dev
