#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-task945-runtime.sh <compiler> <empty-work-dir>}"
WORK="${2:?usage: run-task945-runtime.sh <compiler> <empty-work-dir>}"
[[ ! -e "$WORK" || -z "$(find "$WORK" -mindepth 1 -print -quit)" ]] || {
  echo 'task 9-45 work directory must be empty' >&2
  exit 2
}
mkdir -p "$WORK"
RUNTIME=(core.c collection.c io.c math.c error.c process.c json.c db.c http_server.c auth.c cgc-bridge.c)
passed=0
for name in assoc conj dissoc json_str js_keys min mod quot swap-assoc swap-conj reduce-min doseq doseq-callback; do
  "$COMPILER" "$ROOT/tests/task945/$name.fl" "$WORK/$name.c" >"$WORK/$name.compile" 2>&1
  runtime_args=()
  for file in "${RUNTIME[@]}"; do runtime_args+=("$ROOT/runtime/$file"); done
  gcc -w -I "$ROOT/runtime" -o "$WORK/$name" "$WORK/$name.c" "${runtime_args[@]}" \
    -lsqlite3 -lcrypto -lm >"$WORK/$name.gcc" 2>&1
  "$WORK/$name" >"$WORK/$name.out"
  diff -u "$ROOT/tests/task945/$name.expected" "$WORK/$name.out"
  printf 'TASK945_CASE=%s PASS\n' "$name"
  passed=$((passed + 1))
done
printf 'TASK945_RUNTIME_SUMMARY=%s/13\n' "$passed"
(( passed == 13 ))
