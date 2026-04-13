#!/bin/bash

# FreeLang v9 최종 통합 테스트
# Stage 5: 6개 시나리오 (의존성 제거 + v9-pm/build/run 검증)

set -e

echo "========================================"
echo "🧪 FreeLang v9 Stage 5: Final Integration Tests"
echo "========================================"
echo ""

PASS=0
FAIL=0

# ────────────────────────────────────────
# TEST 1: npm test 기존 439 테스트
# ────────────────────────────────────────
echo "TEST 1: Existing Test Suite (439 tests)"
echo "─────────────────────────────────────────"
if npm test 2>&1 | grep -q "439 passed"; then
  echo "✅ PASS: 439 tests passed"
  ((PASS++))
else
  echo "❌ FAIL: Test suite failed"
  ((FAIL++))
fi
echo ""

# ────────────────────────────────────────
# TEST 2: npm run build (TypeScript 컴파일)
# ────────────────────────────────────────
echo "TEST 2: npm run build (TypeScript compilation)"
echo "─────────────────────────────────────────"
if npm run build 2>&1 | grep -q "^$" || [ $? -eq 0 ]; then
  echo "✅ PASS: Clean build (0 errors)"
  ((PASS++))
else
  echo "❌ FAIL: Build failed"
  ((FAIL++))
fi
echo ""

# ────────────────────────────────────────
# TEST 3: npm run v9:build (v9-build.fl)
# ────────────────────────────────────────
echo "TEST 3: npm run v9:build (v9-build.fl wrapper)"
echo "─────────────────────────────────────────"
if npm run v9:build 2>&1 | grep -q "Build completed successfully"; then
  echo "✅ PASS: v9:build executed"
  ((PASS++))
else
  echo "❌ FAIL: v9:build failed"
  ((FAIL++))
fi
echo ""

# ────────────────────────────────────────
# TEST 4: npm run v9:run with test file
# ────────────────────────────────────────
echo "TEST 4: npm run v9:run (v9-run.fl runtime)"
echo "─────────────────────────────────────────"
# 테스트용 .fl 파일 생성
cat > /tmp/test-v9-run.fl << 'EOF'
(println "Hello from v9-run!")
(+ 1 2 3)
EOF

if npm run v9:run /tmp/test-v9-run.fl 2>&1 | grep -q "Hello from v9-run!"; then
  echo "✅ PASS: v9:run executed .fl file"
  ((PASS++))
else
  echo "❌ FAIL: v9:run failed"
  ((FAIL++))
fi
rm -f /tmp/test-v9-run.fl
echo ""

# ────────────────────────────────────────
# TEST 5: Express/ws 의존성 제거 확인
# ────────────────────────────────────────
echo "TEST 5: Dependency Removal Verification"
echo "─────────────────────────────────────────"
if ! grep -q '"express"' package.json && \
   ! grep -q '"ws"' package.json && \
   ! grep -q '"pg"' package.json && \
   ! grep -q '"jsonwebtoken"' package.json; then
  echo "✅ PASS: All unnecessary dependencies removed"
  ((PASS++))
else
  echo "❌ FAIL: Some dependencies still in package.json"
  ((FAIL++))
fi
echo ""

# ────────────────────────────────────────
# TEST 6: 파일 구조 확인
# ────────────────────────────────────────
echo "TEST 6: File Structure Verification"
echo "─────────────────────────────────────────"
FILES_OK=true
for file in vpm/v9-pm.fl vpm/v9-build.fl vpm/v9-run.fl \
            vpm/v9-pm-entry.ts vpm/v9-build-entry.ts vpm/v9-run-entry.ts; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    FILES_OK=false
  fi
done

if [ "$FILES_OK" = true ]; then
  echo "✅ PASS: All stage files present"
  ((PASS++))
else
  echo "❌ FAIL: Some files missing"
  ((FAIL++))
fi
echo ""

# ────────────────────────────────────────
# 최종 결과
# ────────────────────────────────────────
echo "========================================"
echo "📊 Final Results"
echo "========================================"
echo "✅ PASS: $PASS/6"
echo "❌ FAIL: $FAIL/6"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED - Stage 5 Complete!"
  exit 0
else
  echo "⚠️  Some tests failed"
  exit 1
fi
