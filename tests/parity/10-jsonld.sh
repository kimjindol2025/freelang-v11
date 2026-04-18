#!/bin/bash
# Feature: jsonld-article
# Observes: jsonld_article outputs <script type="application/ld+json"> with @type=Article.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/10-jsonld.html"
( cd "$PARITY_ROOT" && node bootstrap.js run tests/fixtures/stdlib-probes/jsonld.fl > "$OUT" 2>&1 )
code=$?
tag="false"; grep -q '<script type="application/ld+json">' "$OUT" && tag="true"
type="false"; grep -q '"@type":"Article"' "$OUT" && type="true"
pass="false"
[ "$code" = "0" ] && [ "$tag" = "true" ] && [ "$type" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "jsonld-article" "$pass" "$score" "tests/evidence/10-jsonld.html" "category=B;exit=$code;script_tag=$tag;type_article=$type"
