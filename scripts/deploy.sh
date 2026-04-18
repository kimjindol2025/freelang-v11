#!/bin/bash
# FreeLang v11 배포 자동화

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  FreeLang v11 배포 자동화 시작                            ║"
echo "╚════════════════════════════════════════════════════════════╝"

# 1. 환경 설정
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-43011}
export LOG_LEVEL=${LOG_LEVEL:-info}

echo ""
echo "📋 단계 1: 사전 검사"
echo "  - Node.js 버전: $(node --version)"
echo "  - npm 버전: $(npm --version)"
echo "  - 환경: $NODE_ENV"
echo "  - 포트: $PORT"

# 2. 테스트 실행
echo ""
echo "📋 단계 2: 테스트 실행"
npm test || { echo "❌ 테스트 실패"; exit 1; }
echo "  ✅ 모든 테스트 통과"

# 3. 빌드
echo ""
echo "📋 단계 3: 빌드"
npm run build 2>/dev/null || echo "  ℹ️  빌드 스크립트 없음 (bootstrap.js 사용)"

# 4. 의존성 확인
echo ""
echo "📋 단계 4: 의존성 확인"
if grep -q "\"dependencies\"" package.json; then
  DEPS=$(grep -c "\":" package.json)
  echo "  ⚠️  의존성 감지됨: $DEPS개"
else
  echo "  ✅ 의존성 0 (완전 독립)"
fi

# 5. 파일 무결성 확인
echo ""
echo "📋 단계 5: 파일 무결성 확인"
if [ ! -f "bootstrap.js" ]; then
  echo "  ❌ bootstrap.js 없음"
  exit 1
fi
echo "  ✅ bootstrap.js ($(du -h bootstrap.js | cut -f1))"

if [ ! -d "self/stdlib" ]; then
  echo "  ❌ self/stdlib 없음"
  exit 1
fi
MODULES=$(ls -1 self/stdlib/*.fl 2>/dev/null | wc -l)
echo "  ✅ stdlib 모듈: $MODULES개"

# 6. 배포 준비
echo ""
echo "📋 단계 6: 배포 준비"
mkdir -p logs
mkdir -p app
echo "  ✅ 디렉토리 준비"

# 7. 성능 정보
echo ""
echo "📋 단계 7: 성능 정보"
echo "  - Bootstrap 크기: $(du -h bootstrap.js | cut -f1)"
echo "  - Stdlib 코드량: $(cat self/stdlib/*.fl 2>/dev/null | wc -l) 줄"
echo "  - 총 모듈: $(ls -1 self/stdlib/*.fl 2>/dev/null | wc -l)개"

# 8. 최종 확인
echo ""
echo "📋 단계 8: 최종 확인"
echo "  ✅ 배포 준비 완료"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  배포 시작                                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "명령어:"
echo "  npm start                           # 기본 시작"
echo "  PORT=3000 npm start                 # 포트 변경"
echo "  npm run dev                         # 개발 모드"
echo "  npm run dev:watch                   # 핫 리로드"
echo ""

# 9. 서버 시작
node bootstrap.js serve app/ 2>&1 | tee logs/$(date +%Y%m%d-%H%M%S).log
