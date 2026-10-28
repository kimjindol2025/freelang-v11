#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-js-keys.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/js-keys.c" "$WORK/js-keys" >"$WORK/build.log" 2>&1
"$WORK/js-keys" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/js-keys.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
