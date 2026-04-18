#!/bin/bash
# Feature: parallel-render
# Observes: build log contains "concurrency=N" with N >= 2; build.done ms=<N> printed.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/_lib.sh"

OUT="$EVIDENCE_DIR/06-dist"
LOG="$EVIDENCE_DIR/06-build.log"
rm -rf "$OUT"
( cd "$PARITY_ROOT" && node bootstrap.js build --static --app tests/fixtures/basic-app --out "tests/evidence/06-dist" --port 30095 --concurrency 4 > "$LOG" 2>&1 )
code=$?

conc="false"
grep -q "concurrency=4" "$LOG" && conc="true"
done="false"
grep -q "build.done" "$LOG" && done="true"
pass="false"
[ "$code" = "0" ] && [ "$conc" = "true" ] && [ "$done" = "true" ] && pass="true"
score=$([ "$pass" = "true" ] && echo "0.95" || echo "0.0")
emit_result "parallel-render" "$pass" "$score" "tests/evidence/06-build.log" "category=B;build_exit=$code;concurrency_log=$conc;done_log=$done"
