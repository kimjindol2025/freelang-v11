#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-shell.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/shell.c" "$WORK/shell" >"$WORK/build.log" 2>&1
"$WORK/shell" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/shell.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
