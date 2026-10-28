#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
FRONTEND_SOURCE="${1:?usage: recount-task955-app-gcc.sh <freelang-front-repo> <empty-record-dir>}"
RECORD_DIR="${2:?usage: recount-task955-app-gcc.sh <freelang-front-repo> <empty-record-dir>}"
REVISIONS=(f0c7ed67ae29e18e74517cc26dd59627e2a72335 5009f43e87625c376e03088437ed250f65f8b608)

if [[ -e "$RECORD_DIR" && -n "$(find "$RECORD_DIR" -mindepth 1 -print -quit)" ]]; then
  echo 'record directory must be empty' >&2
  exit 2
fi
mkdir -p "$RECORD_DIR"

git clone --quiet --shared --no-checkout "$FRONTEND_SOURCE" "$RECORD_DIR/frontend"
git -C "$RECORD_DIR/frontend" checkout --quiet --detach 9c1202dae761f1faff777c48887ed19f5960b3c9
bash "$ROOT/scripts/rebuild-task951-app-source.sh" \
  "$RECORD_DIR/frontend" "$RECORD_DIR/source" >"$RECORD_DIR/source-rebuild.log" 2>&1

for revision in "${REVISIONS[@]}"; do
  tree="$RECORD_DIR/${revision:0:8}"
  mkdir -p "$tree"
  git -C "$ROOT" archive "$revision" | tar -x -C "$tree"
  cp "$RECORD_DIR/source/_app.fl" "$tree/_app.fl"
  seed="$ROOT/bin/cgc-bin-x86_64-seed-v11"
  "$seed" "$tree/self/cgc-main.fl" "$tree/stage2.c" >"$tree/stage2.compile" 2>&1
  bash "$tree/scripts/build-cgc-native.sh" "$tree/stage2.c" "$tree/stage2-bin" >"$tree/stage2.build" 2>&1
  set +e
  "$tree/stage2-bin" "$tree/_app.fl" "$tree/app.c" >"$tree/app.compile" 2>&1
  compile_rc=$?
  gcc -fsyntax-only -I "$tree/runtime" "$tree/app.c" >"$tree/app-gcc.log" 2>&1
  gcc_rc=$?
  set -e
  app_sha256="$(sha256sum "$tree/_app.fl" | awk '{print $1}')"
  error_lines="$(awk '/error:/ {n++} END {print n+0}' "$tree/app-gcc.log")"
  printf 'REVISION=%s\nAPP_SHA256=%s\nAPP_COMPILE_RC=%s\nAPP_GCC_RC=%s\nAPP_GCC_ERROR_LINES=%s\n' \
    "$revision" "$app_sha256" "$compile_rc" "$gcc_rc" "$error_lines"
done
