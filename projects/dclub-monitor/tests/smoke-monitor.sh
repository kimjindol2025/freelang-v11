#!/bin/bash
# smoke-monitor.sh — Phase X2 e2e

set -e
PORT="${DCLUB_MONITOR_PORT:-30120}"
BASE="http://localhost:${PORT}"
DB="${DCLUB_MONITOR_DB:-/tmp/dclub-monitor.db}"

# ── 1. /health ─────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. /metrics 자체 노출 (Prometheus 형식) ────
M=$(curl -sf "${BASE}/metrics")
if echo "$M" | grep -q "dclub_monitor_targets_total"; then
  echo "[2] /metrics Prometheus 형식 OK"
else
  echo "[2] FAIL"; exit 1
fi

# ── 3. target 등록 — 자기 자신 ─────────────────
curl -sf -X POST "${BASE}/admin/targets" \
  -H "Content-Type: application/json" \
  -d "{\"service\":\"self\",\"url\":\"${BASE}/metrics\"}" >/dev/null
echo "[3] target 등록 OK"

# ── 4. /dashboard SSR ──────────────────────────
DASH=$(curl -sf "${BASE}/dashboard")
if echo "$DASH" | grep -q "dclub-monitor 대시보드"; then
  echo "[4] /dashboard SSR OK"
else
  echo "[4] FAIL"; exit 1
fi

# ── 5. alert rule 등록 ─────────────────────────
curl -sf -X POST "${BASE}/admin/rules" \
  -H "Content-Type: application/json" \
  -d '{"name":"test_high","metric":"dclub_monitor_uptime_seconds","threshold":1000000000,"comparator":">","duration_s":30,"notify_topic":"alert"}' >/dev/null
echo "[5] alert rule 등록 OK"

# ── 6. 강제 collector tick (FL 직접 호출) ──────
cat > /tmp/mon-tick.fl <<EOF
(load "projects/dclub-monitor/lib/collector.fl")
(define res (collector-tick "$DB"))
(println (str "scraped=" (length \$res)))
EOF
node bootstrap.js run /tmp/mon-tick.fl 2>&1 | tail -2

# ── 7. metrics 테이블에 row 들어감 확인 ────────
ROWS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM metrics WHERE service='self'")
echo "[7] metrics rows for self = $ROWS (1+ 기대)"
if [ "$ROWS" -lt 1 ]; then exit 1; fi

# ── 8. alert tick — fire 확인 ──────────────────
cat > /tmp/mon-alert.fl <<EOF
(load "projects/dclub-monitor/lib/alerting.fl")
(alert-tick "$DB")
(println "alert-tick OK")
EOF
node bootstrap.js run /tmp/mon-alert.fl 2>&1 | tail -3

FIRED=$(sqlite3 "$DB" "SELECT COUNT(*) FROM alert_rules WHERE last_fired IS NOT NULL")
echo "[8] fired rules = $FIRED (1+ 기대)"
if [ "$FIRED" -lt 1 ]; then exit 1; fi

echo ""
echo "Phase X2 dclub-monitor e2e OK ✅"
