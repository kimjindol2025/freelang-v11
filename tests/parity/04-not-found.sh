#!/bin/bash
# Feature: not-found-404
# Observes: build --static produces dist/404.html from not-found.fl (CDN-compatible).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/04-dist"
rm -rf "$OUT"
( cd "$PARITY_ROOT" && node bootstrap.js build --static --app tests/fixtures/basic-app --out "tests/evidence/04-dist" --port 30097 > "$EVIDENCE_DIR/04-build.log" 2>&1 )
code=$?

has_file="false"
content_ok="false"
if [ -f "$OUT/404.html" ]; then
  has_file="true"
  grep -q "parity-fixture-notfound" "$OUT/404.html" && content_ok="true"
fi
pass="false"
[ "$code" = "0" ] && [ "$has_file" = "true" ] && [ "$content_ok" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "not-found-404" "$pass" "$score" "tests/evidence/04-dist/404.html" "category=B;build_exit=$code;has_file=$has_file;content_ok=$content_ok"
