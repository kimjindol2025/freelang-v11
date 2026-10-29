#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task934.sh <stage2-compiler> <work-dir>}"
WORK="${2:?usage: run-task934.sh <stage2-compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"

"$COMPILER" "$ROOT/tests/task934/http-attack-server.fl" "$WORK/server.c" >"$WORK/server.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/server" "$WORK/server.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/http_server.c" \
  "$RUNTIME/cgc-bridge.c" -lm
gcc -std=c11 -Wall -Wextra -Werror -o "$WORK/http-attack-client" "$ROOT/tests/task934/http-attack-client.c"
"$COMPILER" "$ROOT/tests/task934/http-attack.fl" "$WORK/attack.c" >"$WORK/attack.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/attack" "$WORK/attack.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" -lm

FL_HTTP_PORT=0 "$WORK/server" >"$WORK/server.log" 2>&1 &
server_pid=$!
cleanup() {
  if kill -0 "$server_pid" 2>/dev/null; then kill "$server_pid" 2>/dev/null || true; fi
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for _ in $(seq 1 100); do
  port="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/server.log" | head -n 1)"
  test -n "$port" && break
  sleep 0.02
done
test -n "${port:-}"
fd_count() { find "/proc/$server_pid/fd" -mindepth 1 -maxdepth 1 -type l | wc -l | tr -d ' '; }
rss_kb() { awk '/^VmRSS:/ {print $2}' "/proc/$server_pid/status"; }
fd_before="$(fd_count)"
rss_before="$(rss_kb)"
"$WORK/attack" "$WORK/http-attack-client" "$port" >"$WORK/attack.log" 2>&1
sleep 0.7
fd_after="$(fd_count)"
rss_after="$(rss_kb)"
test "$fd_before" = "$fd_after"
delta=$((rss_after - rss_before)); (( delta < 0 )) && delta=$((-delta))
test "$delta" -le 8192
kill -0 "$server_pid"
printf 'HTTPATK_FD_BEFORE=%s\nHTTPATK_FD_AFTER=%s\n' "$fd_before" "$fd_after"
printf 'HTTPATK_RSS_BEFORE_KB=%s\nHTTPATK_RSS_AFTER_KB=%s\nHTTPATK_RSS_DELTA_KB=%s\n' "$rss_before" "$rss_after" "$delta"
cat "$WORK/attack.log"
kill "$server_pid"
wait "$server_pid"
trap - EXIT INT TERM
printf 'HTTPATK_SERVER_STOPPED=PASS\n'
