#!/bin/bash
# Feature: ssg-static-export
# Observes: build --static produces index.html, about/index.html, and both dynamic
# [slug] pages (/post/hello, /post/world) resolved via generate-static-params.fl.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/05-dist"
rm -rf "$OUT"
( cd "$PARITY_ROOT" && node bootstrap.js build --static --app tests/fixtures/basic-app --out "tests/evidence/05-dist" --port 30096 > "$EVIDENCE_DIR/05-build.log" 2>&1 )
code=$?

have_home=$([ -f "$OUT/index.html" ] && echo "true" || echo "false")
have_about=$([ -f "$OUT/about/index.html" ] && echo "true" || echo "false")
have_hello=$([ -f "$OUT/post/hello/index.html" ] && echo "true" || echo "false")
have_world=$([ -f "$OUT/post/world/index.html" ] && echo "true" || echo "false")
pass="false"
[ "$code" = "0" ] && [ "$have_home" = "true" ] && [ "$have_about" = "true" ] && [ "$have_hello" = "true" ] && [ "$have_world" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "ssg-static-export" "$pass" "$score" "tests/evidence/05-dist" "category=B;home=$have_home;about=$have_about;hello=$have_hello;world=$have_world"
