#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-http-get-json.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/http-get-json.c" "$WORK/http-get-json" >"$WORK/build.log" 2>&1
"$WORK/http-get-json" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/http-get-json.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
