#!/bin/bash
# smoke-storage.sh — Phase X4 dclub-storage e2e

set -e
PORT="${DCLUB_STORAGE_PORT:-30140}"
BASE="http://localhost:${PORT}"
KEY="test-key-CHANGE-ME"

# ── 1. /health ─────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. PUT 무인증 → 401 ────────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -d "hello" "${BASE}/demo/file1.txt")
echo "[2] 무인증 PUT → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 3. PUT with API key ────────────────────────
RESP=$(curl -sf -X PUT "${BASE}/demo/hello.txt" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: text/plain" \
  -d "Hello dclub-storage!")
echo "[3] PUT OK: $RESP"

# ── 4. GET ─────────────────────────────────────
GET=$(curl -sf "${BASE}/demo/hello.txt" -H "X-API-Key: $KEY")
echo "[4] GET → '$GET'"
if [ "$GET" != "Hello dclub-storage!" ]; then echo "FAIL: 내용 불일치"; exit 1; fi

# ── 5. list bucket ─────────────────────────────
LIST=$(curl -sf "${BASE}/demo" -H "X-API-Key: $KEY")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["objects"]))')
echo "[5] objects in demo = $N (1+ 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 6. signed URL 발급 ─────────────────────────
SIGN=$(curl -sf -X POST "${BASE}/admin/sign" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"demo","key":"hello.txt","ttl_seconds":60}')
URL=$(echo "$SIGN" | python3 -c 'import json,sys;print(json.load(sys.stdin)["url"])')
echo "[6] signed URL: $URL"

# ── 7. signed URL 로 GET (X-API-Key 없이) ──────
SIGNED_GET=$(curl -sf "${BASE}${URL}")
echo "[7] signed GET → '$SIGNED_GET'"
if [ "$SIGNED_GET" != "Hello dclub-storage!" ]; then exit 1; fi

# ── 8. 만료된 URL → 403 ────────────────────────
EXPIRED_URL=$(echo "$URL" | sed 's/expires=[0-9]*/expires=1/')
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${EXPIRED_URL}")
echo "[8] 만료 URL → HTTP $HTTP (403 기대)"
if [ "$HTTP" != "403" ]; then exit 1; fi

# ── 9. DELETE ──────────────────────────────────
DEL=$(curl -sf -X DELETE "${BASE}/demo/hello.txt" -H "X-API-Key: $KEY")
echo "[9] DELETE: $DEL"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/demo/hello.txt" -H "X-API-Key: $KEY")
echo "[9] 삭제 후 GET → HTTP $HTTP (404 기대)"
if [ "$HTTP" != "404" ]; then exit 1; fi

echo ""
echo "Phase X4 dclub-storage e2e OK ✅"
