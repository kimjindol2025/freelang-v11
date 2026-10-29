#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-http-post-form.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/http-post-form.c" "$WORK/http-post-form" >"$WORK/build.log" 2>&1
"$WORK/http-post-form" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/http-post-form.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
