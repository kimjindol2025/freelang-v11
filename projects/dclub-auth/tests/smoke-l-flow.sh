#!/bin/bash
# smoke-l-flow.sh — Phase L 이상 탐지 e2e
#
# 시나리오:
#   [grace 1-3] 같은 IP 로 3회 로그인 (학습 기간)
#   [4] 같은 IP 로 정상 로그인 → score=0, 메일 알림 없음
#   [5] 다른 IP class 로 로그인 → score 높음 → 의심 + 메일 알림
#   [6] outbox 에 알림 메일 들어감
#   [7] /admin/security 401 (admin 토큰 없이)

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
OUTBOX="${DCLUB_AUTH_MAIL_OUTBOX:-/tmp/dclub-auth-outbox}"

rm -rf "$OUTBOX"

login_with_ip() {
  local IP=$1
  local UA="${2:-Mozilla/5.0 SmokeTest}"
  local STATE="state-$RANDOM"
  local VER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
  local CHAL=$(echo -n "$VER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')

  curl -sf -i -X POST "${BASE}/login" \
    -H "X-Forwarded-For: ${IP}" \
    -H "User-Agent: ${UA}" \
    --data-urlencode "username=demo" \
    --data-urlencode "password=demo1234" \
    --data-urlencode "client_id=blog" \
    --data-urlencode "redirect_uri=http://localhost:30200/cb" \
    --data-urlencode "scope=openid" \
    --data-urlencode "state=${STATE}" \
    --data-urlencode "code_challenge=${CHAL}" \
    --data-urlencode "code_challenge_method=S256" 2>/dev/null \
    | grep -i "^location:" | awk '{print $2}' | tr -d '\r'
}

# ── 1-3. grace ─────────────────────────────────────
for i in 1 2 3; do
  L=$(login_with_ip "10.1.1.1")
  if [ -z "$L" ]; then echo "[grace $i] FAIL"; exit 1; fi
  echo "[grace $i] OK"
done

# 4. 같은 IP — score 0
L4=$(login_with_ip "10.1.1.1")
if [ -z "$L4" ]; then echo "[4] FAIL"; exit 1; fi
echo "[4] same IP login OK"

# 5. 다른 IP class + 다른 UA — score 높음
L5=$(login_with_ip "203.99.88.77" "Chrome/SuspectBot")
if [ -z "$L5" ]; then echo "[5] FAIL"; exit 1; fi
echo "[5] new IP login OK (의심 발동 기대)"

# 6. outbox 확인 — 의심 알림 메일 1개+
sleep 0.5
COUNT=$(ls -1 "$OUTBOX"/*.json 2>/dev/null | wc -l)
echo "[6] outbox 메일 = $COUNT (1+ 기대 — 새 위치 알림)"
if [ "$COUNT" -lt 1 ]; then exit 1; fi

# 본문 검증
LATEST=$(ls -1t "$OUTBOX"/*.json | head -1)
SUBJECT=$(python3 -c "import json;print(json.load(open('$LATEST'))['subject'])")
BODY=$(python3 -c "import json;print(json.load(open('$LATEST'))['body'])")
echo "[6] subject: $SUBJECT"
if ! echo "$SUBJECT" | grep -q "새 위치"; then echo "[6] FAIL: subject 불일치"; exit 1; fi
if ! echo "$BODY" | grep -q "203.99.88.77"; then echo "[6] FAIL: body에 의심 IP 없음"; exit 1; fi
if ! echo "$BODY" | grep -q "new_ip"; then echo "[6] FAIL: body에 reason 없음"; exit 1; fi

# 7. /admin/security 인증 없이 → 403
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/admin/security")
echo "[7] /admin/security 무인증 → HTTP $HTTP (403 기대)"
if [ "$HTTP" != "403" ]; then exit 1; fi

# 8. DB 직접 — login_history 5건 (grace 3 + 정상 1 + 의심 1)
ROWS=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM login_history")
echo "[8] login_history rows = $ROWS (5 기대)"
if [ "$ROWS" != "5" ]; then exit 1; fi

# 9. suspicious 1건 확인
SUSP=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM login_history WHERE suspicious=1")
echo "[9] suspicious rows = $SUSP (1 기대)"
if [ "$SUSP" != "1" ]; then exit 1; fi

echo ""
echo "Phase L 이상 탐지 e2e OK ✅"
