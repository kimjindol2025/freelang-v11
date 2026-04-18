#!/bin/bash
# Feature: rss-atom-feed
# Observes: rss_feed produces <rss>, <channel>, <item>, <atom:link rel="self">.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/08-rss.xml"
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/rss.fl > "$OUT" 2>&1 )
code=$?
rss="false"; grep -q '<rss version="2.0"' "$OUT" && rss="true"
ch="false"; grep -q '<channel>' "$OUT" && ch="true"
item="false"; grep -q '<item>' "$OUT" && item="true"
self="false"; grep -q 'rel="self"' "$OUT" && self="true"
pass="false"
[ "$code" = "0" ] && [ "$rss" = "true" ] && [ "$ch" = "true" ] && [ "$item" = "true" ] && [ "$self" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "rss-atom-feed" "$pass" "$score" "tests/evidence/08-rss.xml" "category=B;exit=$code;rss=$rss;channel=$ch;item=$item;self=$self"
