#!/bin/bash
# smoke-n-flow.sh — Phase N Back-Channel Logout e2e
#
# 시나리오:
#   1) discovery 에 end_session_endpoint + backchannel_logout_supported 노출
#   2) blog 클라이언트에 backchannel_logout_uri 등록 (DB 직접 입력)
#   3) 일반 로그인 → id_token 획득 (sid claim 포함 확인)
#   4) Mock RP가 :30201/bcl 에서 logout_token 수신 대기
#   5) GET /end-session?id_token_hint=... → 세션 revoke
#   6) Mock RP에 logout_token 도착 확인 (jti, sid, events 클레임)
#   7) 같은 refresh_token 으로 갱신 시도 → 거부 (revoked)

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
RP_PORT=30201

# Mock RP 시작 — logout_token 받아 파일에 저장
node -e "
const http = require('http');
const fs = require('fs');
const FILE = '/tmp/dclub-bcl-received.json';
fs.writeFileSync(FILE, '');
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => body += c);
  req.on('end', () => {
    if (req.url === '/bcl') {
      const m = body.match(/logout_token=([^&]+)/);
      if (m) {
        fs.writeFileSync(FILE, decodeURIComponent(m[1]));
      }
      res.writeHead(200); res.end('ok');
    } else {
      res.writeHead(404); res.end();
    }
  });
});
srv.listen(${RP_PORT}, () => console.log('mock RP on :${RP_PORT}'));
" &
RP_PID=$!
sleep 1
trap "kill $RP_PID 2>/dev/null || true" EXIT

# ── 1. discovery 검증 ──────────────────────────
DISC=$(curl -sf "${BASE}/.well-known/openid-configuration")
END_EP=$(echo "$DISC" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("end_session_endpoint",""))')
BCL_SUP=$(echo "$DISC" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("backchannel_logout_supported",False))')
echo "[1] end_session_endpoint=$END_EP"
echo "[1] backchannel_logout_supported=$BCL_SUP"
if [ -z "$END_EP" ] || [ "$BCL_SUP" != "True" ]; then echo "[1] FAIL"; exit 1; fi

# ── 2. blog 클라이언트에 BCL URL 등록 ─────────
sqlite3 /tmp/dclub-auth.db "UPDATE clients SET backchannel_logout_uri='http://localhost:${RP_PORT}/bcl' WHERE client_id='blog'"
echo "[2] blog client 에 BCL URL 등록"

# ── 3. 일반 로그인 → id_token ─────────────────
VER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHAL=$(echo -n "$VER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
LOC=$(curl -sf -i -X POST "${BASE}/login" \
  --data-urlencode "username=demo" --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=blog" --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "scope=openid" --data-urlencode "state=s" --data-urlencode "nonce=n1" \
  --data-urlencode "code_challenge=${CHAL}" --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
CODE=$(echo "$LOC" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
TOK=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=authorization_code" --data-urlencode "code=${CODE}" \
  --data-urlencode "redirect_uri=http://localhost:30200/cb" \
  --data-urlencode "client_id=blog" --data-urlencode "client_secret=blog-secret-CHANGE-ME" \
  --data-urlencode "code_verifier=${VER}")
ID_TOK=$(echo "$TOK" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id_token"])')
REFRESH=$(echo "$TOK" | python3 -c 'import json,sys;print(json.load(sys.stdin)["refresh_token"])')
echo "[3] id_token=${ID_TOK:0:30}... refresh=${REFRESH:0:20}..."

# id_token에 sid claim 확인
SID=$(python3 -c "
import json,base64
tok='${ID_TOK}'
p=tok.split('.')[1]
p+='='*(-len(p)%4)
print(json.loads(base64.urlsafe_b64decode(p))['sid'])")
echo "[3] sid=${SID:0:12}..."
if [ -z "$SID" ]; then echo "[3] FAIL: sid claim 없음"; exit 1; fi

# ── 4. /end-session 호출 ─────────────────────
LOC_OUT=$(curl -sf -i -G "${BASE}/end-session" \
  --data-urlencode "id_token_hint=${ID_TOK}" \
  --data-urlencode "post_logout_redirect_uri=http://localhost:30200/done" \
  --data-urlencode "state=bye" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
echo "[4] /end-session → ${LOC_OUT:0:50}..."
if ! echo "$LOC_OUT" | grep -q "30200/done"; then echo "[4] FAIL"; exit 1; fi

# ── 5. Mock RP가 logout_token 수신했는지 확인 ─
sleep 0.5
RECEIVED=$(cat /tmp/dclub-bcl-received.json)
if [ -z "$RECEIVED" ]; then echo "[5] FAIL: BCL 안 옴"; exit 1; fi
echo "[5] BCL 수신 ${#RECEIVED} bytes (logout_token)"

# logout_token 클레임 검증
EVENTS_OK=$(python3 -c "
import json,base64
tok='${RECEIVED}'
parts=tok.split('.')
p=parts[1]+'='*(-len(parts[1])%4)
c=json.loads(base64.urlsafe_b64decode(p))
print('iss:',c['iss'],'aud:',c['aud'],'sid:',c.get('sid','')[:12]+'...','events:',list(c.get('events',{}).keys())[0] if c.get('events') else 'NONE')
")
echo "[5] $EVENTS_OK"
if ! echo "$EVENTS_OK" | grep -q "schemas.openid.net/event/backchannel-logout"; then
  echo "[5] FAIL: events claim 형식 오류"; exit 1
fi

# ── 6. 세션 revoked 확인 ─────────────────────
REVOKED=$(sqlite3 /tmp/dclub-auth.db "SELECT revoked FROM sso_sessions WHERE sid='${SID}'")
echo "[6] sso_sessions.revoked = $REVOKED (1 기대)"
if [ "$REVOKED" != "1" ]; then exit 1; fi

# ── 7. refresh_token 무효화 확인 ─────────────
REUSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/token" \
  --data-urlencode "grant_type=refresh_token" --data-urlencode "refresh_token=${REFRESH}" \
  --data-urlencode "client_id=blog" --data-urlencode "client_secret=blog-secret-CHANGE-ME")
echo "[7] 옛 refresh_token 시도 → HTTP $REUSE (400 기대)"
if [ "$REUSE" != "400" ]; then exit 1; fi

echo ""
echo "Phase N Back-Channel Logout e2e OK ✅"
