#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
WORK="${1:?usage: run-aes-encrypt.sh <work-dir>}"
mkdir -p "$WORK"
gcc -Wall -Wextra -I "$ROOT/runtime" -o "$WORK/aes-encrypt" "$ROOT/tests/task950/aes-encrypt.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/db.c" "$ROOT/runtime/http_server.c" \
  "$ROOT/runtime/auth.c" "$ROOT/runtime/cgc-bridge.c" -lsqlite3 -lcrypto -lm \
  >"$WORK/build.log" 2>&1
"$WORK/aes-encrypt" >"$WORK/actual.out"
diff -u "$ROOT/tests/task950/aes-encrypt.expected" "$WORK/actual.out"
cat "$WORK/actual.out"
