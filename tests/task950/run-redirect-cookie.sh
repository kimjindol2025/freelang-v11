#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-redirect-cookie.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/redirect-cookie.c" "$WORK/redirect-cookie" >"$WORK/build.log" 2>&1
"$WORK/redirect-cookie" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/redirect-cookie.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
