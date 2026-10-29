#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-g1-app-about.sh <compiler> <empty-work-dir>}"
WORK="${2:?usage: run-g1-app-about.sh <compiler> <empty-work-dir>}"
RUNTIME="$ROOT/runtime"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'G-1 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"
trap 'if [[ -n "${SERVER_PID:-}" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi' EXIT INT TERM
sources=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
link_sources=()
for source in "${sources[@]}"; do link_sources+=("$RUNTIME/$source"); done
"$COMPILER" "$ROOT/examples/erp-vendors/app.fl" "$WORK/app.c" >"$WORK/app.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$WORK/app" "$WORK/app.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm >"$WORK/app.build" 2>&1
FL_HTTP_PORT=0 ERP_DB_PATH="$WORK/about.sqlite" "$WORK/app" >"$WORK/server.out" 2>"$WORK/server.err" &
SERVER_PID=$!
PORT=""
for _ in $(seq 1 100); do
  PORT="$(sed -n 's/^HTTP_LISTENING=127\.0\.0\.1://p' "$WORK/server.out" | head -n 1)"
  test -n "$PORT" && break
  kill -0 "$SERVER_PID"
  sleep 0.05
done
test -n "$PORT"
printf 'APP_START=PASS\n'
ABOUT_HTTP="$(curl --silent --show-error --max-time 5 --output "$WORK/about.body" --write-out '%{http_code}' "http://127.0.0.1:$PORT/about")"
printf 'ABOUT_HTTP=%s\n' "$ABOUT_HTTP"
printf 'ABOUT_BODY_FIRST_LINE='
head -n 1 "$WORK/about.body"
test "$ABOUT_HTTP" = 200
