#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== FreeLang L3 Self-Hosting Verification ==="
echo ""

# Stage 1: bootstrap.js compiles all.fl → stage1.js
echo "[1/4] bootstrap.js → stage1.js ..."
node bootstrap.js compile self/all.fl -o /tmp/verify_stage1.js --runtime 2>&1 | grep -E "✓|Error" || true

# Stage 2: stage1.js compiles all.fl → stage2.js
echo "[2/4] stage1.js → stage2.js ..."
node /tmp/verify_stage1.js self/all.fl /tmp/verify_stage2.js 2>&1

# Stage 3: stage2.js compiles test FL code
echo "[3/4] stage2.js compiles test code ..."
cat > /tmp/verify_l3_test.fl << 'FLEOF'
(defn factorial [n]
  (if (<= n 1) 1 (* n (factorial (- n 1)))))
(println (factorial 10))
(println (str "L3" "-OK"))
FLEOF

node /tmp/verify_stage2.js /tmp/verify_l3_test.fl /tmp/verify_l3_out.js 2>&1

# Stage 4: run and verify output
echo "[4/4] Running compiled output ..."
RESULT=$(node /tmp/verify_l3_out.js)
echo "$RESULT"

if echo "$RESULT" | grep -q "3628800" && echo "$RESULT" | grep -q "L3-OK"; then
  echo ""
  echo "✅ L3 Self-Hosting VERIFIED"
  echo "   stage1.js → stage2.js → compiles+runs FL correctly"
else
  echo ""
  echo "❌ L3 Self-Hosting FAILED"
  exit 1
fi
