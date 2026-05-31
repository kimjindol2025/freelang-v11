#!/bin/bash
# P2-Stage2: JS vs C Backend Output Parity Test

cd /root/kim/freelang-v11-fx || exit 1

FILES=(
  "examples/loop.fl"
  "examples/fib.fl"
  "examples/factorial.fl"
  "examples/nested-loop.fl"
  "examples/closure.fl"
  "examples/recur.fl"
)

echo "=== P2-Stage2: Semantic Parity Test (JS vs C) ==="
echo ""

pass=0
fail=0

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ SKIP  $f (not found)"
    continue
  fi

  # JS backend output
  js_out=$(node bootstrap.js run "$f" 2>/dev/null)
  js_exit=$?

  # C backend: compile → run
  node bootstrap.js run self/run-cgc.fl "$f" /tmp/fl_parity.c 2>/dev/null
  cgc_exit=$?

  if [ $cgc_exit -ne 0 ]; then
    echo "❌ FAIL  $f (cgc compilation failed)"
    ((fail++))
    continue
  fi

  gcc /tmp/fl_parity.c runtime/core.c runtime/collection.c runtime/io.c \
      runtime/math.c runtime/error.c -I runtime/ -lm -o /tmp/fl_parity 2>/dev/null
  gcc_exit=$?

  if [ $gcc_exit -ne 0 ]; then
    echo "❌ FAIL  $f (gcc compilation failed)"
    ((fail++))
    continue
  fi

  c_out=$(/tmp/fl_parity 2>/dev/null)
  c_exit=$?

  # Compare outputs
  if [ "$js_out" = "$c_out" ]; then
    echo "✅ PASS  $f"
    ((pass++))
  else
    echo "❌ FAIL  $f"
    echo "    JS output: $js_out"
    echo "    C  output: $c_out"
    ((fail++))
  fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
printf "║  %d PASS / %d FAIL — Parity: %s\n" "$pass" "$fail" \
  "$([ $fail -eq 0 ] && echo '✅ VALID' || echo '❌ MISMATCH')" | \
  sed 's/.*/║  &                                                    ║/' | head -1
echo "╚════════════════════════════════════════════════════════════╝"

[ $fail -eq 0 ]
