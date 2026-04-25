#!/bin/bash
# smoke-analytics.sh — Phase Y1 dclub-analytics e2e

set -e
PORT="${DCLUB_ANALYTICS_PORT:-30160}"
BASE="http://localhost:${PORT}"

# ── 1. /health ─────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. POST /track 알 수 없는 site → 404 ──────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/track" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"nonexistent","type":"pageview","page":"/x"}')
echo "[2] 알 수 없는 site → HTTP $HTTP (404 기대)"
if [ "$HTTP" != "404" ]; then exit 1; fi

# ── 3. POST /track demo site (시드) → 200 ─────
RESP=$(curl -sf -X POST "${BASE}/track" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0)" \
  -d '{"site_id":"s_demo","type":"pageview","page":"/home","referrer":"https://google.com","session_id":"se_test_1"}')
echo "[3] track pageview → $RESP"

# ── 4. /track event 타입 ───────────────────────
curl -sf -X POST "${BASE}/track" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (iPhone; Mobile)" \
  -d '{"site_id":"s_demo","type":"event","name":"signup","page":"/home","session_id":"se_test_1","props":{"plan":"pro"}}' >/dev/null
echo "[4] track event OK"

# ── 5. 다수의 pageview 시뮬 (sparkline 검증용) ─
for i in $(seq 1 30); do
  curl -sf -X POST "${BASE}/track" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Linux; Android)" \
    -d "{\"site_id\":\"s_demo\",\"type\":\"pageview\",\"page\":\"/post/$((i%5))\",\"session_id\":\"se_$((i%3))\"}" >/dev/null
done
echo "[5] 30 pageview burst OK"

# ── 6. /pixel.gif fallback ─────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/pixel.gif?site=s_demo&page=/pixel-test")
echo "[6] /pixel.gif → HTTP $HTTP (200 기대)"
if [ "$HTTP" != "200" ]; then exit 1; fi

# ── 7. /dashboard SSR ──────────────────────────
DASH=$(curl -sf "${BASE}/dashboard?site=s_demo")
if echo "$DASH" | grep -q "demo.local"; then
  echo "[7] /dashboard 렌더 OK (domain 표시 확인)"
else
  echo "FAIL: dashboard 렌더링 실패"
  exit 1
fi
if echo "$DASH" | grep -q "polyline"; then
  echo "[7b] sparkline SVG 포함 OK"
else
  echo "FAIL: sparkline 누락"
  exit 1
fi

# ── 8. /dashboard 알 수 없는 site → 안내 페이지 ─
DASH2=$(curl -sf "${BASE}/dashboard?site=unknown")
if echo "$DASH2" | grep -q "site_id"; then
  echo "[8] 알 수 없는 site → 안내 페이지 OK"
else
  exit 1
fi

# ── 9. /sdk.js 정적 서빙 ───────────────────────
SDK=$(curl -sf "${BASE}/sdk.js")
if echo "$SDK" | grep -q "DclubAnalytics"; then
  echo "[9] /sdk.js OK"
else
  exit 1
fi

# ── 10. 인증 없는 POST /sites → 401 ───────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/sites" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}')
echo "[10] 무인증 /sites → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

echo ""
echo "Phase Y1 dclub-analytics e2e OK ✅"
