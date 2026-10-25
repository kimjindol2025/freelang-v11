#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
COMPILER="${1:?usage: run-task936-soak.sh <stage2-compiler> <work-dir> [seconds]}"
WORK="${2:?usage: run-task936-soak.sh <stage2-compiler> <work-dir> [seconds]}"
DURATION="${3:-7200}"
RUNTIME="$ROOT/runtime"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'soak work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK/public" "$WORK/logs"
touch "$WORK/logs"/{health,static,login,jwt,write,read,parallel,attack}.log
printf 'MIXSOAK_STATIC_EXAMPLE_OK\n' >"$WORK/public/sample.txt"
export MIXSOAK_DB="$WORK/mixsoak.sqlite"

"$COMPILER" "$ROOT/tests/task936/soak-server.fl" "$WORK/soak-server.c" >"$WORK/soak-server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/soak-server" "$WORK/soak-server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/db.c" \
  "$RUNTIME/http_server.c" "$RUNTIME/auth.c" "$RUNTIME/cgc-bridge.c" -lsqlite3 -lcrypto -lm
FL_HTTP_PORT=0 "$WORK/soak-server" "$WORK/public" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  for pid in "${CLIENT_PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
CLIENT_PIDS=()
trap cleanup EXIT
PORT=""
for _ in $(seq 1 100); do
  PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/server.log" | head -n 1)"
  test -n "$PORT" && break
  kill -0 "$SERVER_PID"
  sleep 0.05
done
test -n "$PORT"
URL="http://127.0.0.1:$PORT"

worker() {
  local end=$(( $(date +%s) + DURATION ))
  while (( $(date +%s) < end )); do
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/ok" >>"$WORK/logs/health.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/health.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/static/sample.txt" >>"$WORK/logs/static.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/static.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' -d 'soak-example-password-only' "$URL/login" >>"$WORK/logs/login.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/login.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/jwt" >>"$WORK/logs/jwt.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/jwt.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' -d example "$URL/write" >>"$WORK/logs/write.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/write.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/read" >>"$WORK/logs/read.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/read.log"
    curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/parallel" >>"$WORK/logs/parallel.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/parallel.log"
    curl --path-as-is --silent --show-error --max-time 10 -o /dev/null -w '%{http_code} %{time_total}\n' "$URL/static/%2e%2e/soak-secret" >>"$WORK/logs/attack.log" 2>&1 || echo '000 10.000000' >>"$WORK/logs/attack.log"
    sleep 0.2
  done
}

server_metrics() {
  local elapsed="$1" rss fd threads zombies errors p50 p99 server_rss server_fd children
  local pid value
  rss=0; fd=0; threads=0
  server_rss="$(awk '{print int($2*4)}' "/proc/$SERVER_PID/statm")"
  server_fd="$(find "/proc/$SERVER_PID/fd" -mindepth 1 -maxdepth 1 -type l | wc -l)"
  for pid in "$SERVER_PID" $( (ps -o pid= --ppid "$SERVER_PID" 2>/dev/null || true) | awk '{$1=$1; print}') ; do
    value="$(awk '{print int($2*4)}' "/proc/$pid/statm" 2>/dev/null || true)"
    [[ "$value" =~ ^[0-9]+$ ]] || continue
    rss=$((rss + value))
    value="$(find "/proc/$pid/fd" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l || true)"
    fd=$((fd + ${value:-0}))
    value="$(find "/proc/$pid/task" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || true)"
    threads=$((threads + ${value:-0}))
  done
  children="$( (ps -o pid= --ppid "$SERVER_PID" 2>/dev/null || true) | awk 'NF {n++} END {print n+0}')"
  zombies="$( (ps -o stat= --ppid "$SERVER_PID" 2>/dev/null || true) | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
  errors=0
  for name in health static login jwt write read parallel; do
    count="$(awk '$1 != 200 {n++} END {print n+0}' "$WORK/logs/$name.log" 2>/dev/null)"
    errors=$((errors + count))
  done
  count="$(awk '$1 != 403 {n++} END {print n+0}' "$WORK/logs/attack.log" 2>/dev/null)"
  errors=$((errors + count))
  p50="$(awk '$1==200 {print $2}' "$WORK/logs/health.log" 2>/dev/null | sort -n | awk '{a[NR]=$1} END {if (NR) printf "%.6f",a[int((NR+1)*0.50)]; else print "0"}')"
  p99="$(awk '$1==200 {print $2}' "$WORK/logs/health.log" 2>/dev/null | sort -n | awk '{a[NR]=$1} END {if (NR) printf "%.6f",a[int((NR+1)*0.99)]; else print "0"}')"
  printf 'MIXSOAK_METRIC elapsed_s=%s rss_kb=%s fd=%s threads=%s zombie=%s errors=%s health_p50_s=%s health_p99_s=%s supervisor_rss_kb=%s supervisor_fd=%s active_children=%s\n' \
    "$elapsed" "$rss" "$fd" "$threads" "$zombies" "$errors" "$p50" "$p99" "$server_rss" "$server_fd" "$children"
  printf '%s %s %s %s %s %s %s\n' "$elapsed" "$rss" "$fd" "$zombies" "$server_rss" "$server_fd" "$children" >>"$WORK/metrics.tsv"
}

for _ in 1 2 3 4; do worker & CLIENT_PIDS+=("$!"); done
START="$(date +%s)"
server_metrics 0
while (( $(date +%s) - START < DURATION )); do
  elapsed=$(( $(date +%s) - START ))
  remaining=$(( DURATION - elapsed ))
  (( remaining > 600 )) && sleep 600 || { (( remaining > 0 )) && sleep "$remaining" || true; }
  elapsed=$(( $(date +%s) - START ))
  server_metrics "$elapsed"
  kill -0 "$SERVER_PID"
  (( elapsed >= DURATION )) && break
done
for pid in "${CLIENT_PIDS[@]}"; do wait "$pid"; done
CLIENT_PIDS=()
END="$(date +%s)"

TOTAL_FAILURES=0
for name in health static login jwt write read parallel; do
  count="$(awk '$1 != 200 {n++} END {print n+0}' "$WORK/logs/$name.log")"
  TOTAL_FAILURES=$((TOTAL_FAILURES + count))
done
TOTAL_5XX="$(awk '$1 >= 500 && $1 < 600 {n++} END {print n+0}' "$WORK"/logs/*.log)"
HEALTH_FAILURES="$(awk '$1 != 200 {n++} END {print n+0}' "$WORK/logs/health.log")"
ATTACK_FAILURES="$(awk '$1 != 403 {n++} END {print n+0}' "$WORK/logs/attack.log")"
WRITES_SENT="$(awk '$1 == 200 {n++} END {print n+0}' "$WORK/logs/write.log")"
DB_ROWS="$(sqlite3 "$MIXSOAK_DB" 'SELECT count(*) FROM soak_writes;')"
DB_CHECK="$(sqlite3 "$MIXSOAK_DB" 'PRAGMA integrity_check;')"
FINAL_ZOMBIES="$( (ps -o stat= --ppid "$SERVER_PID" 2>/dev/null || true) | awk '$1 ~ /^Z/ {n++} END {print n+0}')"
ZOMBIE_MAX="$(awk '$4>m {m=$4} END {print m+0}' "$WORK/metrics.tsv")"
FINAL_RSS="$(awk '{print int($2*4)}' "/proc/$SERVER_PID/statm")"
FINAL_FD="$(find "/proc/$SERVER_PID/fd" -mindepth 1 -maxdepth 1 -type l | wc -l)"
FIRST30_RSS="$(awk '$1<=1800 && $5>m {m=$5} END {print m+0}' "$WORK/metrics.tsv")"
FIRST30_FD="$(awk '$1<=1800 && $6>m {m=$6} END {print m+0}' "$WORK/metrics.tsv")"
WORKER_MAX="$(awk '$7>m {m=$7} END {print m+0}' "$WORK/metrics.tsv")"
RSS_STABLE="$(awk -v base="$FIRST30_RSS" '$1>1800 && $5>base+1024 {bad=1} END {print bad ? 0 : 1}' "$WORK/metrics.tsv")"
FD_STABLE="$(awk -v base="$FIRST30_FD" '$1>1800 && $6>base {bad=1} END {print bad ? 0 : 1}' "$WORK/metrics.tsv")"
(( FINAL_RSS <= FIRST30_RSS + 1024 )) || RSS_STABLE=0
(( FINAL_FD <= FIRST30_FD )) || FD_STABLE=0
SERVER_ALIVE=0; kill -0 "$SERVER_PID" && SERVER_ALIVE=1
HEALTH_AFTER="$(curl --silent --show-error --max-time 3 -o /dev/null -w '%{http_code}' "$URL/ok" || echo 000)"
printf 'MIXSOAK_DURATION_S=%s\nMIXSOAK_FAILURES=%s\nMIXSOAK_5XX=%s\nMIXSOAK_HEALTH_FAILURES=%s\nMIXSOAK_ATTACK_FAILURES=%s\n' \
  "$((END-START))" "$TOTAL_FAILURES" "$TOTAL_5XX" "$HEALTH_FAILURES" "$ATTACK_FAILURES"
printf 'MIXSOAK_WRITES_SENT=%s\nMIXSOAK_DB_ROWS=%s\nMIXSOAK_DB_INTEGRITY=%s\n' "$WRITES_SENT" "$DB_ROWS" "$DB_CHECK"
printf 'MIXSOAK_FINAL_RSS_KB=%s\nMIXSOAK_FINAL_FD=%s\nMIXSOAK_ZOMBIES=%s\nMIXSOAK_ZOMBIE_MAX=%s\nMIXSOAK_ACTIVE_CHILD_MAX=%s\nMIXSOAK_SERVER_ALIVE=%s\nMIXSOAK_HEALTH_AFTER=%s\n' \
  "$FINAL_RSS" "$FINAL_FD" "$FINAL_ZOMBIES" "$ZOMBIE_MAX" "$WORKER_MAX" "$SERVER_ALIVE" "$HEALTH_AFTER"
printf 'MIXSOAK_RSS_STABLE=%s\nMIXSOAK_FD_STABLE=%s\n' "$RSS_STABLE" "$FD_STABLE"
if (( TOTAL_FAILURES == 0 && TOTAL_5XX == 0 && WRITES_SENT == DB_ROWS && ATTACK_FAILURES == 0 &&
      RSS_STABLE == 1 && FD_STABLE == 1 && FINAL_ZOMBIES == 0 && ZOMBIE_MAX == 0 && WORKER_MAX <= 16 && SERVER_ALIVE == 1 )) &&
      [[ "$DB_CHECK" == ok && "$HEALTH_AFTER" == 200 ]]; then
  echo 'MIXSOAK_SUMMARY=11/11'
else
  echo 'MIXSOAK_SUMMARY=FAIL'
  exit 1
fi
