#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-measure-time.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/measure-time.c" "$WORK/measure-time" >"$WORK/build.log" 2>&1
"$WORK/measure-time" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/measure-time.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
