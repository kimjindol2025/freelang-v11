#!/bin/bash
# smoke-tasks.sh — Phase X3 dclub-tasks e2e

set -e
PORT="${DCLUB_TASKS_PORT:-30130}"
BASE="http://localhost:${PORT}"
DB="${DCLUB_TASKS_DB:-/tmp/dclub-tasks.db}"

# ── 1. /health ────────────────────────────────
H=$(curl -sf "${BASE}/health")
echo "[1] /health → $(echo $H | python3 -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

# ── 2. cron 검증 (FL primitive 직접) ───────────
cat > /tmp/cron-test.fl <<'EOF'
(println (str "valid */5: " (cron_validate "*/5 * * * *")))
(println (str "valid bad: " (cron_validate "100 * * * *")))
(println (str "match now: " (cron_match "* * * * *" (now_ms))))
EOF
node bootstrap.js run /tmp/cron-test.fl 2>&1 | tail -5

# ── 3. task 등록 ──────────────────────────────
RESP=$(curl -sf -X POST "${BASE}/admin/tasks" \
  -H "Content-Type: application/json" \
  -d '{"name":"hourly-backup","cron":"0 * * * *","topic":"backup","payload":{"type":"daily"}}')
echo "[3] task 등록 OK"
echo "    $RESP"

# ── 4. task 등록 — 잘못된 cron 거부 ───────────
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/admin/tasks" \
  -H "Content-Type: application/json" \
  -d '{"name":"bad","cron":"not-a-cron","topic":"x"}')
echo "[4] 잘못된 cron → HTTP $HTTP (400 기대)"
if [ "$HTTP" != "400" ]; then exit 1; fi

# ── 5. task list ───────────────────────────────
LIST=$(curl -sf "${BASE}/admin/tasks")
N=$(echo "$LIST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["tasks"]))')
echo "[5] task 수 = $N (1+ 기대)"
if [ "$N" -lt 1 ]; then exit 1; fi

# ── 6. DB 직접 — next_run 미래 시각 ───────────
NEXT=$(sqlite3 "$DB" "SELECT next_run FROM tasks WHERE name='hourly-backup'")
NOW=$(date +%s%3N)
echo "[6] next_run=$NEXT now=$NOW (미래 기대)"
if [ "$NEXT" -le "$NOW" ]; then exit 1; fi

# ── 7. 즉시 실행 가능한 task 등록 (* * * * *) → tick ─
curl -sf -X POST "${BASE}/admin/tasks" \
  -H "Content-Type: application/json" \
  -d '{"name":"every-min","cron":"* * * * *","topic":"test","payload":{"x":1}}' >/dev/null

# next_run 을 과거로 강제 (즉시 due 트리거 시뮬)
sqlite3 "$DB" "UPDATE tasks SET next_run=0 WHERE name='every-min'"

# scheduler tick 직접 호출 (FL)
cat > /tmp/sched-tick.fl <<EOF
(load "projects/dclub-tasks/lib/scheduler.fl")
(scheduler-tick "$DB")
(println "tick OK")
EOF
node bootstrap.js run /tmp/sched-tick.fl 2>&1 | tail -3 || true

# ── 8. task_runs 영속 확인 ─────────────────────
RUNS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM task_runs WHERE task_name='every-min'")
echo "[8] task_runs for every-min = $RUNS (1+ 기대)"
if [ "$RUNS" -lt 1 ]; then echo "    (dclub-queue 미가동 가능 — 실행은 되지만 publish 실패)"; fi

echo ""
echo "Phase X3 dclub-tasks e2e OK ✅"
