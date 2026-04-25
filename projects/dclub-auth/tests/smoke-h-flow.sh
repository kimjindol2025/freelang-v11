#!/bin/bash
# smoke-h-flow.sh — Phase H 회원가입 + 비번 재설정 e2e

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"

# ── 1. /signup 폼 SSR ─────────────────────────────
HTML=$(curl -sf "${BASE}/signup")
if echo "$HTML" | grep -q "회원가입"; then
  echo "[1] GET /signup → 폼 OK"
else
  echo "[1] FAIL"; exit 1
fi

# ── 2. POST /signup ─────────────────────────────
USER="testuser_$$"
EMAIL="${USER}@dclub.kr"
RESP=$(curl -sf -X POST "${BASE}/signup" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "email=${EMAIL}" \
  --data-urlencode "password=verysecret123" \
  --data-urlencode "password_confirm=verysecret123")
if echo "$RESP" | grep -q "가입 완료"; then
  echo "[2] POST /signup → 성공 (verify URL 노출)"
else
  echo "[2] FAIL: $RESP"; exit 1
fi
VERIFY_URL=$(echo "$RESP" | grep -oP "${BASE}/verify-email\?token=[a-f0-9]+" | head -1)
echo "    verify URL: ${VERIFY_URL:0:60}..."

# ── 3. 검증 전 로그인 시도 (비번 OK 만으로 가능 — 정책상 검증은 별개) ─
# 우리 정책: 검증되지 않아도 로그인 가능. UI 에서 미검증 표시.
# 따라서 이 단계는 로그인이 통과되는지만 확인.

# ── 4. GET /verify-email?token=... ────────────
VERIFY_RESP=$(curl -sf "$VERIFY_URL")
if echo "$VERIFY_RESP" | grep -q "검증 완료"; then
  echo "[4] GET /verify-email → 검증 OK"
else
  echo "[4] FAIL: $VERIFY_RESP"; exit 1
fi

# ── 5. 같은 토큰 재사용 거부 ──────────────────
REUSE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$VERIFY_URL")
echo "[5] 재사용 → HTTP $REUSE_HTTP (400 기대)"
if [ "$REUSE_HTTP" != "400" ]; then exit 1; fi

# ── 6. 중복 회원가입 거부 ──────────────────────
DUP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/signup" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "email=other@dclub.kr" \
  --data-urlencode "password=verysecret123" \
  --data-urlencode "password_confirm=verysecret123")
echo "[6] 중복 username → HTTP $DUP_HTTP (409 기대)"
if [ "$DUP_HTTP" != "409" ]; then exit 1; fi

# ── 7. /forgot 폼 ────────────────────────────
FORGOT_HTML=$(curl -sf "${BASE}/forgot")
if echo "$FORGOT_HTML" | grep -q "비밀번호 재설정"; then
  echo "[7] GET /forgot → 폼 OK"
else
  echo "[7] FAIL"; exit 1
fi

# ── 8. POST /forgot (정상 이메일) ─────────────
SENT=$(curl -sf -X POST "${BASE}/forgot" --data-urlencode "email=${EMAIL}")
if echo "$SENT" | grep -q "메일 전송됨"; then
  echo "[8] POST /forgot → 전송됨 페이지"
else
  echo "[8] FAIL: $SENT"; exit 1
fi
RESET_URL=$(echo "$SENT" | grep -oP "${BASE}/reset\?token=[a-f0-9]+" | head -1)
echo "    reset URL: ${RESET_URL:0:60}..."

# ── 9. POST /forgot (없는 이메일) → 동일 응답 (계정 노출 금지) ───
GHOST=$(curl -sf -X POST "${BASE}/forgot" --data-urlencode "email=ghost@nope.com")
if echo "$GHOST" | grep -q "메일 전송됨"; then
  echo "[9] 없는 이메일도 동일 응답 OK (계정 존재 노출 X)"
else
  echo "[9] FAIL"; exit 1
fi

# ── 10. GET /reset?token=... 폼 ───────────────
RESET_FORM=$(curl -sf "$RESET_URL")
if echo "$RESET_FORM" | grep -q "새 비밀번호"; then
  echo "[10] GET /reset → 폼 OK"
else
  echo "[10] FAIL"; exit 1
fi

# ── 11. POST /reset (비번 변경) ───────────────
TOKEN=$(echo "$RESET_URL" | sed 's|.*token=||')
NEW_PW="brandnewpw9999"
RESET_OK=$(curl -sf -X POST "${BASE}/reset" \
  --data-urlencode "token=${TOKEN}" \
  --data-urlencode "password=${NEW_PW}" \
  --data-urlencode "password_confirm=${NEW_PW}")
if echo "$RESET_OK" | grep -q "변경 완료"; then
  echo "[11] POST /reset → 변경 완료"
else
  echo "[11] FAIL: $RESET_OK"; exit 1
fi

# ── 12. 새 비번으로 로그인 ────────────────────
VER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHAL=$(echo -n "$VER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
LOC=$(curl -sf -i -X POST "${BASE}/login" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "password=${NEW_PW}" \
  --data-urlencode "client_id=blog" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=h12" \
  --data-urlencode "code_challenge=${CHAL}" \
  --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
if [ -n "$LOC" ] && echo "$LOC" | grep -q "code="; then
  echo "[12] 새 비번 로그인 OK → ${LOC:0:50}..."
else
  echo "[12] FAIL: 새 비번으로 로그인 안 됨"; exit 1
fi

# ── 13. 옛 비번 거부 ──────────────────────────
OLD_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/login" \
  --data-urlencode "username=${USER}" \
  --data-urlencode "password=verysecret123" \
  --data-urlencode "client_id=blog" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=h13" \
  --data-urlencode "code_challenge=${CHAL}" \
  --data-urlencode "code_challenge_method=S256")
echo "[13] 옛 비번 → HTTP $OLD_HTTP (401 기대)"
if [ "$OLD_HTTP" != "401" ]; then exit 1; fi

echo ""
echo "Phase H signup + password reset e2e OK ✅"
