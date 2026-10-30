#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
CURRENT_COMPILER="${1:?usage: run-task959-concurrency-evidence.sh <current-compiler> <empty-record-dir>}"
RECORD_DIR="${2:?usage: run-task959-concurrency-evidence.sh <current-compiler> <empty-record-dir>}"
TOOLS="${FL_TOOLS_ROOT:-$(cd -- "$ROOT/../freelang-tools" && pwd -P)}"
RUNTIME="$ROOT/runtime"
if [[ -e "$RECORD_DIR" && -n "$(find "$RECORD_DIR" -mindepth 1 -print -quit)" ]]; then
  echo 'task959 record directory must be empty' >&2
  exit 2
fi
mkdir -p "$RECORD_DIR"

sources=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
link_sources=()
for name in "${sources[@]}"; do link_sources+=("$RUNTIME/$name"); done

build_variant() {
  local label="$1" compiler="$2" http_runtime="$3" dir="$RECORD_DIR/$1"
  local -a variant_sources=()
  mkdir -p "$dir"
  for name in "${sources[@]}"; do
    if [[ "$name" == http_server.c ]]; then variant_sources+=("$http_runtime");
    else variant_sources+=("$RUNTIME/$name"); fi
  done
  "$compiler" "$ROOT/examples/erp-vendors/app.fl" "$dir/app.c" >"$dir/app.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$dir/app" "$dir/app.c" "${variant_sources[@]}" -lsqlite3 -lcrypto -lm >"$dir/app.build" 2>&1
  "$compiler" "$ROOT/examples/erp-vendors/create-user.fl" "$dir/create-user.c" >"$dir/create-user.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$dir/create-user" "$dir/create-user.c" \
    "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
    "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" \
    "$RUNTIME/db.c" "$RUNTIME/auth.c" -lsqlite3 -lcrypto -lm >"$dir/create-user.build" 2>&1
  "$compiler" "$ROOT/examples/erp-vendors/test-concurrency.fl" "$dir/concurrency.c" >"$dir/concurrency.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$dir/concurrency" "$dir/concurrency.c" "${variant_sources[@]}" -lsqlite3 -lcrypto -lm >"$dir/concurrency.build" 2>&1
}

run_case() {
  local label="$1" repetition="$2" rc
  local dir="$RECORD_DIR/$label/run-$repetition" log="$RECORD_DIR/$label-run-$repetition.log"
  mkdir -p "$dir"
  set +e
  FL_TOOLS_DISPATCH_ROOT="$TOOLS" FREELANG_V11_RUNTIME="$RUNTIME" FL_TEST_CONTINUE=1 \
    FREELANG_TESTER_REGISTRY="$RECORD_DIR/tester-registry-native" \
    timeout --signal=TERM --kill-after=10s 300s \
      "$RECORD_DIR/$label/concurrency" "$dir" "$RECORD_DIR/$label/app" "$RECORD_DIR/$label/create-user" >"$log" 2>&1
  rc=$?
  set -e
  printf 'CONC_RUN=%s/%s RC=%s\n' "$label" "$repetition" "$rc"
  rg '^(FAIL |BULK_RESPONSES=|SQLITE_ITEM_COUNT_BEFORE=|POST_FAILURE_DETAILS_BEGIN|POST_FAILURE index=|POST_FAILURE_DETAILS_END|APP_STDERR_BEGIN|APP_STDERR_END|CONC_SUMMARY=)' "$log" || true
  if [[ -s "$dir/server.err" ]]; then
    printf 'APP_ERROR_RAW_BEGIN run=%s/%s\n' "$label" "$repetition"
    cat "$dir/server.err"
    printf 'APP_ERROR_RAW_END run=%s/%s\n' "$label" "$repetition"
  fi
}

"$TOOLS/scripts/cgc-native" "$TOOLS/native/tester-registry.fl" "$RECORD_DIR/tester-registry.c" >"$RECORD_DIR/tester-registry.compile" 2>&1
gcc -Wno-unused -I "$RUNTIME" -o "$RECORD_DIR/tester-registry-native" "$RECORD_DIR/tester-registry.c" \
  "$RUNTIME/core.c" "$RUNTIME/collection.c" "$RUNTIME/io.c" "$RUNTIME/math.c" \
  "$RUNTIME/error.c" "$RUNTIME/process.c" "$RUNTIME/json.c" "$RUNTIME/cgc-bridge.c" -lm \
  >"$RECORD_DIR/tester-registry.build" 2>&1

mkdir -p "$RECORD_DIR/baseline"
git -C "$ROOT" show 5b620b4e:runtime/http_server.c >"$RECORD_DIR/baseline/http_server.c"
build_variant current "$CURRENT_COMPILER" "$RUNTIME/http_server.c"
build_variant baseline "$CURRENT_COMPILER" "$RECORD_DIR/baseline/http_server.c"
for repetition in 1 2 3; do run_case current "$repetition"; done
run_case baseline 1
