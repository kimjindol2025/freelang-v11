#!/bin/bash
# smoke-keep.sh — Phase Y4 dclub-keep e2e

set -e
PORT="${DCLUB_KEEP_PORT:-30190}"
BASE="http://localhost:${PORT}"

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

# ── 2. 무인증 POST /notes → 401 ───────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -d '{"content":"x"}')
echo "[2] 무인증 POST → HTTP $HTTP (401 기대)"
if [ "$HTTP" != "401" ]; then exit 1; fi

# ── 3. user_a 메모 3건 생성 ────────────────────
ID1=$(curl -sf -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"title":"안녕 한글","content":"한국어 검색 테스트입니다","color":"#1a2028"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
echo "[3] note 1 id=$ID1"

ID2=$(curl -sf -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"title":"개발 메모","content":"FreeLang v11 자주권 SaaS"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
echo "[3] note 2 id=$ID2"

ID3=$(curl -sf -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"title":"오늘 일정","content":"회의 + 점심 약속"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
echo "[3] note 3 id=$ID3"

# ── 4. content 누락 → 400 ──────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/notes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"title":"비어있음"}')
echo "[4] content 누락 → HTTP $HTTP (400 기대)"
if [ "$HTTP" != "400" ]; then exit 1; fi

# ── 5. 본인 list = 3 ───────────────────────────
LIST=$(curl -sf "${BASE}/notes" -H "Authorization: Bearer $TOK_A")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["notes"]))')
echo "[5] user_a list = $N (3 기대)"
if [ "$N" != "3" ]; then exit 1; fi

# ── 6. user_b list = 0 (격리) ──────────────────
LIST=$(curl -sf "${BASE}/notes" -H "Authorization: Bearer $TOK_B")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["notes"]))')
echo "[6] user_b list = $N (0 기대 — 격리)"
if [ "$N" != "0" ]; then exit 1; fi

# ── 7. FTS5 한글 검색 ──────────────────────────
SEARCH=$(curl -sf --get --data-urlencode "q=한국어" "${BASE}/notes/search" -H "Authorization: Bearer $TOK_A")
N=$(echo "$SEARCH" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["results"]))')
echo "[7] '한국어' 검색 결과 = $N (1 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 8. FTS5 영어 검색 ──────────────────────────
SEARCH=$(curl -sf "${BASE}/notes/search?q=FreeLang" -H "Authorization: Bearer $TOK_A")
N=$(echo "$SEARCH" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["results"]))')
echo "[8] 'FreeLang' 검색 결과 = $N (1 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 9. user_b 같은 검색 = 0 ────────────────────
SEARCH=$(curl -sf --get --data-urlencode "q=한국어" "${BASE}/notes/search" -H "Authorization: Bearer $TOK_B")
N=$(echo "$SEARCH" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["results"]))')
echo "[9] user_b '한국어' 검색 = $N (0 기대 — owner 격리)"
if [ "$N" != "0" ]; then exit 1; fi

# ── 10. PUT /notes/:id (수정) ──────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE}/notes/$ID1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_A" \
  -d '{"content":"수정된 내용 한국어","pinned":1}')
echo "[10] PUT /notes/$ID1 → HTTP $HTTP (200 기대)"
if [ "$HTTP" != "200" ]; then exit 1; fi

# ── 11. 타인 수정 시도 → 404 (격리) ─────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE}/notes/$ID1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK_B" \
  -d '{"content":"hack"}')
echo "[11] 타인 PUT → HTTP $HTTP (404 기대)"
if [ "$HTTP" != "404" ]; then exit 1; fi

# ── 12. SSR / (anonymous) ─────────────────────
PAGE=$(curl -sf "${BASE}/")
if echo "$PAGE" | grep -q "로그인이 필요"; then
  echo "[12] SSR / (무인증) — 안내 페이지 OK"
else
  exit 1
fi

# ── 13. SSR / (Bearer) ─────────────────────────
PAGE=$(curl -sf "${BASE}/" -H "Authorization: Bearer $TOK_A")
if echo "$PAGE" | grep -q "user_a 의 메모"; then
  echo "[13] SSR / (Bearer) — 그리드 OK"
else
  exit 1
fi

# ── 14. DELETE /notes/:id ──────────────────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BASE}/notes/$ID3" \
  -H "Authorization: Bearer $TOK_A")
echo "[14] DELETE → HTTP $HTTP (200 기대)"
if [ "$HTTP" != "200" ]; then exit 1; fi

LIST=$(curl -sf "${BASE}/notes" -H "Authorization: Bearer $TOK_A")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["notes"]))')
echo "[14b] 삭제 후 list = $N (2 기대)"
if [ "$N" != "2" ]; then exit 1; fi

echo ""
echo "Phase Y4 dclub-keep e2e OK ✅"
