#!/bin/bash
# Feature: app-router-dynamic
# Observes: GET /post/hello returns 200 and body contains "slug=hello"; /post/world → "slug=world".
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

PID=$(serve_start)
trap "serve_stop $PID" EXIT

c1=$(curl -s -o "$EVIDENCE_DIR/02-post-hello.html" -w "%{http_code}" "http://localhost:$PARITY_PORT/post/hello")
c2=$(curl -s -o "$EVIDENCE_DIR/02-post-world.html" -w "%{http_code}" "http://localhost:$PARITY_PORT/post/world")
m1="false"; grep -q "slug=hello" "$EVIDENCE_DIR/02-post-hello.html" && m1="true"
m2="false"; grep -q "slug=world" "$EVIDENCE_DIR/02-post-world.html" && m2="true"
pass="false"
[ "$c1" = "200" ] && [ "$c2" = "200" ] && [ "$m1" = "true" ] && [ "$m2" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "app-router-dynamic" "$pass" "$score" "tests/evidence/02-post-hello.html" "category=B;hello=$c1,$m1;world=$c2,$m2"
