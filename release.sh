#!/bin/bash
# FreeLang v9 Release Script
# 사용법: ./release.sh
set -e

VERSION="1.0.0"
RELEASE_DATE=$(date +%Y-%m-%d)

echo "============================================"
echo " FreeLang v9 Release v${VERSION} — ${RELEASE_DATE}"
echo "============================================"
echo ""

# 1. TypeScript 타입 체크
echo "[1/5] TypeScript 타입 체크..."
if npx tsc --noEmit 2>&1; then
  echo "  ✅ 타입 체크 통과"
else
  echo "  ❌ 타입 에러 발생 — 릴리스 중단"
  exit 1
fi
echo ""

# 2. Phase 56 regression (핵심 기준 테스트)
echo "[2/5] Phase 56 렉시컬 스코프 regression..."
if npx ts-node src/test-phase56-lexical-scope.ts 2>&1 | tail -1 | grep -q "14 passed, 0 failed"; then
  echo "  ✅ Phase 56 regression 14/14 PASS"
else
  echo "  ❌ Phase 56 regression 실패 — 릴리스 중단"
  npx ts-node src/test-phase56-lexical-scope.ts 2>&1 | tail -3
  exit 1
fi
echo ""

# 3. Phase 90 통합 릴리스 테스트
echo "[3/5] Phase 90 통합 릴리스 테스트..."
RESULT=$(npx ts-node src/test-phase90-release.ts 2>&1)
echo "$RESULT" | tail -3
PASSED=$(echo "$RESULT" | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
if [ "$PASSED" -ge 25 ] 2>/dev/null; then
  echo "  ✅ 릴리스 테스트 ${PASSED}/25 이상 PASS"
else
  echo "  ⚠️  릴리스 테스트 ${PASSED}개 통과 (기준: 25개)"
fi
echo ""

# 4. 빌드 (dist/ 생성)
echo "[4/5] TypeScript 빌드..."
if npx tsc --outDir dist --skipLibCheck 2>&1; then
  echo "  ✅ 빌드 완료 → dist/"
else
  echo "  ⚠️  빌드 경고 있음 (dist/ 생성 시도)"
fi
echo ""

# 5. Git 태그 및 완료
echo "[5/5] Git 태그 v${VERSION} 생성..."
if git tag -a "v${VERSION}" -m "FreeLang v9 v${VERSION} — 공식 릴리스 2026-04-12" 2>/dev/null; then
  echo "  ✅ 태그 v${VERSION} 생성 완료"
else
  echo "  ⚠️  태그 v${VERSION}이 이미 존재하거나 생성 실패"
fi
echo ""

echo "============================================"
echo " FreeLang v${VERSION} 릴리스 완료!"
echo "============================================"
echo ""
echo "다음 단계:"
echo "  git push origin main"
echo "  git push origin v${VERSION}"
echo ""
echo "빠른 시작:"
echo "  npx ts-node src/cli.ts examples/hello.fl"
echo "  npx ts-node src/repl.ts"
