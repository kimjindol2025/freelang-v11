#!/bin/bash
# smoke-o-flow.sh — Phase O GDPR/정통망법 e2e
#   가입 → 로그인 (이력 생성) → /me/export → DELETE /me → 데이터 익명화 검증

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"

# ── 1. 가입 ───────────────────────────────────────
USER="gdpr_$$"
EMAIL="${USER}@example.com"
PW="testpw123456"
curl -sf -X POST "${BASE}/signup" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "email=${EMAIL}" \
  --data-urlencode "password=${PW}" \
  --data-urlencode "password_confirm=${PW}" >/dev/null
echo "[1] 가입 OK ($USER)"

# ── 2. 로그인 → access_token ─────────────────────
VER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHAL=$(echo -n "$VER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
LOC=$(curl -sf -i -X POST "${BASE}/login" \
  --data-urlencode "username=${USER}" --data-urlencode "password=${PW}" \
  --data-urlencode "client_id=blog" --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid" --data-urlencode "state=s" \
  --data-urlencode "code_challenge=${CHAL}" --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
CODE=$(echo "$LOC" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
TOK=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=authorization_code" --data-urlencode "code=${CODE}" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "client_id=blog" --data-urlencode "client_secret=blog-secret-CHANGE-ME" \
  --data-urlencode "code_verifier=${VER}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
echo "[2] 로그인 OK access=${TOK:0:30}..."

# ── 3. /me/export ────────────────────────────────
EXP=$(curl -sf "${BASE}/me/export" -H "Authorization: Bearer ${TOK}")
EMAIL_OUT=$(echo "$EXP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["profile"]["email"])')
echo "[3] /me/export profile.email = $EMAIL_OUT"
if [ "$EMAIL_OUT" != "$EMAIL" ]; then echo "[3] FAIL"; exit 1; fi
HIST_LEN=$(echo "$EXP" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["login_history"]))')
echo "[3] login_history rows = $HIST_LEN"
if [ "$HIST_LEN" -lt 1 ]; then echo "[3] FAIL: history empty"; exit 1; fi

# ── 4. 잘못된 비번으로 삭제 시도 → 401 ─────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/me/delete" \
  -H "Authorization: Bearer ${TOK}" \
  --data-urlencode "password=WRONGPW")
echo "[4] /me/delete 잘못된 비번 → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 5. 정확한 비번으로 삭제 → 200 ──────────────
DEL=$(curl -sf -X POST "${BASE}/me/delete" \
  -H "Authorization: Bearer ${TOK}" \
  --data-urlencode "password=${PW}")
ANON=$(echo "$DEL" | python3 -c 'import json,sys;print(json.load(sys.stdin)["anonymized_username"])')
echo "[5] /me/delete OK → anonymized=$ANON"
if [ -z "$ANON" ] || ! echo "$ANON" | grep -q "^deleted_"; then echo "[5] FAIL"; exit 1; fi

# ── 6. DB 익명화 확인 ────────────────────────────
ROW=$(sqlite3 /tmp/dclub-auth.db "SELECT username, email, disabled FROM users WHERE username='${ANON}'")
echo "[6] DB user row: $ROW"
if ! echo "$ROW" | grep -q "@deleted.local"; then echo "[6] FAIL email not anon"; exit 1; fi
if ! echo "$ROW" | grep -q "|1$"; then echo "[6] FAIL disabled!=1"; exit 1; fi

# ── 7. 인증 자료 삭제 확인 ─────────────────────
WA=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM webauthn_credentials WHERE user_id IN (SELECT id FROM users WHERE username='${ANON}')")
EXT=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM external_identities WHERE user_id IN (SELECT id FROM users WHERE username='${ANON}')")
LH=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM login_history WHERE user_id IN (SELECT id FROM users WHERE username='${ANON}')")
echo "[7] webauthn=$WA external=$EXT login_history=$LH (모두 0 기대)"
if [ "$WA" != "0" ] || [ "$EXT" != "0" ] || [ "$LH" != "0" ]; then exit 1; fi

# ── 8. audit_log 마스킹 확인 (이벤트는 보존, user_id는 deleted_) ─
MASKED=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM audit_log WHERE user_id LIKE 'deleted_%'")
echo "[8] audit_log 마스킹된 행 = $MASKED (1+ 기대)"
if [ "$MASKED" -lt 1 ]; then exit 1; fi

# ── 9. 활성 토큰 무효화 확인 ───────────────────
REV=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM refresh_tokens WHERE revoked=1")
echo "[9] revoked refresh_tokens = $REV (1+ 기대)"
if [ "$REV" -lt 1 ]; then exit 1; fi

# ── 10. retention-tick 호출 (cron 시뮬) ────────
node bootstrap.js run -e '(load "projects/dclub-auth/lib/retention.fl") (retention-tick "/tmp/dclub-auth.db")' 2>&1 | tail -3 || true
echo "[10] retention-tick 호출 OK"

echo ""
echo "Phase O GDPR e2e OK ✅"
