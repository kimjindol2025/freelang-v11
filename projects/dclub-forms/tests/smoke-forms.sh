#!/bin/bash
# smoke-forms.sh — Phase Y3 dclub-forms e2e

set -e
PORT="${DCLUB_FORMS_PORT:-30180}"
BASE="http://localhost:${PORT}"

mk_token() {
  python3 -c "
import json,base64,time
h=base64.urlsafe_b64encode(json.dumps({'alg':'RS256'}).encode()).decode().rstrip('=')
p=base64.urlsafe_b64encode(json.dumps({'sub':'$1','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
print(f'{h}.{p}.x')"
}

TOK_OWNER=$(mk_token "owner_a")
TOK_OTHER=$(mk_token "user_b")

# ── 1. /health ─────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. 무인증 폼 생성 → 401 ────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/forms" \
  -H "Content-Type: application/json" \
  -d '{"title":"T"}')
echo "[2] 무인증 /forms → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 3. 폼 생성 (3 질문) ────────────────────────
RESP=$(curl -sf -X POST "${BASE}/forms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_OWNER" \
  -d '{
    "title":"고객 만족도",
    "description":"빠른 설문",
    "questions":[
      {"type":"text","label":"이름","required":true},
      {"type":"choice","label":"평점","required":true,"options":["좋음","보통","나쁨"]},
      {"type":"long","label":"추가 의견"}
    ]
  }')
SLUG=$(echo "$RESP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["slug"])')
echo "[3] 폼 생성 OK · slug=$SLUG"

# ── 4. /f/:slug SSR 페이지 ─────────────────────
PAGE=$(curl -sf "${BASE}/f/$SLUG")
if echo "$PAGE" | grep -q "고객 만족도"; then
  echo "[4] /f/$SLUG SSR — 제목 표시 OK"
else
  echo "FAIL: SSR 제목 누락"
  exit 1
fi
if echo "$PAGE" | grep -q "type=radio"; then
  echo "[4b] choice → radio 렌더 OK"
else
  exit 1
fi

# ── 5. POST submit (정상) ──────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/f/$SLUG/submit" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "q_1=홍길동" \
  --data-urlencode "q_2=좋음" \
  --data-urlencode "q_3=좋은 서비스입니다")
echo "[5] submit (정상) → HTTP $HTTP (200 기대)"
if [ "$HTTP" != "200" ]; then exit 1; fi

# ── 6. POST submit (required 누락) → 400 ──────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/f/$SLUG/submit" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "q_3=의견만 있음")
echo "[6] required 누락 → HTTP $HTTP (400 기대)"
if [ "$HTTP" != "400" ]; then exit 1; fi

# ── 7. 응답 5건 추가 ───────────────────────────
for i in 1 2 3 4 5; do
  RATE=$([ $((i%2)) = 0 ] && echo "좋음" || echo "보통")
  curl -sf -X POST "${BASE}/f/$SLUG/submit" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "q_1=user$i" \
    --data-urlencode "q_2=$RATE" \
    --data-urlencode "q_3=test response $i" >/dev/null
done
echo "[7] 응답 5건 추가 OK"

# ── 8. 무인증 results → 401 ────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/forms/$SLUG/results")
echo "[8] 무인증 /results → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 9. 타인 results → 403 ──────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/forms/$SLUG/results" \
  -H "Authorization: Bearer $TOK_OTHER")
echo "[9] 타인 /results → HTTP $HTTP (403 기대)"
if [ "$HTTP" != "403" ]; then exit 1; fi

# ── 10. 소유자 results JSON ────────────────────
RES=$(curl -sf "${BASE}/forms/$SLUG/results" \
  -H "Authorization: Bearer $TOK_OWNER")
N=$(echo "$RES" | python3 -c 'import json,sys;print(json.load(sys.stdin)["n_responses"])')
echo "[10] /results n_responses = $N (6 기대)"
if [ "$N" != "6" ]; then exit 1; fi

# ── 11. CSV export ─────────────────────────────
CSV=$(curl -sf "${BASE}/forms/$SLUG/csv" \
  -H "Authorization: Bearer $TOK_OWNER")
HEAD=$(echo "$CSV" | head -1)
echo "[11] CSV header: $HEAD"
if echo "$HEAD" | grep -q "submitted_at"; then
  echo "[11b] CSV header OK"
else
  exit 1
fi
ROW=$(echo "$CSV" | wc -l)
echo "[11c] CSV 행 수 = $ROW (7+ 기대 — header + 6응답)"

# ── 12. 본인 폼 list ───────────────────────────
LIST=$(curl -sf "${BASE}/forms" -H "Authorization: Bearer $TOK_OWNER")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["forms"]))')
echo "[12] /forms 본인 목록 = $N (1+ 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 13. 존재하지 않는 slug → 404 ───────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/f/nonexistent_slug")
echo "[13] /f/nonexistent → HTTP $HTTP (404 기대)"
if [ "$HTTP" != "404" ]; then exit 1; fi

echo ""
echo "Phase Y3 dclub-forms e2e OK ✅"
