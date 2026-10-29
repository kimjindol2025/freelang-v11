#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task946-helpers.sh <compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task946-helpers.sh <compiler> <empty-work-dir>}"
mkdir -p "$WORK"
"$COMPILER" "$ROOT/tests/task946/request-helpers.fl" "$WORK/request-helpers.c" >"$WORK/request-helpers.compile" 2>&1
gcc -w -I "$ROOT/runtime" -o "$WORK/request-helpers" "$WORK/request-helpers.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm
"$WORK/request-helpers" >"$WORK/request-helpers.out"
diff -u "$ROOT/tests/task946/request-helpers.expected" "$WORK/request-helpers.out"
printf 'REQUEST_HELPERS_SUMMARY=6/6\n'
