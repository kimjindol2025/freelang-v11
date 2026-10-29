#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${1:?usage: run-task949-full-check.sh <persistent-record-dir>}"
SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
if [[ -e "$WORK" && -n "$(find "$WORK" -mindepth 1 -print -quit)" ]]; then
  echo 'task 9-49 work directory must be empty' >&2
  exit 2
fi
mkdir -p "$WORK"

sha256sum "$SEED" >"$WORK/seed.sha256"
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/stage2.c" >"$WORK/stage2.compile" 2>&1
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/stage2.c" "$WORK/stage2-bin" >"$WORK/stage2.build" 2>&1
"$WORK/stage2-bin" "$ROOT/self/cgc-main.fl" "$WORK/stage3.c" >"$WORK/stage3.compile" 2>&1
bash "$ROOT/scripts/build-cgc-native.sh" "$WORK/stage3.c" "$WORK/stage3-bin" >"$WORK/stage3.build" 2>&1
"$WORK/stage3-bin" "$ROOT/self/cgc-main.fl" "$WORK/stage4.c" >"$WORK/stage4.compile" 2>&1
sha256sum "$WORK/stage2.c" "$WORK/stage3.c" "$WORK/stage4.c" >"$WORK/stage.sha256"
if cmp -s "$WORK/stage2.c" "$WORK/stage3.c"; then cmp23=0; else cmp23=$?; fi
if cmp -s "$WORK/stage3.c" "$WORK/stage4.c"; then cmp34=0; else cmp34=$?; fi
cat "$WORK/seed.sha256" "$WORK/stage.sha256"
printf 'CMP_2_3=%s\nCMP_3_4=%s\n' "$cmp23" "$cmp34"
if (( cmp23 == 0 && cmp34 == 0 )); then printf 'NATIVE_FIXED_POINT=PASS\n'; else printf 'NATIVE_FIXED_POINT=FAIL\n'; fi

full_rc=0
bash "$ROOT/tests/run-task946-full.sh" "$WORK/stage2-bin" "$WORK/full" >"$WORK/full.log" 2>&1 || full_rc=$?
printf 'FULL_FAST_RC=%s\n' "$full_rc"
grep -E '^(TASK942_LEGACY_RC|TASK942_POOL_RC|LOAD2_SUMMARY|FDFIX_SUMMARY|POOL_SUMMARY|TASK946_FAST_SUMMARY)=' "$WORK/full.log" || true

symbols_rc=0
"$WORK/stage2-bin" "$ROOT/tests/cgc-symbols.fl" "$WORK/symbols.c" >"$WORK/symbols.compile" 2>&1 || symbols_rc=$?
if (( symbols_rc == 0 )); then
  gcc -Wall -Wextra -I "$ROOT/runtime" -o "$WORK/symbols" "$WORK/symbols.c" \
    "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
    "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
    "$ROOT/runtime/json.c" "$ROOT/runtime/cgc-bridge.c" -lm >"$WORK/symbols.build" 2>&1 || symbols_rc=$?
fi
if (( symbols_rc == 0 )); then
  "$WORK/symbols" >"$WORK/symbols.out" 2>&1 || symbols_rc=$?
fi
if (( symbols_rc == 0 )) && grep -Fxq 'SYMBOL_RESULTS=slash-1,slash-2,slash-3,underscore,question,bang' "$WORK/symbols.out"; then
  printf 'PASS slash names and punctuation separation\n'
else
  symbols_rc=1
fi
if (( symbols_rc == 0 )) && ! "$WORK/stage2-bin" "$ROOT/tests/cgc-symbol-collision.fl" "$WORK/collision.c" >"$WORK/collision.log" 2>&1 && grep -q '\[CGC-ERR\] C symbol collision:' "$WORK/collision.log"; then
  printf 'PASS C symbol collision rejected\n'
else
  symbols_rc=1
fi
if (( symbols_rc == 0 )) && ! "$WORK/stage2-bin" "$ROOT/tests/cgc-invalid-c.fl" "$WORK/invalid.c" >"$WORK/invalid.log" 2>&1 && grep -q 'generated C failed gcc -fsyntax-only' "$WORK/invalid.log" && grep -q 'error:' "$WORK/invalid.log"; then
  printf 'PASS invalid generated C rejected\n'
else
  symbols_rc=1
fi
if (( symbols_rc == 0 )); then
  "$WORK/stage2-bin" "$ROOT/tests/cgc-native-forms.fl" "$WORK/native-forms.c" >"$WORK/native-forms.compile" 2>&1 || symbols_rc=$?
fi
if (( symbols_rc == 0 )); then
  gcc -Wall -Wextra -I "$ROOT/runtime" -o "$WORK/native-forms" "$WORK/native-forms.c" \
    "$ROOT/runtime/core.c" "$ROOT/runtime/collection.c" "$ROOT/runtime/io.c" \
    "$ROOT/runtime/math.c" "$ROOT/runtime/error.c" "$ROOT/runtime/process.c" \
    "$ROOT/runtime/json.c" "$ROOT/runtime/cgc-bridge.c" -lm >"$WORK/native-forms.build" 2>&1 || symbols_rc=$?
fi
if (( symbols_rc == 0 )); then
  "$WORK/native-forms" >"$WORK/native-forms.out" 2>&1 || symbols_rc=$?
fi
if (( symbols_rc == 0 )) && grep -Fxq 'NATIVE_FORMS=PASS' "$WORK/native-forms.out"; then
  printf 'NATIVE_FORMS_SUMMARY=18/18\nCGC_SYMBOL_SUMMARY=5/5\n'
else
  symbols_rc=1
  printf 'CGC_SYMBOL_SUMMARY=FAIL\n'
fi
printf 'CGC_SYMBOL_RC=%s\n' "$symbols_rc"

abi_rc=0
bash "$ROOT/tests/run-cgc-builtin-abi.sh" "$WORK/stage2-bin" "$WORK/task920" >"$WORK/task920.log" 2>&1 || abi_rc=$?
grep -E '^ABI_SUMMARY=' "$WORK/task920.log" || true
printf 'TASK920_RC=%s\n' "$abi_rc"
(( full_rc == 0 && symbols_rc == 0 && abi_rc == 0 && cmp23 == 0 && cmp34 == 0 ))
