#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-http-head-delete.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/http-head-delete.c" "$WORK/http-head-delete" >"$WORK/build.log" 2>&1
"$WORK/http-head-delete" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/http-head-delete.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
