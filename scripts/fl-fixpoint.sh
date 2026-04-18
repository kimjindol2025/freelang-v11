#!/bin/bash
# FL fixed-point 검증: bootstrap direct vs self/codegen 컴파일 결과
# 각 .fl 파일에 대해 두 실행 결과를 diff.

set -u
PASS=0
FAIL=0
FILES=("$@")

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "skip $f (not found)"; continue; fi
  out_js="${f%.fl}.fp.js"
  node bootstrap.js run self/codegen.fl "$f" "$out_js" > /dev/null 2>&1
  a=$(node bootstrap.js run "$f" 2>&1)
  b=$(node "$out_js" 2>&1)
  if [ "$a" = "$b" ]; then
    PASS=$((PASS+1))
    echo "pass  $f"
  else
    FAIL=$((FAIL+1))
    echo "fail  $f"
    diff <(echo "$a") <(echo "$b") | head -6 | sed 's/^/      /'
  fi
done

echo "---"
echo "pass=$PASS fail=$FAIL"
[ $FAIL -eq 0 ]
