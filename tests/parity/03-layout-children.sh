#!/bin/bash
# Feature: layout-children
# Observes: / response is wrapped in layout (contains <div id="root"> and page body).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

PID=$(serve_start)
trap "serve_stop $PID" EXIT

code=$(curl -s -o "$EVIDENCE_DIR/03-home.html" -w "%{http_code}" "http://localhost:$PARITY_PORT/")
wrap="false"
grep -q '<div id="root">' "$EVIDENCE_DIR/03-home.html" && grep -q "<h1>Home</h1>" "$EVIDENCE_DIR/03-home.html" && wrap="true"
pass="false"
[ "$code" = "200" ] && [ "$wrap" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "layout-children" "$pass" "$score" "tests/evidence/03-home.html" "category=B;http_status=$code;wrap=$wrap"
