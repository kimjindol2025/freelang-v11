#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-format-date.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/format-date.c" "$WORK/format-date" >"$WORK/build.log" 2>&1
"$WORK/format-date" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/format-date.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
