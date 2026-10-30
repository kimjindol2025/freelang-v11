#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-base64-app.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/base64-app.c" "$WORK/base64-app" >"$WORK/build.log" 2>&1
"$WORK/base64-app" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/base64-app.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
