#!/bin/bash
# smoke-flow.sh — Phase B end-to-end Authorization Code + PKCE 흐름 검증
#
# 가정: dclub-auth 서버가 port 30100에서 가동 중.
#       seed: demo/demo1234 사용자 + "blog" 클라이언트.
#
# 흐름:
#   1) PKCE verifier 생성, challenge=base64url(SHA256(verifier))
#   2) GET /.well-known/openid-configuration → endpoint 자동 발견
#   3) GET /authorize → 로그인 폼 SSR (200 + HTML)
#   4) POST /login (demo/demo1234) → 302 redirect with ?code=...
#   5) POST /token (code+verifier) → access_token + id_token + refresh_token
#   6) id_token RS256 검증 (jwks 사용)
#   7) GET /userinfo (Bearer access_token) → 사용자 프로필
#   8) POST /token (grant_type=refresh_token) → 새 access_token

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
CLIENT="blog"
SECRET="blog-secret-CHANGE-ME"
REDIRECT="http://localhost:30200/cb"
SCOPE="openid profile email"
STATE="csrf-12345"
NONCE="nonce-67890"

# ── 1. PKCE 준비 ──────────────────────────────────────
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHALLENGE=$(echo -n "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
echo "[1] verifier=${VERIFIER:0:12}..."
echo "[1] challenge=${CHALLENGE:0:12}..."

# ── 2. discovery ──────────────────────────────────────
DISCOVERY=$(curl -sf "${BASE}/.well-known/openid-configuration")
ISS=$(echo "$DISCOVERY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["issuer"])')
JWKS_URI=$(echo "$DISCOVERY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["jwks_uri"])')
echo "[2] discovery: issuer=$ISS jwks_uri=$JWKS_URI"

# ── 3. /authorize (HTML 폼 응답 확인) ─────────────────
AUTH_HTML=$(curl -sf -G "${BASE}/authorize" \
  --data-urlencode "response_type=code" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=${SCOPE}" \
  --data-urlencode "state=${STATE}" \
  --data-urlencode "nonce=${NONCE}" \
  --data-urlencode "code_challenge=${CHALLENGE}" \
  --data-urlencode "code_challenge_method=S256")
if echo "$AUTH_HTML" | grep -q "dclub-auth 로그인"; then
  echo "[3] /authorize → 로그인 폼 SSR OK"
else
  echo "[3] FAIL: 로그인 폼 발견 안 됨"
  echo "$AUTH_HTML" | head -3
  exit 1
fi

# ── 4. POST /login ────────────────────────────────────
COOKIES=/tmp/dclub-auth-cookies.txt
LOGIN_RESP=$(curl -sf -i -X POST "${BASE}/login" \
  -c "$COOKIES" \
  --data-urlencode "username=demo" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=${SCOPE}" \
  --data-urlencode "state=${STATE}" \
  --data-urlencode "nonce=${NONCE}" \
  --data-urlencode "code_challenge=${CHALLENGE}" \
  --data-urlencode "code_challenge_method=S256" || true)
LOCATION=$(echo "$LOGIN_RESP" | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
if [ -z "$LOCATION" ]; then
  echo "[4] FAIL: Location 헤더 없음"
  echo "$LOGIN_RESP" | head -5
  exit 1
fi
CODE=$(echo "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
RETURNED_STATE=$(echo "$LOCATION" | sed -n 's/.*[?&]state=\([^&]*\).*/\1/p')
echo "[4] POST /login → code=${CODE:0:12}... state=$RETURNED_STATE"
if [ "$RETURNED_STATE" != "$STATE" ]; then
  echo "[4] FAIL: state 불일치"
  exit 1
fi

# ── 5. POST /token ────────────────────────────────────
TOKEN_JSON=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=${CODE}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET}" \
  --data-urlencode "code_verifier=${VERIFIER}")
ACCESS=$(echo "$TOKEN_JSON" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
ID_TOKEN=$(echo "$TOKEN_JSON" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id_token"])')
REFRESH=$(echo "$TOKEN_JSON" | python3 -c 'import json,sys;print(json.load(sys.stdin)["refresh_token"])')
echo "[5] /token: access_token=${ACCESS:0:30}..."
echo "[5] /token: id_token=${ID_TOKEN:0:30}..."
echo "[5] /token: refresh_token=${REFRESH:0:30}..."

# ── 6. id_token 검증 (jwks 외부 검증) ─────────────────
python3 - <<PY
import json, base64, urllib.request
jwks = json.loads(urllib.request.urlopen("${BASE}/jwks.json").read())
id_token = "${ID_TOKEN}"
hdr_b64, payload_b64, sig_b64 = id_token.split(".")
def b64d(s):
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)
header = json.loads(b64d(hdr_b64))
payload = json.loads(b64d(payload_b64))
print(f"[6] id_token header: alg={header['alg']} kid={header['kid']} typ={header['typ']}")
print(f"[6] id_token payload: iss={payload['iss']} sub={payload['sub'][:8]}... aud={payload['aud']} nonce={payload.get('nonce','')}")
assert header["alg"] == "RS256", "alg!=RS256"
assert payload["iss"] == "${ISS}", "iss mismatch"
assert payload["aud"] == "${CLIENT}", "aud mismatch"
assert payload.get("nonce") == "${NONCE}", "nonce mismatch"

# RS256 외부 검증 — Python 측에서 jwks를 파일로 떨구고 Node가 읽어서 검증
import subprocess, tempfile, os
fd, jwks_path = tempfile.mkstemp(suffix=".json")
with os.fdopen(fd, "w") as f: f.write(json.dumps(jwks))
fd2, tok_path = tempfile.mkstemp(suffix=".jwt")
with os.fdopen(fd2, "w") as f: f.write(id_token)
node_src = "const fs=require('fs');const crypto=require('crypto');const jwks=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const tok=fs.readFileSync(process.argv[2],'utf8').trim();const [h,p,s]=tok.split('.');const kid=JSON.parse(Buffer.from(h,'base64url')).kid;const jwk=jwks.keys.find(k=>k.kid===kid);const pub=crypto.createPublicKey({key:jwk,format:'jwk'});const ok=crypto.createVerify('RSA-SHA256').update(h+'.'+p).verify(pub,Buffer.from(s,'base64url'));console.log('verify='+ok);"
result = subprocess.run(["node", "-e", node_src, jwks_path, tok_path], capture_output=True, text=True)
os.unlink(jwks_path); os.unlink(tok_path)
print(f"[6] {result.stdout.strip()}  ← 외부 Node crypto + JWKS 검증")
assert "verify=true" in result.stdout, f"verify failed: {result.stderr}"
PY

# ── 7. /userinfo ─────────────────────────────────────
USERINFO=$(curl -sf "${BASE}/userinfo" -H "Authorization: Bearer ${ACCESS}")
echo "[7] /userinfo: $USERINFO"
if ! echo "$USERINFO" | python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["preferred_username"]=="demo";assert d["email"]=="demo@dclub.kr";print("ok",end="")'; then
  echo "[7] FAIL: userinfo 필드 검증"
  exit 1
fi

# ── 8. refresh_token grant ────────────────────────────
REFRESH_RESP=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=${REFRESH}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET}")
NEW_ACCESS=$(echo "$REFRESH_RESP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
NEW_REFRESH=$(echo "$REFRESH_RESP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["refresh_token"])')
echo "[8] refresh: new_access=${NEW_ACCESS:0:30}..."
if [ "$NEW_REFRESH" = "$REFRESH" ]; then
  echo "[8] FAIL: refresh_token 회전 안 됨"
  exit 1
fi
echo "[8] refresh_token 회전 OK"

# ── 9. 옛 refresh_token 재사용 → family revoke ────────
REUSE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/token" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=${REFRESH}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET}")
echo "[9] 옛 refresh 재사용 → HTTP $REUSE_HTTP (400 기대)"

# ── 10. 회전된 새 refresh도 family revoke로 거부 ──────
NEW_REUSE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/token" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "refresh_token=${NEW_REFRESH}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET}")
echo "[10] family-revoked new refresh → HTTP $NEW_REUSE_HTTP (400 기대)"

echo ""
echo "Phase B end-to-end smoke OK ✅"
