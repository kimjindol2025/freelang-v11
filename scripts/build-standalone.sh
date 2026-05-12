#!/usr/bin/env bash
# FreeLang standalone 바이너리 빌드 (Bun)
# 결과: ./freelang (Node.js 없이 실행 가능)
set -e

if ! command -v bun &>/dev/null; then
  echo "❌ bun이 없습니다. https://bun.sh 에서 설치하세요."
  exit 1
fi

echo "📦 FreeLang standalone 바이너리 빌드 중..."
bun build bootstrap.js --compile --outfile freelang
echo "✅ ./freelang 생성 완료 ($(du -h freelang | cut -f1))"
echo ""
echo "사용법:"
echo "  ./freelang run app.fl"
echo "  ./freelang compile app.fl -o app.js"
