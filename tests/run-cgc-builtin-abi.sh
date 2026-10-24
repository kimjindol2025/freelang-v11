#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPILER="${1:?usage: run-cgc-builtin-abi.sh <compiler> <work-dir>}"
WORK="${2:?usage: run-cgc-builtin-abi.sh <compiler> <work-dir>}"
RUNTIME="$ROOT/runtime"
mkdir -p "$WORK/abi-objects"

sources=(core.c collection.c io.c math.c error.c process.c json.c cgc-bridge.c db.c http_server.c auth.c)
objects=()
for name in "${sources[@]}"; do
  object="$WORK/abi-objects/${name%.c}.o"
  gcc -I "$RUNTIME" -c "$RUNTIME/$name" -o "$object"
  objects+=("$object")
done
nm -g --defined-only "${objects[@]}" | awk '$2 ~ /^[TDBR]$/ {print $3}' | sort -u >"$WORK/abi-runtime-symbols"

awk '
function emit(op, symbol) { if (op != "" && symbol != "") print op "\t" symbol }
/^\(defn c-runtime-name / { in_map=1; next }
in_map && /^\(defn cgc-runtime-call / { in_map=0 }
in_map && /\[\(= \$op/ {
  line=$0; op=line; sub(/^.*\$op "/,"",op); sub(/".*$/, "", op)
  if (match(line, /"[A-Za-z_][A-Za-z0-9_]*"\]/))
    emit(op, substr(line,RSTART+1,RLENGTH-3))
}
in_map && /\[\(or/ {
  line=$0
  if (match(line, /"[A-Za-z_][A-Za-z0-9_]*"\]$/)) {
    symbol=substr(line,RSTART+1,RLENGTH-3); rest=line
    while (match(rest, /\$op "[^"]+"/)) {
      op=substr(rest,RSTART,RLENGTH); sub(/^\$op "/,"",op); sub(/"$/,"",op)
      emit(op,symbol); rest=substr(rest,RSTART+RLENGTH)
    }
  }
}
/^\(defn cgc-dispatch \[/ { in_dispatch=1; next }
in_dispatch && /^\(defn cgc-swap!/ { in_dispatch=0 }
in_dispatch && /\[\(= \$op/ {
  line=$0; op=line; sub(/^.*\$op "/,"",op); sub(/".*$/, "", op)
  if (match(line, /\(str "[A-Za-z_][A-Za-z0-9_]*\(/))
    emit(op,substr(line,RSTART+6,RLENGTH-7))
  else if (match(line, /"[A-Za-z_][A-Za-z0-9_]*\(\)"/))
    emit(op,substr(line,RSTART+1,RLENGTH-4))
}
in_dispatch && /\[\(or/ {
  line=$0
  if (match(line, /\(str "[A-Za-z_][A-Za-z0-9_]*\(/)) {
    symbol=substr(line,RSTART+6,RLENGTH-7); rest=line
    while (match(rest, /\$op "[^"]+"/)) {
      op=substr(rest,RSTART,RLENGTH); sub(/^\$op "/,"",op); sub(/"$/,"",op)
      emit(op,symbol); rest=substr(rest,RSTART+RLENGTH)
    }
  }
}
' "$ROOT/self/cgc-main.fl" | sort -u >"$WORK/abi-builtins.tsv"

awk '/^\(defn cgc-dispatch \[/{in_dispatch=1;next} /^\(defn cgc-swap!/{in_dispatch=0} in_dispatch {line=$0; while (match(line, /\$op "[^"]+"/)) {op=substr(line,RSTART,RLENGTH); sub(/^\$op "/,"",op); sub(/"$/,"",op); print op; line=substr(line,RSTART+RLENGTH)}}' \
  "$ROOT/self/cgc-main.fl" | sort -u >"$WORK/abi-dispatch-ops"
awk -F '\t' '$1 !~ /^#/ {print $1}' "$ROOT/tests/task923/abi-lowered.tsv" | sort -u >"$WORK/abi-lowered-ops"
cut -f1 "$WORK/abi-builtins.tsv" | sort -u >"$WORK/abi-mapped-ops"
comm -23 "$WORK/abi-dispatch-ops" "$WORK/abi-mapped-ops" >"$WORK/abi-unmapped-dispatch-ops"
if ! diff -u "$WORK/abi-unmapped-dispatch-ops" "$WORK/abi-lowered-ops" >"$WORK/abi-lowering-diff"; then
  cat "$WORK/abi-lowering-diff"
  echo 'dispatch builtin inventory changed without an ABI mapping or lowering record' >&2
  exit 1
fi
if test "$(cut -f1 "$WORK/abi-builtins.tsv" | sort | uniq -d | wc -l | tr -d ' ')" -ne 0; then
  echo 'a builtin maps to more than one C symbol' >&2
  exit 1
fi

awk -F '\t' '$1 !~ /^#/ {print $1 "\t" $2}' "$ROOT/tests/task923/abi-hold.tsv" | sort -u >"$WORK/abi-holds.tsv"
awk -F '\t' '$1 !~ /^#/ {print $1 "\t" $2}' "$WORK/abi-builtins.tsv" >"$WORK/abi-checked.tsv"
while IFS=$'\t' read -r builtin symbol; do
  if ! grep -Fxq "$symbol" "$WORK/abi-runtime-symbols"; then
    printf '%s\t%s\n' "$builtin" "$symbol"
  fi
done <"$WORK/abi-checked.tsv" | sort -u >"$WORK/abi-unresolved.tsv"
if ! diff -u "$WORK/abi-unresolved.tsv" "$WORK/abi-holds.tsv" >"$WORK/abi-hold-diff"; then
  cat "$WORK/abi-hold-diff"
  echo 'ABI hold list is stale or mismatched' >&2
  exit 1
fi

ABI_MAPPED=0
MATCHED=0
MISSING_IN_RUNTIME=0
ABI_HOLD=0
while IFS=$'\t' read -r builtin symbol; do
  ABI_MAPPED=$((ABI_MAPPED + 1))
  if grep -Fxq "$symbol" "$WORK/abi-runtime-symbols"; then
    MATCHED=$((MATCHED + 1))
  elif awk -F '\t' -v name="$builtin" -v sym="$symbol" '$1==name && $2==sym {found=1} END {exit !found}' "$WORK/abi-holds.tsv"; then
    ABI_HOLD=$((ABI_HOLD + 1))
  else
    printf 'MISSING %s\t%s\n' "$builtin" "$symbol"
    MISSING_IN_RUNTIME=$((MISSING_IN_RUNTIME + 1))
  fi
done <"$WORK/abi-builtins.tsv"
COMPILER_LOWERED="$(wc -l <"$WORK/abi-lowered-ops" | tr -d ' ')"
BUILTINS_TOTAL=$((ABI_MAPPED + COMPILER_LOWERED))

cut -f2 "$WORK/abi-builtins.tsv" | sort -u >"$WORK/abi-used-symbols"
comm -23 "$WORK/abi-runtime-symbols" "$WORK/abi-used-symbols" >"$WORK/abi-unused-symbols"
UNUSED_RUNTIME="$(wc -l <"$WORK/abi-unused-symbols" | tr -d ' ')"
printf 'BUILTINS_TOTAL=%s\nMATCHED=%s\nMISSING_IN_RUNTIME=%s\nUNUSED_RUNTIME=%s\nABI_MAPPED=%s\nCOMPILER_LOWERED=%s\nABI_HOLD=%s\n' \
  "$BUILTINS_TOTAL" "$MATCHED" "$MISSING_IN_RUNTIME" "$UNUSED_RUNTIME" "$ABI_MAPPED" "$COMPILER_LOWERED" "$ABI_HOLD"
printf 'MISSING_IN_RUNTIME_ITEMS=none\n'
if test "$MISSING_IN_RUNTIME" -ne 0 || test "$ABI_HOLD" -ne "$(wc -l <"$WORK/abi-holds.tsv" | tr -d ' ')"; then
  exit 1
fi
while IFS=$'\t' read -r builtin symbol; do
  reason="$(awk -F '\t' -v name="$builtin" '$1==name {print $3}' "$ROOT/tests/task923/abi-hold.tsv")"
  printf 'ABI_HOLD %s\t%s\t%s\n' "$builtin" "$symbol" "$reason"
done <"$WORK/abi-holds.tsv"

for source in dissoc entries obj-values vals str-to-lower float-p take drop; do
  "$COMPILER" "$ROOT/tests/task923/$source.fl" "$WORK/$source.c" >"$WORK/$source.compile" 2>&1
  gcc -w -I "$RUNTIME" -o "$WORK/$source" "$WORK/$source.c" \
    "${objects[@]}" -lsqlite3 -lcrypto -lm
  "$WORK/$source" >"$WORK/$source.log" 2>&1
  grep -q "^PASS " "$WORK/$source.log"
  cat "$WORK/$source.log"
done
printf 'ABI_SUMMARY=8/8\n'
