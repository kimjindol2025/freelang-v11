#!/usr/bin/env bash
# Rebuild the native C-target compiler from self/all-c.fl.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT="${1:-$ROOT_DIR/bin/cgc-bin}"
TMP_JS="${TMP_JS:-/tmp/L1_all_c.js}"
TMP_C="${TMP_C:-/tmp/all-c-native.c}"
TMP_BIN="${TMP_BIN:-/tmp/cgc-bin-new}"
LOG="${LOG:-/tmp/all-c-native.log}"

"$SCRIPT_DIR/build-all-c.sh"

node "$ROOT_DIR/bootstrap.js" compile "$ROOT_DIR/self/all-c.fl" -o "$TMP_JS"
timeout 60 node "$TMP_JS" compile "$ROOT_DIR/self/all-c.fl" -o "$TMP_C" >"$LOG" 2>&1
cat "$LOG"

gcc "$TMP_C" \
  "$ROOT_DIR/runtime/core.c" \
  "$ROOT_DIR/runtime/collection.c" \
  "$ROOT_DIR/runtime/io.c" \
  "$ROOT_DIR/runtime/math.c" \
  "$ROOT_DIR/runtime/error.c" \
  "$ROOT_DIR/runtime/process.c" \
  "$ROOT_DIR/runtime/json.c" \
  "$ROOT_DIR/runtime/cgc-bridge.c" \
  -I "$ROOT_DIR/runtime" -lm -o "$TMP_BIN"

cat >/tmp/rebuild-native-cgc-smoke.fl <<'FL'
(println (+ 1 2))
FL
"$TMP_BIN" /tmp/rebuild-native-cgc-smoke.fl /tmp/rebuild-native-cgc-smoke.c
gcc /tmp/rebuild-native-cgc-smoke.c \
  "$ROOT_DIR/runtime/core.c" \
  "$ROOT_DIR/runtime/collection.c" \
  "$ROOT_DIR/runtime/io.c" \
  "$ROOT_DIR/runtime/math.c" \
  "$ROOT_DIR/runtime/error.c" \
  "$ROOT_DIR/runtime/process.c" \
  "$ROOT_DIR/runtime/json.c" \
  -I "$ROOT_DIR/runtime" -lm -o /tmp/rebuild-native-cgc-smoke

SMOKE_OUT="$(/tmp/rebuild-native-cgc-smoke | tr -d '[:space:]')"
if [ "$SMOKE_OUT" != "3" ]; then
  echo "smoke failed: expected 3, got $SMOKE_OUT" >&2
  exit 1
fi

install -m 775 "$TMP_BIN" "$OUT"
echo "installed $OUT"
stat -c '%y %s %n' "$OUT"
