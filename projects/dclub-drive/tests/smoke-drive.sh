#!/bin/bash
# smoke-drive.sh — Phase Y2 dclub-drive e2e

set -e
PORT="${DCLUB_DRIVE_PORT:-30170}"
BASE="http://localhost:${PORT}"

# JWT helper
mk_token() {
  python3 -c "
import json,base64,time
h=base64.urlsafe_b64encode(json.dumps({'alg':'RS256'}).encode()).decode().rstrip('=')
p=base64.urlsafe_b64encode(json.dumps({'sub':'$1','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
print(f'{h}.{p}.x')"
}

TOK_A=$(mk_token "user_a")
TOK_B=$(mk_token "user_b")

# ── 1. /health ─────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. 무인증 upload → 401 ────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/drive/upload" \
  -H "Content-Type: application/json" \
  -d '{"name":"x.txt","content":"hi"}')
echo "[2] 무인증 upload → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 3. user_a 폴더 생성 ────────────────────────
RESP=$(curl -sf -X POST "${BASE}/drive/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"parent_path":"/","name":"docs","type":"folder"}')
echo "[3] folder /docs 생성: $RESP"

# ── 4. user_a 파일 업로드 ──────────────────────
RESP=$(curl -sf -X POST "${BASE}/drive/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"parent_path":"/docs","name":"hello.txt","content":"hello drive!","mime":"text/plain"}')
echo "[4] file 업로드: $RESP"

# ── 5. user_a 다운로드 ─────────────────────────
GET=$(curl -sf "${BASE}/drive/download?path=/docs/hello.txt" \
  -H "Authorization: Bearer $TOK_A")
echo "[5] user_a download → '$GET'"
if [ "$GET" != "hello drive!" ]; then echo "FAIL: 내용 불일치"; exit 1; fi

# ── 6. user_b 다운로드 시도 → 403 (권한 없음) ──
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE}/drive/download?path=/docs/hello.txt" \
  -H "Authorization: Bearer $TOK_B")
echo "[6] user_b 무권한 download → HTTP $HTTP (403 기대)"
if [ "$HTTP" != "403" ]; then exit 1; fi

# ── 7. user_a → user_b 에 reader 권한 부여 ─────
RESP=$(curl -sf -X POST "${BASE}/drive/perms/grant" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"path":"/docs/hello.txt","user_id":"user_b","role":"reader"}')
echo "[7] grant reader: $RESP"

# ── 8. user_b 다시 다운로드 → 200 ──────────────
GET=$(curl -sf "${BASE}/drive/download?path=/docs/hello.txt" \
  -H "Authorization: Bearer $TOK_B")
echo "[8] user_b 권한받은 download → '$GET'"
if [ "$GET" != "hello drive!" ]; then exit 1; fi

# ── 9. share link 발급 ─────────────────────────
SHARE=$(curl -sf -X POST "${BASE}/drive/share" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"path":"/docs/hello.txt","ttl_seconds":3600,"role":"reader"}')
TOKEN=$(echo "$SHARE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
echo "[9] share token: $TOKEN"

# ── 10. share GET (인증 없이) ──────────────────
GET=$(curl -sf "${BASE}/share/$TOKEN")
echo "[10] 무인증 share download → '$GET'"
if [ "$GET" != "hello drive!" ]; then exit 1; fi

# ── 11. 잘못된 share 토큰 → 404 ────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/share/nonexistent")
echo "[11] invalid share → HTTP $HTTP (404 기대)"
if [ "$HTTP" != "404" ]; then exit 1; fi

# ── 12. user_a list 본인 디렉터리 ──────────────
LIST=$(curl -sf "${BASE}/drive/list?path=/docs" \
  -H "Authorization: Bearer $TOK_A")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["files"]))')
echo "[12] user_a /docs 목록 = $N (1+ 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 13. user_b 공유받은 항목 list ──────────────
SHARED=$(curl -sf "${BASE}/drive/list?shared=1" \
  -H "Authorization: Bearer $TOK_B")
N=$(echo "$SHARED" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["files"]))')
echo "[13] user_b shared 목록 = $N (1+ 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 14. 중복 업로드 → 409 ──────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/drive/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"parent_path":"/docs","name":"hello.txt","content":"dup"}')
echo "[14] 중복 업로드 → HTTP $HTTP (409 기대)"
if [ "$HTTP" != "409" ]; then exit 1; fi

echo ""
echo "Phase Y2 dclub-drive e2e OK ✅"
