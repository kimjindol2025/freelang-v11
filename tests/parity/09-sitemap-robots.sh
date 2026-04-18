#!/bin/bash
# Feature: sitemap-robots
# Observes: sitemap_xml produces <urlset>, robots_txt produces User-agent/Disallow/Sitemap lines.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT_SM="$EVIDENCE_DIR/09-sitemap.xml"
OUT_RB="$EVIDENCE_DIR/09-robots.txt"
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/sitemap.fl > "$OUT_SM" 2>&1 )
c1=$?
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/robots.fl > "$OUT_RB" 2>&1 )
c2=$?

us="false"; grep -q "<urlset" "$OUT_SM" && us="true"
loc="false"; grep -q "<loc>https://ex.com/about</loc>" "$OUT_SM" && loc="true"
ua="false"; grep -q "^User-agent:" "$OUT_RB" && ua="true"
dis="false"; grep -q "^Disallow: /admin" "$OUT_RB" && dis="true"
sm="false"; grep -q "^Sitemap:" "$OUT_RB" && sm="true"
pass="false"
[ "$c1" = "0" ] && [ "$c2" = "0" ] && [ "$us" = "true" ] && [ "$loc" = "true" ] && [ "$ua" = "true" ] && [ "$dis" = "true" ] && [ "$sm" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "sitemap-robots" "$pass" "$score" "tests/evidence/09-sitemap.xml" "category=B;sitemap=$us,$loc;robots=$ua,$dis,$sm"
