#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-json-str.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/json-str.c" "$WORK/json-str" >"$WORK/build.log" 2>&1
"$WORK/json-str" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/json-str.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
