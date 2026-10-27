#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-task944-backend.sh <empty-work-dir> [try|template|symbol|float]}"
FILTER="${2:-all}"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-44 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"
SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/compiler.c"
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/compiler.c" "$WORK/compiler" >"$WORK/compiler-build.log"
RUNTIME=(core.c collection.c io.c math.c error.c process.c json.c db.c http_server.c auth.c cgc-bridge.c)
passed=0
for name in try template symbol float triple-string symbol-collision duplicate-defn global-function dollar-function env-alias swap-fn closure-call dollar-param dollar-lambda-param type-alias str-count h-varargs destructured-lambda; do
  [[ "$FILTER" == all || "$FILTER" == "$name" ]] || continue
  source="$ROOT/tests/task944/$name.fl"
  cfile="$WORK/$name.c"
  log="$WORK/$name.compile.log"
  set +e
  "$WORK/compiler" "$source" "$cfile" >"$log" 2>&1
  compile_rc=$?
  set -e
  printf 'BACKEND_CASE=%s COMPILE_RC=%s\n' "$name" "$compile_rc"
  cat "$log"
  if (( compile_rc != 0 )) || [[ ! -f "$cfile" ]]; then
    continue
  fi
  runtime_args=()
  for file in "${RUNTIME[@]}"; do runtime_args+=("$ROOT/runtime/$file"); done
  set +e
  gcc -w -I "$ROOT/runtime" -o "$WORK/$name" "$cfile" "${runtime_args[@]}" \
    -lsqlite3 -lcrypto -lm >"$WORK/$name.gcc.log" 2>&1
  gcc_rc=$?
  set -e
  printf 'BACKEND_CASE=%s GCC_RC=%s\n' "$name" "$gcc_rc"
  if (( gcc_rc != 0 )); then
    cat "$WORK/$name.gcc.log"
    continue
  fi
  "$WORK/$name" >"$WORK/$name.out"
  if diff -u "$ROOT/tests/task944/$name.expected" "$WORK/$name.out"; then
    printf 'BACKEND_CASE=%s OUTPUT=PASS\n' "$name"
    passed=$((passed + 1))
  else
    printf 'BACKEND_CASE=%s OUTPUT=FAIL\n' "$name"
  fi
done
printf 'BACKEND_CASES_PASSED=%s\n' "$passed"
