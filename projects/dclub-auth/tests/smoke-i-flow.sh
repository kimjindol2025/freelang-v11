#!/bin/bash
# smoke-i-flow.sh — Phase I 메일 outbox 통합 e2e
#
# 검증: signup/forgot 호출 → outbox JSON 파일 생성 → 본문에 verify/reset URL 포함

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
OUTBOX="${DCLUB_AUTH_MAIL_OUTBOX:-/tmp/dclub-auth-outbox}"

# 깨끗한 상태로
rm -rf "$OUTBOX"

# ── 1. signup → 메일 큐에 들어가야 함 ─────────────
USER="mailtest_$$"
EMAIL="${USER}@example.com"
SIGNUP_RESP=$(curl -sf -X POST "${BASE}/signup" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "email=${EMAIL}" \
  --data-urlencode "password=brandnewpw9999" \
  --data-urlencode "password_confirm=brandnewpw9999")
echo "[1] signup OK"

sleep 0.3
COUNT=$(ls -1 "$OUTBOX"/*.json 2>/dev/null | wc -l)
if [ "$COUNT" -lt 1 ]; then
  echo "[2] FAIL: outbox 비어있음 (count=$COUNT)"; exit 1
fi
echo "[2] outbox 파일 수 = $COUNT (1+ 기대)"

# ── 3. 가장 최근 메일 검사 ─────────────────────────
LATEST=$(ls -1t "$OUTBOX"/*.json | head -1)
TO=$(python3 -c "import json;print(json.load(open('$LATEST'))['to'])")
SUBJECT=$(python3 -c "import json;print(json.load(open('$LATEST'))['subject'])")
BODY=$(python3 -c "import json;print(json.load(open('$LATEST'))['body'])")
echo "[3] mail to=$TO subject=$SUBJECT"
if [ "$TO" != "$EMAIL" ]; then echo "[3] FAIL: to mismatch"; exit 1; fi
if ! echo "$BODY" | grep -q "verify-email?token="; then
  echo "[3] FAIL: body에 verify URL 없음"; exit 1
fi
echo "[3] verify URL 본문 포함 OK"

# ── 4. 메일 본문에서 URL 추출 → 검증 ─────────────
VERIFY_URL=$(echo "$BODY" | grep -oP "${BASE}/verify-email\?token=[a-f0-9]+" | head -1)
VRESP=$(curl -sf "$VERIFY_URL")
if echo "$VRESP" | grep -q "검증 완료"; then
  echo "[4] 메일 → URL 클릭 → 검증 완료"
else
  echo "[4] FAIL"; exit 1
fi

# ── 5. forgot → 두 번째 메일 ─────────────────────
curl -sf -X POST "${BASE}/forgot" --data-urlencode "email=${EMAIL}" > /dev/null
sleep 0.3
COUNT2=$(ls -1 "$OUTBOX"/*.json 2>/dev/null | wc -l)
echo "[5] forgot 후 outbox 수 = $COUNT2 (2 기대)"
if [ "$COUNT2" -lt 2 ]; then echo "[5] FAIL"; exit 1; fi

# ── 6. 두 번째 메일에 reset URL ─────────────────
LATEST2=$(ls -1t "$OUTBOX"/*.json | head -1)
BODY2=$(python3 -c "import json;print(json.load(open('$LATEST2'))['body'])")
SUBJECT2=$(python3 -c "import json;print(json.load(open('$LATEST2'))['subject'])")
echo "[6] reset mail subject=$SUBJECT2"
if ! echo "$BODY2" | grep -q "reset?token="; then
  echo "[6] FAIL: reset URL 없음"; exit 1
fi
echo "[6] reset URL 본문 포함 OK"

# ── 7. /forgot 없는 이메일은 outbox에 안 들어감 ─
COUNT_BEFORE=$(ls -1 "$OUTBOX"/*.json 2>/dev/null | wc -l)
curl -sf -X POST "${BASE}/forgot" --data-urlencode "email=ghost@nowhere.io" > /dev/null
sleep 0.3
COUNT_AFTER=$(ls -1 "$OUTBOX"/*.json 2>/dev/null | wc -l)
echo "[7] 없는 이메일 후 count: $COUNT_BEFORE → $COUNT_AFTER (변동 없어야 함)"
if [ "$COUNT_AFTER" -ne "$COUNT_BEFORE" ]; then
  echo "[7] FAIL: 없는 이메일도 outbox 들어감"; exit 1
fi

echo ""
echo "Phase I mail outbox e2e OK ✅"
