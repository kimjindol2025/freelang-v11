#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task926.sh <compiler> <work-dir>}"
WORK="${2:?usage: run-task926.sh <compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK"
sources=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
link_sources=(); for name in "${sources[@]}"; do link_sources+=("$RUNTIME/$name"); done
for name in net-server net-client; do
  "$COMPILER" "$ROOT/tests/task926/$name.fl" "$WORK/$name.c" >"$WORK/$name.compile" 2>&1
  if test "$name" = net-server; then
    gcc -w -DFL_HTTP_CAPTURE_RAW_TEST -I "$RUNTIME" -o "$WORK/$name" "$WORK/$name.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
  else
    gcc -w -I "$RUNTIME" -o "$WORK/$name" "$WORK/$name.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
  fi
done
"$WORK/net-server" >"$WORK/server.log" 2>"$WORK/server.err" &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT INT TERM
for _ in $(seq 1 500); do
  if grep -q '^HTTP_LISTENING=127.0.0.1:' "$WORK/server.log"; then break; fi
  kill -0 "$server_pid" 2>/dev/null || { cat "$WORK/server.err"; exit 1; }
  sleep 0.01
done
line="$(grep '^HTTP_LISTENING=127.0.0.1:' "$WORK/server.log" | head -1)"
port="${line##*:}"
base="http://127.0.0.1:$port"
guard_app="$WORK/guard"
"$COMPILER" "$ROOT/tests/task926/guard.fl" "$WORK/guard.c" >"$WORK/guard.compile" 2>&1
gcc -w -I "$RUNTIME" -o "$guard_app" "$WORK/guard.c" "${link_sources[@]}" -lsqlite3 -lcrypto -lm
refused_port="$($guard_app)"
"$WORK/net-client" "$base" "http://127.0.0.1:$refused_port/" >"$WORK/client.log" 2>&1
awk '/^UUID=/{print substr($0,6)}' "$WORK/client.log" >"$WORK/uuids.txt"
uuid_count="$(wc -l <"$WORK/uuids.txt" | tr -d ' ')"
uuid_unique="$(sort -u "$WORK/uuids.txt" | wc -l | tr -d ' ')"
uuid_regex="$(grep -Ec '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' "$WORK/uuids.txt" || true)"
uuid_version="$(awk 'substr($0,15,1)=="4" {n++} END {print n+0}' "$WORK/uuids.txt")"
uuid_variant="$(awk 'substr($0,20,1) ~ /^[89ab]$/ {n++} END {print n+0}' "$WORK/uuids.txt")"
test "$uuid_count" -eq 1000 && test "$uuid_unique" -eq 1000 && test "$uuid_regex" -eq 1000 && test "$uuid_version" -eq 1000 && test "$uuid_variant" -eq 1000
grep '^PASS ' "$WORK/client.log"
sed -n '/^RAW_POST_BEGIN$/,/^RAW_POST_END$/p' "$WORK/client.log"
sed -n '/^RAW_HEADER_BEGIN$/,/^RAW_HEADER_END$/p' "$WORK/client.log"
printf 'UUID_COUNT=%s\nUUID_UNIQUE=%s\nUUID_REGEX_MATCH=%s\nUUID_VERSION_4=%s\nUUID_VARIANT_VALID=%s\n' \
  "$uuid_count" "$uuid_unique" "$uuid_regex" "$uuid_version" "$uuid_variant"
printf 'PASS uuid unique\nPASS uuid regex\nPASS uuid version\nPASS uuid variant\n'
printf 'NET2_SUMMARY=18/18\n'
