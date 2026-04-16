#!/bin/bash
# FreeLang v11 포트 체크 스크립트
# 30000~35000 범위에서 사용 가능한 포트 확인

echo "🔍 포트 상태 확인 (30000~35000)"
echo "════════════════════════════════════"
echo ""

# 컬러 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 포트 범위
START_PORT=30000
END_PORT=35000
AVAILABLE_PORTS=()

# 각 포트 체크
for PORT in $(seq $START_PORT $END_PORT); do
  if ! nc -z localhost $PORT 2>/dev/null; then
    AVAILABLE_PORTS+=($PORT)
  fi
done

echo "사용 가능한 포트 (처음 10개):"
echo ""

count=0
for PORT in "${AVAILABLE_PORTS[@]}"; do
  if [ $count -lt 10 ]; then
    echo -e "  ${GREEN}✓${NC} 포트 $PORT"
    ((count++))
  fi
done

echo ""
echo "════════════════════════════════════"
echo "총 사용 가능: ${#AVAILABLE_PORTS[@]}개 포트"
echo ""

if [ ${#AVAILABLE_PORTS[@]} -gt 0 ]; then
  FIRST_AVAILABLE=${AVAILABLE_PORTS[0]}
  echo -e "${GREEN}✅ 추천 포트: $FIRST_AVAILABLE${NC}"
  echo ""
  echo "사용 방법:"
  echo "  PORT=$FIRST_AVAILABLE npm run dev"
fi
