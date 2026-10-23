#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/compiler.c"
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/compiler.c" "$WORK/cgc" >/dev/null

"$WORK/cgc" "$ROOT/tests/cgc-symbols.fl" "$WORK/symbols.c"
gcc -Wall -Wextra -I "$ROOT/runtime" -o "$WORK/symbols" "$WORK/symbols.c" \
  "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
  "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
  "$ROOT/runtime/json.c" "$ROOT/runtime/cgc-bridge.c" -lm
RESULT="$("$WORK/symbols")"
test "$RESULT" = 'SYMBOL_RESULTS=slash-1,slash-2,slash-3,underscore,question,bang'
printf 'PASS slash names and punctuation separation\n'

if "$WORK/cgc" "$ROOT/tests/cgc-symbol-collision.fl" "$WORK/collision.c" >"$WORK/collision.log" 2>&1; then
  cat "$WORK/collision.log"
  exit 1
fi
grep -q '\[CGC-ERR\] C symbol collision:' "$WORK/collision.log"
printf 'PASS C symbol collision rejected\n'

if "$WORK/cgc" "$ROOT/tests/cgc-invalid-c.fl" "$WORK/invalid.c" >"$WORK/invalid.log" 2>&1; then
  cat "$WORK/invalid.log"
  exit 1
fi
grep -q 'generated C failed gcc -fsyntax-only' "$WORK/invalid.log"
grep -q 'error:' "$WORK/invalid.log"
printf 'PASS invalid generated C rejected\n'
printf 'CGC_SYMBOL_SUMMARY=5/5\n'
