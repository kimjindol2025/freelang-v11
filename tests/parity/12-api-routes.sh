#!/bin/bash
# Feature: api-routes
# Observes: app/api/echo/route.fl dispatches POST→echo, GET→method marker.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

PID=$(serve_start)
trap "serve_stop $PID" EXIT

OUT_POST="$EVIDENCE_DIR/12-api-post.json"
OUT_GET="$EVIDENCE_DIR/12-api-get.json"

post_code=$(curl -s -o "$OUT_POST" -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"n":7,"msg":"hi"}' \
  "http://localhost:$PARITY_PORT/api/echo")
get_code=$(curl -s -o "$OUT_GET" -w "%{http_code}" "http://localhost:$PARITY_PORT/api/echo")

post_ok="false"; grep -q '"n":7' "$OUT_POST" && grep -q '"msg":"hi"' "$OUT_POST" && post_ok="true"
get_ok="false"; grep -q '"method":"GET"' "$OUT_GET" && get_ok="true"
pass="false"
[ "$post_code" = "200" ] && [ "$get_code" = "200" ] && [ "$post_ok" = "true" ] && [ "$get_ok" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "api-routes" "$pass" "$score" "tests/evidence/12-api-post.json" "category=B;post=$post_code,$post_ok;get=$get_code,$get_ok"
