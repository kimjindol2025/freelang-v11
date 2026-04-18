#!/bin/bash
# Feature: markdown-to-html
# Observes: markdown_to_html converts "# Hello" + bold → <h1> + <strong>.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/07-markdown.html"
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/md.fl > "$OUT" 2>&1 )
code=$?
h1="false"; grep -q "<h1>Hello</h1>" "$OUT" && h1="true"
st="false"; grep -q "<strong>bold</strong>" "$OUT" && st="true"
pass="false"
[ "$code" = "0" ] && [ "$h1" = "true" ] && [ "$st" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "markdown-to-html" "$pass" "$score" "tests/evidence/07-markdown.html" "category=B;exit=$code;h1=$h1;strong=$st"
