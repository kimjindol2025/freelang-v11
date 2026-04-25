#!/bin/bash
# verify-all.sh — FreeLang v11 셀프호스팅 통합 검증
#
# 모든 self-hosting 검증을 한 번에 실행하고 단일 대시보드 출력 + JSON 보고서.
# CI / 매일 cron / 사업화 자료 생성에 사용.
#
# 검증 항목:
#   1. Build 결정론        (verify-build-deterministic.sh)
#   2. Deep fixed-point    (verify-fixed-point-deep.sh, stage1~10)
#   3. Tier2 verify        (verify-self-host.sh tier2)
#   4. FL-Bench reference  (benchmarks/fl-bench/run.js --reference)
#
# 사용:
#   bash scripts/verify-all.sh          # 인간용 대시보드
#   bash scripts/verify-all.sh --json   # 머신용 JSON
#   bash scripts/verify-all.sh --quiet  # exit code만 (CI용)

set -u

cd "$(dirname "$0")/.."

JSON_ONLY=false
QUIET=false
for arg in "$@"; do
  [ "$arg" = "--json" ] && JSON_ONLY=true
  [ "$arg" = "--quiet" ] && QUIET=true
done

T0=$(date +%s)

run_check() {
  local name="$1"
  local cmd="$2"
  local result_var="$3"

  $JSON_ONLY || $QUIET || echo "▶ $name ..."
  local out
  if out=$(eval "$cmd" 2>&1); then
    eval "$result_var='ok'"
    $JSON_ONLY || $QUIET || echo "  ✅ $name OK"
  else
    eval "$result_var='fail'"
    $JSON_ONLY || $QUIET || echo "  ❌ $name FAIL"
    $JSON_ONLY || $QUIET || echo "$out" | tail -3 | sed 's/^/    /'
  fi
  $JSON_ONLY || $QUIET || echo ""
}

if ! $JSON_ONLY && ! $QUIET; then
  echo "════════════════════════════════════════════════════"
  echo "  FreeLang v11 — 셀프호스팅 통합 검증 대시보드"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════════════════"
  echo ""
fi

# 1. Build 결정론
T1_START=$(date +%s)
run_check "Build determinism (TS→bootstrap.js + browser.js)" \
  "bash scripts/verify-build-deterministic.sh" R1
T1_END=$(date +%s)

# 2. Deep fixed-point
T2_START=$(date +%s)
run_check "Deep fixed-point (stage1~10 SHA256 chain)" \
  "bash scripts/verify-fixed-point-deep.sh 10" R2
T2_END=$(date +%s)

# 3. Tier2 verify
T3_START=$(date +%s)
run_check "Tier2 verify-self-host.sh (PASS≥91, FAIL=0)" \
  "bash scripts/verify-self-host.sh tier2" R3
T3_END=$(date +%s)

# 4. FL-Bench reference
T4_START=$(date +%s)
run_check "FL-Bench reference (100/100 PASS)" \
  "node benchmarks/fl-bench/run.js --reference --label=verify-all" R4
T4_END=$(date +%s)

ELAPSED=$(($(date +%s) - T0))

# 결과 수집
PASS=0
FAIL=0
for r in $R1 $R2 $R3 $R4; do
  [ "$r" = "ok" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
done

# 인간용 대시보드
if ! $JSON_ONLY && ! $QUIET; then
  echo "════════════════════════════════════════════════════"
  echo "  결과: $PASS/4 검증 통과 (${ELAPSED}s)"
  echo "════════════════════════════════════════════════════"
  printf "  %-50s %s\n" "Build determinism" "$([ "$R1" = "ok" ] && echo ✅ || echo ❌)"
  printf "  %-50s %s\n" "Deep fixed-point (stage1~10)" "$([ "$R2" = "ok" ] && echo ✅ || echo ❌)"
  printf "  %-50s %s\n" "Tier2 verify-self-host" "$([ "$R3" = "ok" ] && echo ✅ || echo ❌)"
  printf "  %-50s %s\n" "FL-Bench reference (100 task)" "$([ "$R4" = "ok" ] && echo ✅ || echo ❌)"
  echo ""
  if [ $FAIL -eq 0 ]; then
    echo "🎉 셀프호스팅 완전 건강 — CI/cron 통과 가능"
  else
    echo "⚠️  $FAIL 항목 실패 — 조사 필요"
  fi
fi

# JSON 결과
{
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"elapsed_seconds\": $ELAPSED,"
  echo "  \"pass\": $PASS,"
  echo "  \"fail\": $FAIL,"
  echo "  \"checks\": ["
  echo "    {\"name\": \"build_deterministic\",   \"status\": \"$R1\", \"elapsed_s\": $((T1_END-T1_START))},"
  echo "    {\"name\": \"deep_fixed_point\",      \"status\": \"$R2\", \"elapsed_s\": $((T2_END-T2_START))},"
  echo "    {\"name\": \"tier2_verify_self_host\", \"status\": \"$R3\", \"elapsed_s\": $((T3_END-T3_START))},"
  echo "    {\"name\": \"fl_bench_reference\",   \"status\": \"$R4\", \"elapsed_s\": $((T4_END-T4_START))}"
  echo "  ]"
  echo "}"
} > VERIFY-ALL-RESULTS.json

if $JSON_ONLY; then
  cat VERIFY-ALL-RESULTS.json
elif ! $QUIET; then
  echo ""
  echo "  결과 저장: VERIFY-ALL-RESULTS.json"
fi

[ $FAIL -eq 0 ] && exit 0 || exit 1
