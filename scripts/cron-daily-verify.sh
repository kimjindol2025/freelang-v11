#!/bin/bash
# scripts/cron-daily-verify.sh — 매일 자동 회귀 검출 cron job
#
# 매일 새벽 3시(또는 사용자 지정 시각)에 실행:
#   1. git pull (최신 master)
#   2. npm run build
#   3. make verify-all (4개 검증)
#   4. 결과 비교 (이전 vs 오늘)
#   5. 회귀 발생 시 블로그 알림 또는 로그
#
# 등록:
#   crontab -e
#   0 3 * * * /bin/bash /root/kim/freelang-v11/scripts/cron-daily-verify.sh
#
# 수동 실행:
#   bash scripts/cron-daily-verify.sh
#
# 결과:
#   logs/cron-verify-{YYYY-MM-DD}.log  (성공/실패 로그)
#   VERIFY-ALL-RESULTS.json            (덮어쓰기, 최신 결과)

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y-%m-%d)
TS=$(date +%Y-%m-%dT%H:%M:%S%z)
LOG_FILE="$LOG_DIR/cron-verify-$DATE.log"

log() {
  echo "[$TS] $1" | tee -a "$LOG_FILE"
}

log "════════════════════════════════════════════"
log "  FreeLang v11 — Daily Verification Cron"
log "  $TS"
log "════════════════════════════════════════════"

# 1. git pull (옵션 — 환경에 따라 skip)
if [ -d .git ] && [ -z "${SKIP_GIT_PULL:-}" ]; then
  log "▶ git pull"
  git pull --rebase 2>&1 | tee -a "$LOG_FILE" || log "  ⚠️  git pull 실패 (계속 진행)"
fi

# 2. npm run build (bootstrap.js 갱신)
log "▶ npm run build"
if npm run build > /tmp/cron-build.log 2>&1; then
  log "  ✅ build OK"
else
  log "  ❌ build FAIL"
  tail -5 /tmp/cron-build.log >> "$LOG_FILE"
  exit 1
fi

# 3. verify-all
log "▶ verify-all (4개 검증)"
T0=$(date +%s)
if bash scripts/verify-all.sh --json > /tmp/cron-verify.json 2>&1; then
  log "  ✅ verify-all PASS"
  VERIFY_OK=1
else
  log "  ❌ verify-all FAIL"
  VERIFY_OK=0
fi
ELAPSED=$(( $(date +%s) - T0 ))

# JSON 결과 분석
if [ -f /tmp/cron-verify.json ]; then
  PASS=$(grep -oE '"pass":\s*[0-9]+' /tmp/cron-verify.json | head -1 | grep -oE '[0-9]+')
  FAIL=$(grep -oE '"fail":\s*[0-9]+' /tmp/cron-verify.json | head -1 | grep -oE '[0-9]+')
  log "  결과: ${PASS}/4 PASS, ${FAIL}/4 FAIL, ${ELAPSED}s"
fi

# 4. 회귀 검출 (이전 결과와 비교)
if [ -f "$LOG_DIR/last-verify.json" ]; then
  PREV_PASS=$(grep -oE '"pass":\s*[0-9]+' "$LOG_DIR/last-verify.json" | head -1 | grep -oE '[0-9]+')
  if [ "${PREV_PASS:-0}" -gt "${PASS:-0}" ]; then
    log "  ⚠️  회귀 발견! 이전 PASS=$PREV_PASS, 현재 PASS=$PASS"
    # 회귀 알림 (옵션 — 블로그 또는 webhook)
    if [ -n "${BLOG_API_KEY:-}" ]; then
      curl -sS -X POST https://blog.dclub.kr/api/posts \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $BLOG_API_KEY" \
        -d "{\"title\":\"⚠️ FreeLang v11 회귀 발생 ($DATE)\",\"content\":\"verify-all PASS $PREV_PASS → $PASS\\n\\n로그: $LOG_FILE\\n결과: VERIFY-ALL-RESULTS.json\",\"category\":\"개발 이야기\",\"tags\":[\"FreeLang\",\"회귀\",\"cron\"],\"author\":\"cron-bot\"}" \
        >> "$LOG_FILE" 2>&1
    fi
  fi
fi

# 5. 결과 보존 (다음 회귀 검출용)
cp /tmp/cron-verify.json "$LOG_DIR/last-verify.json" 2>/dev/null || true

log "════════════════════════════════════════════"
log "  Cron 종료 — exit $([ $VERIFY_OK -eq 1 ] && echo 0 || echo 1)"
log "════════════════════════════════════════════"

[ $VERIFY_OK -eq 1 ] && exit 0 || exit 1
