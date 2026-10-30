#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
COMPILER="${1:?usage: run-style-random.sh <compiler> <work-dir>}"
WORK="${2:?usage: run-style-random.sh <compiler> <work-dir>}"
mkdir -p "$WORK"
"$COMPILER" "$ROOT/tests/task952/style-random.fl" "$WORK/style-random.c" >"$WORK/compile.log" 2>&1
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/style-random.c" "$WORK/style-random" >"$WORK/build.log" 2>&1
"$WORK/style-random" >"$WORK/actual.out"
diff -u "$ROOT/tests/task952/style-random.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
