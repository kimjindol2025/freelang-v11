#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-scrypt-kdf.sh <work-dir>}"
mkdir -p "$WORK"
gcc -Wall -Wextra -I "$ROOT/runtime" -o "$WORK/scrypt-kdf" "$ROOT/tests/task950/scrypt-kdf.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm \
  >"$WORK/build.log" 2>&1
"$WORK/scrypt-kdf" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/scrypt-kdf.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
