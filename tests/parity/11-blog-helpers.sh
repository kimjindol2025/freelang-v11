#!/bin/bash
# Feature: blog-helpers
# Observes: blog_all_tags returns sorted unique tags; blog_tag_counts returns map;
#           blog_posts_by_tag filters correctly.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/11-blog.log"
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/blog.fl > "$OUT" 2>&1 )
code=$?
tags_line="$(sed -n '1p' "$OUT")"
counts_line="$(sed -n '2p' "$OUT")"
filter_line="$(sed -n '3p' "$OUT")"

tags_ok="false"; [ "$tags_line" = '["alpha","beta","gamma"]' ] && tags_ok="true"
counts_ok="false"
case "$counts_line" in
  *'"alpha":2'*'"beta":2'*'"gamma":2'*|*'"beta":2'*'"alpha":2'*) counts_ok="true" ;;
esac
[ "$counts_ok" = "false" ] && echo "$counts_line" | grep -q '"alpha":2' && echo "$counts_line" | grep -q '"beta":2' && echo "$counts_line" | grep -q '"gamma":2' && counts_ok="true"
filter_ok="false"
echo "$filter_line" | grep -q '"slug":"p1"' && echo "$filter_line" | grep -q '"slug":"p2"' && ! echo "$filter_line" | grep -q '"slug":"p3"' && filter_ok="true"

pass="false"
[ "$code" = "0" ] && [ "$tags_ok" = "true" ] && [ "$counts_ok" = "true" ] && [ "$filter_ok" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "blog-helpers" "$pass" "$score" "tests/evidence/11-blog.log" "category=B;exit=$code;tags=$tags_ok;counts=$counts_ok;filter=$filter_ok"
