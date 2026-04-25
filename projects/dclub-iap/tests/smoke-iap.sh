#!/bin/bash
# smoke-iap.sh — Phase X5 dclub-iap e2e (mock backend + 가짜 토큰)

set -e
PORT="${DCLUB_IAP_PORT:-30150}"
BASE="http://localhost:${PORT}"
BACKEND_PORT=30200

# Mock backend — 모든 요청에 echo
node -e "
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('backend echo: ' + req.method + ' ' + req.url);
}).listen($BACKEND_PORT, () => console.log('mock backend on :$BACKEND_PORT'));
" &
BPID=$!
sleep 1
trap "kill $BPID 2>/dev/null || true" EXIT

# ── 1. /_iap/health ───────────────────────────
H=$(curl -sf "${BASE}/_iap/health")
echo "[1] /_iap/health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. 정책 목록 ───────────────────────────────
P=$(curl -sf "${BASE}/_iap/policies")
N=$(echo "$P" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["policies"]))')
echo "[2] 기본 정책 = $N (2 기대 — / + /admin)"
if [ "$N" -lt 2 ]; then exit 1; fi

# ── 3. 토큰 없이 / 접근 → 302 redirect ─────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/some/path")
echo "[3] 무인증 / → HTTP $HTTP (302 기대)"
if [ "$HTTP" != "302" ]; then exit 1; fi

# ── 4. 만료 토큰 → 401 ─────────────────────────
# fake JWT (header.payload.sig 형식, exp 과거)
EXP_TOKEN=$(python3 -c "
import json,base64
h = base64.urlsafe_b64encode(json.dumps({'alg':'RS256','typ':'JWT'}).encode()).decode().rstrip('=')
p = base64.urlsafe_b64encode(json.dumps({'iss':'http://localhost:30100','sub':'u1','exp':1000}).encode()).decode().rstrip('=')
print(f'{h}.{p}.fakesig')
")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/some/path" -H "Authorization: Bearer $EXP_TOKEN")
echo "[4] 만료 토큰 → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 5. 잘못된 issuer → 401 ─────────────────────
WRONG_ISS_TOKEN=$(python3 -c "
import json,base64,time
h = base64.urlsafe_b64encode(json.dumps({'alg':'RS256','typ':'JWT'}).encode()).decode().rstrip('=')
p = base64.urlsafe_b64encode(json.dumps({'iss':'https://evil.com','sub':'u1','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
print(f'{h}.{p}.fakesig')
")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/some/path" -H "Authorization: Bearer $WRONG_ISS_TOKEN")
echo "[5] 잘못된 iss → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 6. 정상 토큰 (사용자 demo) → backend 프록시 ─
GOOD_TOKEN=$(python3 -c "
import json,base64,time
h = base64.urlsafe_b64encode(json.dumps({'alg':'RS256','typ':'JWT'}).encode()).decode().rstrip('=')
p = base64.urlsafe_b64encode(json.dumps({
  'iss':'http://localhost:30100','sub':'u1','preferred_username':'demo',
  'exp':int(time.time())+3600
}).encode()).decode().rstrip('=')
print(f'{h}.{p}.fakesig')
")
RESP=$(curl -sf "${BASE}/some/path" -H "Authorization: Bearer $GOOD_TOKEN")
echo "[6] 정상 토큰 → '$RESP'"
if ! echo "$RESP" | grep -q "backend echo"; then exit 1; fi

# ── 7. /admin 정책 (admin 사용자만) — demo 접근 → 403 ─
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/admin/secret" -H "Authorization: Bearer $GOOD_TOKEN")
echo "[7] /admin demo 접근 → HTTP $HTTP (403 기대)"
if [ "$HTTP" != "403" ]; then exit 1; fi

# ── 8. /admin admin 사용자 → 통과 ──────────────
ADMIN_TOKEN=$(python3 -c "
import json,base64,time
h = base64.urlsafe_b64encode(json.dumps({'alg':'RS256','typ':'JWT'}).encode()).decode().rstrip('=')
p = base64.urlsafe_b64encode(json.dumps({
  'iss':'http://localhost:30100','sub':'u-admin','preferred_username':'admin',
  'exp':int(time.time())+3600
}).encode()).decode().rstrip('=')
print(f'{h}.{p}.fakesig')
")
RESP=$(curl -sf "${BASE}/admin/secret" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "[8] /admin admin → '$RESP'"
if ! echo "$RESP" | grep -q "backend echo"; then exit 1; fi

echo ""
echo "Phase X5 dclub-iap e2e OK ✅"
