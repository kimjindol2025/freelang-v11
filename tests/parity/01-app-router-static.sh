#!/bin/bash
# Feature: app-router-static
# Observes: GET /about returns 200 and body contains "<h1>About</h1>".
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

PID=$(serve_start)
trap "serve_stop $PID" EXIT

code=$(curl -s -o "$EVIDENCE_DIR/01-about.html" -w "%{http_code}" "http://localhost:$PARITY_PORT/about")
match="false"
grep -q "<h1>About</h1>" "$EVIDENCE_DIR/01-about.html" && match="true"
pass="false"
[ "$code" = "200" ] && [ "$match" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")

emit_result "app-router-static" "$pass" "$score" "tests/evidence/01-about.html" "category=B;http_status=$code;body_match=$match"
