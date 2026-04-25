#!/bin/bash
# smoke-p-flow.sh — Phase P 소셜 로그인 e2e
#
# Mock 프로바이더를 background에서 띄움 (port 30200):
#   /authorize  → ?code=mock-code&state=... 로 callback redirect
#   /token      → access_token=mock-token
#   /userinfo   → {sub:"ext-user-1", email:"social@example.com", name:"Social User"}
#
# dclub-auth 측은 mock provider 를 통한 가입·로그인 흐름 통과해야 함.

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
MOCK_PORT=30200

# ── Mock provider 시작 (Node 한 줄 서버) ──────────────
node -e "
const http = require('http');
const url = require('url');
const srv = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/authorize') {
    const cb = u.query.redirect_uri + '?code=mock-code-XYZ&state=' + u.query.state;
    res.writeHead(302, { Location: cb });
    res.end();
    return;
  }
  if (u.pathname === '/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: 'mock-access-XYZ', token_type: 'Bearer', expires_in: 3600 }));
    return;
  }
  if (u.pathname === '/userinfo') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sub: 'ext-user-001', email: 'social@example.com', name: 'Social Test' }));
    return;
  }
  res.writeHead(404); res.end();
});
srv.listen(${MOCK_PORT}, () => console.log('mock provider on :${MOCK_PORT}'));
" &
MOCK_PID=$!
sleep 1

trap "kill $MOCK_PID 2>/dev/null || true" EXIT

# ── 1. /auth/external/mock/start 호출 → 302 to mock /authorize ─
LOC=$(curl -s -i -G "${BASE}/auth/external/mock/start" \
  --data-urlencode "client_id=blog" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid profile email" \
  --data-urlencode "state=app-state-123" \
  --data-urlencode "code_challenge=test" \
  --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')

echo "[1] /start → 302 to ${LOC:0:50}..."
if [ -z "$LOC" ] || ! echo "$LOC" | grep -q "localhost:${MOCK_PORT}/authorize"; then
  echo "[1] FAIL: location"; exit 1
fi
OUR_STATE=$(echo "$LOC" | sed -n 's/.*state=\([^&]*\).*/\1/p')

# ── 2. mock /authorize 호출 → callback URL 확인 ──────
CB=$(curl -s -i "$LOC" 2>/dev/null | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
echo "[2] mock /authorize → callback ${CB:0:60}..."
if [ -z "$CB" ] || ! echo "$CB" | grep -q "/auth/external/mock/callback"; then
  echo "[2] FAIL"; exit 1
fi

# ── 3. callback 호출 → token+userinfo 후 우리 /authorize 완료 ─
FINAL=$(curl -s -i "$CB" 2>/dev/null | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
echo "[3] /callback → final ${FINAL:0:60}..."
if [ -z "$FINAL" ] || ! echo "$FINAL" | grep -q "code="; then
  echo "[3] FAIL: final not code redirect"; exit 1
fi
LOCAL_CODE=$(echo "$FINAL" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
LOCAL_STATE=$(echo "$FINAL" | sed -n 's/.*[?&]state=\([^&]*\).*/\1/p')
echo "[3] code=${LOCAL_CODE:0:12}... state=$LOCAL_STATE"
if [ "$LOCAL_STATE" != "app-state-123" ]; then echo "[3] FAIL state mismatch"; exit 1; fi

# ── 4. external_identities 테이블에 mock 사용자 등록됨 ─
ROW=$(sqlite3 /tmp/dclub-auth.db "SELECT provider, external_sub, email FROM external_identities WHERE provider='mock'")
echo "[4] external_identities row: $ROW"
if ! echo "$ROW" | grep -q "ext-user-001"; then echo "[4] FAIL"; exit 1; fi
if ! echo "$ROW" | grep -q "social@example.com"; then echo "[4] FAIL email"; exit 1; fi

# ── 5. users 테이블에 mock 사용자 자동 생성됨 ──────
USER_COUNT=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM users WHERE email='social@example.com'")
echo "[5] users with mock email = $USER_COUNT"
if [ "$USER_COUNT" != "1" ]; then exit 1; fi

# ── 6. 같은 외부 sub로 다시 로그인 → 같은 user_id (재방문) ─
LOC2=$(curl -s -i -G "${BASE}/auth/external/mock/start" \
  --data-urlencode "client_id=blog" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=re-state" \
  --data-urlencode "code_challenge=test" \
  --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
CB2=$(curl -s -i "$LOC2" 2>/dev/null | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
curl -s "$CB2" >/dev/null

# 매핑 row 1개 유지 (중복 안 됨)
ROW_COUNT=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM external_identities WHERE provider='mock' AND external_sub='ext-user-001'")
echo "[6] 재방문 후 매핑 row = $ROW_COUNT (1 기대)"
if [ "$ROW_COUNT" != "1" ]; then exit 1; fi

# ── 7. login.external_ok audit 2건 ───────────────
AUDIT=$(sqlite3 /tmp/dclub-auth.db "SELECT COUNT(*) FROM audit_log WHERE event='login.external_ok'")
echo "[7] login.external_ok audit count = $AUDIT (2 기대)"
if [ "$AUDIT" != "2" ]; then exit 1; fi

echo ""
echo "Phase P 소셜 로그인 e2e OK ✅"
