#!/bin/bash
# smoke-queue.sh — Phase X1 dclub-queue e2e
#
# 시나리오:
#   1. publish 5건
#   2. /stats 조회 → queued=5
#   3. dequeue (FL 호출) → in_flight + ack → done
#   4. fail-test 1건 publish → nack → backoff 적용 (next_run_at 미래)

set -e
PORT="${DCLUB_QUEUE_PORT:-30110}"
BASE="http://localhost:${PORT}"
DB="${DCLUB_QUEUE_DB:-/tmp/dclub-queue.db}"

# ── 1. publish 5건 ──────────────────────────────
for i in 1 2 3 4 5; do
  curl -sf -X POST "${BASE}/q/test/publish" \
    -H "Content-Type: application/json" \
    -d "{\"n\":$i,\"msg\":\"hello-$i\"}" >/dev/null
done
echo "[1] publish 5건 OK"

# ── 2. /stats ───────────────────────────────────
sleep 0.3
STATS=$(curl -sf "${BASE}/q/test/stats")
QUEUED=$(echo "$STATS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("queued",0))')
echo "[2] stats queued=$QUEUED"
if [ "$QUEUED" -lt 5 ]; then echo "[2] FAIL"; exit 1; fi

# ── 3. /q/topics 등록 확인 ─────────────────────
TOPICS=$(curl -sf "${BASE}/q/topics")
T_COUNT=$(echo "$TOPICS" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["topics"]))')
echo "[3] 등록 토픽 수 = $T_COUNT (3+ 기대 — test/fail-test/mail-send)"
if [ "$T_COUNT" -lt 3 ]; then exit 1; fi

# ── 4. DB 직접 검증 ────────────────────────────
DB_QUEUED=$(sqlite3 "$DB" "SELECT COUNT(*) FROM q_messages WHERE topic='test' AND status='queued'")
echo "[4] DB queued = $DB_QUEUED"
if [ "$DB_QUEUED" -lt 5 ]; then exit 1; fi

# ── 5. atomic dequeue 검증 (FL 직접 호출) ───────
cat > /tmp/dq-test.fl <<EOF
(load "projects/dclub-queue/lib/queue.fl")
(define m (q-dequeue "$DB" "test" "smoke-worker"))
(if (= \$m nil)
  (println "no-msg")
  (do
    (println (str "got id=" (get \$m "id") " payload=" (get \$m "payload")))
    (q-ack "$DB" (get \$m "id"))
    (println "ack OK")))
EOF
node bootstrap.js run /tmp/dq-test.fl 2>&1 | tail -3

# ── 6. 처리 후 done 1건 ─────────────────────────
DB_DONE=$(sqlite3 "$DB" "SELECT COUNT(*) FROM q_messages WHERE topic='test' AND status='done'")
echo "[6] DB done = $DB_DONE (1 기대)"
if [ "$DB_DONE" != "1" ]; then exit 1; fi

# ── 7. backoff 검증 — fail-test publish 후 nack ─
curl -sf -X POST "${BASE}/q/fail-test/publish" \
  -H "Content-Type: application/json" -d '{"x":1}' >/dev/null
cat > /tmp/dq-fail.fl <<EOF
(load "projects/dclub-queue/lib/queue.fl")
(define m (q-dequeue "$DB" "fail-test" "smoke-worker"))
(q-nack "$DB" (get \$m "id") "intentional fail")
EOF
node bootstrap.js run /tmp/dq-fail.fl 2>&1 | tail -2

# 다시 queued 상태 + attempt=1 + next_run_at 미래
ATTEMPT=$(sqlite3 "$DB" "SELECT attempt FROM q_messages WHERE topic='fail-test' ORDER BY id DESC LIMIT 1")
NEXT=$(sqlite3 "$DB" "SELECT next_run_at FROM q_messages WHERE topic='fail-test' ORDER BY id DESC LIMIT 1")
NOW=$(date +%s%3N)
echo "[7] attempt=$ATTEMPT next_run_at=$NEXT now=$NOW (next > now 기대 — 1분 backoff)"
if [ "$ATTEMPT" -lt 1 ]; then exit 1; fi
if [ "$NEXT" -le "$NOW" ]; then echo "FAIL: backoff 적용 안 됨"; exit 1; fi

echo ""
echo "Phase X1 dclub-queue e2e OK ✅"
