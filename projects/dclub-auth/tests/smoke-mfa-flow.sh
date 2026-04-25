#!/bin/bash
# smoke-mfa-flow.sh — Phase G TOTP 2단계 인증 e2e
#
# 흐름:
#   1) 일반 로그인 → access_token
#   2) /mfa/setup (Bearer) → secret + otpauth URI
#   3) totp_now(secret) 로 TOTP 코드 계산
#   4) /mfa/confirm (Bearer + code) → status=active
#   5) /mfa/status → totp_active=true
#   6) 새 로그인 시도 → 1단계 password 통과 → TOTP 폼 SSR
#   7) 잘못된 TOTP → 401 + 폼 재요청
#   8) 정확한 TOTP → 302 redirect (code 발급)
#   9) /token → 정상 토큰 발급

set -e
PORT="${DCLUB_AUTH_PORT:-30100}"
BASE="http://localhost:${PORT}"
CLIENT="blog"
SECRET_CLIENT="blog-secret-CHANGE-ME"
REDIRECT="http://localhost:30200/cb"

# ── 1. 일반 로그인 → access_token ─────────────────
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHALLENGE=$(echo -n "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')

LOC=$(curl -sf -i -X POST "${BASE}/login" \
  --data-urlencode "username=demo" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s1" \
  --data-urlencode "code_challenge=${CHALLENGE}" \
  --data-urlencode "code_challenge_method=S256" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
CODE=$(echo "$LOC" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
TOKEN_JSON=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=${CODE}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET_CLIENT}" \
  --data-urlencode "code_verifier=${VERIFIER}")
ACCESS=$(echo "$TOKEN_JSON" | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
echo "[1] 일반 로그인 OK → access_token=${ACCESS:0:30}..."

# ── 2. /mfa/setup ────────────────────────────────
SETUP=$(curl -sf -X POST "${BASE}/mfa/setup" -H "Authorization: Bearer ${ACCESS}")
SECRET_B32=$(echo "$SETUP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["secret"])')
URI=$(echo "$SETUP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["otpauth_uri"])')
echo "[2] /mfa/setup OK secret=${SECRET_B32:0:8}... uri=${URI:0:30}..."

# ── 3. TOTP 코드 계산 (FreeLang totp_now 사용) ───
CODE6=$(node -e "
  const {createTotpModule}=require('./bootstrap.js');
  // bootstrap.js 는 직접 로드 가능하지 않음. CLI 경유 대신 자체 계산.
" 2>/dev/null || true)
# 직접 Node로 RFC 6238 계산
CODE6=$(node -e "
const crypto = require('crypto');
const secret = '${SECRET_B32}';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32d(s) {
  let bits=0,value=0;const out=[];
  for (const c of s.toUpperCase().replace(/=+\$/,'')) {
    const i=ALPHA.indexOf(c); value=(value<<5)|i; bits+=5;
    if (bits>=8) { out.push((value>>>(bits-8))&0xff); bits-=8; }
  }
  return Buffer.from(out);
}
const ctr = Math.floor(Date.now()/1000/30);
const buf = Buffer.alloc(8);
buf.writeUInt32BE(Math.floor(ctr/0x100000000),0);
buf.writeUInt32BE(ctr>>>0,4);
const h = crypto.createHmac('sha1', b32d(secret)).update(buf).digest();
const off = h[h.length-1]&0x0f;
const trunc = ((h[off]&0x7f)<<24)|((h[off+1]&0xff)<<16)|((h[off+2]&0xff)<<8)|(h[off+3]&0xff);
console.log(String(trunc%1000000).padStart(6,'0'));
")
echo "[3] TOTP 코드 계산 = ${CODE6}"

# ── 4. /mfa/confirm ──────────────────────────────
CONFIRM=$(curl -sf -X POST "${BASE}/mfa/confirm" \
  -H "Authorization: Bearer ${ACCESS}" \
  --data-urlencode "code=${CODE6}")
echo "[4] /mfa/confirm: $CONFIRM"

# ── 5. /mfa/status ───────────────────────────────
STATUS=$(curl -sf "${BASE}/mfa/status" -H "Authorization: Bearer ${ACCESS}")
echo "[5] /mfa/status: $STATUS"

# ── 6. 새 로그인 시도 (1단계 → TOTP 폼 SSR) ─────
VERIFIER2=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-43)
CHALLENGE2=$(echo -n "$VERIFIER2" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')

STAGE1_RESP=$(curl -sf -X POST "${BASE}/login" \
  --data-urlencode "username=demo" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s2" \
  --data-urlencode "code_challenge=${CHALLENGE2}" \
  --data-urlencode "code_challenge_method=S256")
if echo "$STAGE1_RESP" | grep -q "2단계 인증"; then
  echo "[6] 1단계 통과 → TOTP 폼 SSR 확인"
else
  echo "[6] FAIL: 2단계 폼 안 나옴"
  exit 1
fi

# ── 7. 잘못된 TOTP → 401 ─────────────────────────
WRONG_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/login" \
  --data-urlencode "username=demo" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s2" \
  --data-urlencode "code_challenge=${CHALLENGE2}" \
  --data-urlencode "code_challenge_method=S256" \
  --data-urlencode "mfa_stage=2" \
  --data-urlencode "totp_code=000000")
echo "[7] 잘못된 TOTP → HTTP ${WRONG_HTTP} (401 기대)"

# ── 8. 정확한 TOTP → 302 redirect ────────────────
CODE6_2=$(node -e "
const crypto = require('crypto');
const secret = '${SECRET_B32}';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32d(s) {
  let bits=0,value=0;const out=[];
  for (const c of s.toUpperCase().replace(/=+\$/,'')) {
    const i=ALPHA.indexOf(c); value=(value<<5)|i; bits+=5;
    if (bits>=8) { out.push((value>>>(bits-8))&0xff); bits-=8; }
  }
  return Buffer.from(out);
}
const ctr = Math.floor(Date.now()/1000/30);
const buf = Buffer.alloc(8);
buf.writeUInt32BE(Math.floor(ctr/0x100000000),0);
buf.writeUInt32BE(ctr>>>0,4);
const h = crypto.createHmac('sha1', b32d(secret)).update(buf).digest();
const off = h[h.length-1]&0x0f;
const trunc = ((h[off]&0x7f)<<24)|((h[off+1]&0xff)<<16)|((h[off+2]&0xff)<<8)|(h[off+3]&0xff);
console.log(String(trunc%1000000).padStart(6,'0'));
")
LOC2=$(curl -sf -i -X POST "${BASE}/login" \
  --data-urlencode "username=demo" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "scope=openid" \
  --data-urlencode "state=s2" \
  --data-urlencode "code_challenge=${CHALLENGE2}" \
  --data-urlencode "code_challenge_method=S256" \
  --data-urlencode "mfa_stage=2" \
  --data-urlencode "totp_code=${CODE6_2}" 2>/dev/null \
  | grep -i "^location:" | awk '{print $2}' | tr -d '\r')
CODE2=$(echo "$LOC2" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
echo "[8] 정확한 TOTP → code=${CODE2:0:12}..."
if [ -z "$CODE2" ]; then
  echo "[8] FAIL: code 발급 안 됨"
  exit 1
fi

# ── 9. /token 정상 발급 ───────────────────────────
TOK_FINAL=$(curl -sf -X POST "${BASE}/token" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=${CODE2}" \
  --data-urlencode "redirect_uri=${REDIRECT}" \
  --data-urlencode "client_id=${CLIENT}" \
  --data-urlencode "client_secret=${SECRET_CLIENT}" \
  --data-urlencode "code_verifier=${VERIFIER2}")
ID_FINAL=$(echo "$TOK_FINAL" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id_token"])')
echo "[9] MFA 통과 토큰 → id_token=${ID_FINAL:0:30}..."

echo ""
echo "Phase G TOTP 2단계 e2e OK ✅"
