#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-shell-exec-stdout.sh <work-dir>}"
mkdir -p "$WORK"
bash "$ROOT/scripts/build-cgc-native.sh" "$ROOT/tests/task950/shell-exec-stdout.c" "$WORK/shell-exec-stdout" >"$WORK/build.log" 2>&1
"$WORK/shell-exec-stdout" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/shell-exec-stdout.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
