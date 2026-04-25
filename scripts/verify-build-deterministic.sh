#!/bin/bash
# verify-build-deterministic.sh — 빌드 결정론 검증
#
# npm run build를 두 번 실행해서 산출물 SHA256가 동일한지 확인.
# 동일하면 빌드 파이프라인 결정론 보증 (CI/cron에 통합 가능).
# 다르면 esbuild 또는 src/ 어딘가에 비결정론 (timestamp/random 등).
#
# 사용:
#   bash scripts/verify-build-deterministic.sh           # bootstrap.js + browser.js
#   bash scripts/verify-build-deterministic.sh --json    # CI용 JSON 출력
#   bash scripts/verify-build-deterministic.sh --skip-clean  # node_modules 빌드 캐시 유지

set -e

cd "$(dirname "$0")/.."

JSON_ONLY=false
SKIP_CLEAN=false
for arg in "$@"; do
  [ "$arg" = "--json" ] && JSON_ONLY=true
  [ "$arg" = "--skip-clean" ] && SKIP_CLEAN=true
done

if ! $JSON_ONLY; then
  echo "════════════════════════════════════════════"
  echo "  FreeLang v11 Build Determinism Verification"
  echo "════════════════════════════════════════════"
  echo ""
fi

# 검증할 산출물
ARTIFACTS=("bootstrap.js" "browser.js")

# Build 1
$JSON_ONLY || echo "🔨 Build #1 ..."
T0=$(date +%s)
npm run build > /tmp/build1.log 2>&1
B1_TIME=$(( $(date +%s) - T0 ))

declare -A HASH1
for f in "${ARTIFACTS[@]}"; do
  if [ ! -f "$f" ]; then
    $JSON_ONLY || echo "  ❌ $f missing after build #1"
    exit 2
  fi
  HASH1[$f]=$(sha256sum "$f" | cut -d' ' -f1)
  $JSON_ONLY || echo "  $f: ${HASH1[$f]:0:16}... (${B1_TIME}s)"
done

# Build 2
$JSON_ONLY || { echo ""; echo "🔨 Build #2 (재빌드) ..."; }
T0=$(date +%s)
npm run build > /tmp/build2.log 2>&1
B2_TIME=$(( $(date +%s) - T0 ))

declare -A HASH2
PASS=0
FAIL=0
for f in "${ARTIFACTS[@]}"; do
  HASH2[$f]=$(sha256sum "$f" | cut -d' ' -f1)
  if [ "${HASH1[$f]}" = "${HASH2[$f]}" ]; then
    $JSON_ONLY || echo "  $f: ${HASH2[$f]:0:16}... ✅ (${B2_TIME}s)"
    PASS=$((PASS + 1))
  else
    $JSON_ONLY || echo "  $f: ${HASH2[$f]:0:16}... ❌ DIFFERS"
    FAIL=$((FAIL + 1))
  fi
done

if ! $JSON_ONLY; then
  echo ""
  echo "════════════════════════════════════════════"
  if [ $FAIL -eq 0 ]; then
    echo "✅ Build Deterministic: $PASS/${#ARTIFACTS[@]} artifacts identical"
    echo "   esbuild + src/ 결정론 확정"
  else
    echo "❌ Build Non-Deterministic: $FAIL artifact(s) differ"
    echo "   src/ 또는 esbuild config에 비결정론 의심"
  fi
fi

# JSON 결과 저장
{
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"pass\": $PASS,"
  echo "  \"fail\": $FAIL,"
  echo "  \"build1_seconds\": $B1_TIME,"
  echo "  \"build2_seconds\": $B2_TIME,"
  echo "  \"artifacts\": ["
  COUNT=0
  for f in "${ARTIFACTS[@]}"; do
    SEP=","
    COUNT=$((COUNT + 1))
    [ $COUNT -eq ${#ARTIFACTS[@]} ] && SEP=""
    MATCH="false"
    [ "${HASH1[$f]}" = "${HASH2[$f]}" ] && MATCH="true"
    echo "    {\"file\": \"$f\", \"build1_sha256\": \"${HASH1[$f]}\", \"build2_sha256\": \"${HASH2[$f]}\", \"match\": $MATCH}$SEP"
  done
  echo "  ]"
  echo "}"
} > BUILD-DETERMINISM-RESULTS.json

if $JSON_ONLY; then
  cat BUILD-DETERMINISM-RESULTS.json
else
  echo "   결과: BUILD-DETERMINISM-RESULTS.json"
fi

[ $FAIL -eq 0 ] && exit 0 || exit 1
