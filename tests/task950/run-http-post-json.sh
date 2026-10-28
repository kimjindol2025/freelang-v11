#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-http-post-json.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/http-post-json.c" "$WORK/http-post-json" >"$WORK/build.log" 2>&1
"$WORK/http-post-json" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/http-post-json.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
