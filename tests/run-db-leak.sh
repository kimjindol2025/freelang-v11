#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-db-leak.sh <empty-temp-dir>}"
test ! -e "$WORK" || test -z "$(find "$WORK" -mindepth 1 -print -quit)"
mkdir -p "$WORK"
R="$ROOT/runtime"
gcc -w -I "$R" -o "$WORK/db-leak" "$ROOT/tests/db-leak.c" \
  "$R/core.c" "$R/collection.c" "$R/io.c" "$R/math.c" "$R/error.c" \
  "$R/process.c" "$R/json.c" "$R/cgc-bridge.c" "$R/db.c" \
  "$R/http_server.c" "$R/auth.c" -lsqlite3 -lcrypto -lm -Wl,--wrap=sqlite3_exec
failed=0
for mode in params savepoint release; do
  "$WORK/db-leak" "$mode" "$WORK/$mode.sqlite" || failed=1
done
exit "$failed"
