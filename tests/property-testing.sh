#!/bin/bash
# Property Testing — 10개 실무 패턴 검증
# Phase C 마무리: examples/patterns 전수 검증

BOOTSTRAP="/root/kim/freelang-v11/bootstrap.js"
PATTERNS="/root/kim/freelang-v11/examples/patterns"
RESULTS="/tmp/property-testing-results.txt"

echo "=== FreeLang Property Testing (10 patterns) ===" > "$RESULTS"
echo "Date: $(date)" >> "$RESULTS"
echo "" >> "$RESULTS"

PASS=0
FAIL=0

for PATTERN in "$PATTERNS"/*.fl; do
  if [[ ! -f "$PATTERN" ]]; then
    continue
  fi

  PNAME=$(basename "$PATTERN" .fl)
  echo -n "Testing $PNAME ... "

  # 실행 및 에러 캡처
  OUTPUT=$(node "$BOOTSTRAP" run "$PATTERN" 2>&1)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ PASS"
    echo "✅ $PNAME: PASS" >> "$RESULTS"
    ((PASS++))
  else
    echo "❌ FAIL"
    echo "❌ $PNAME: FAIL" >> "$RESULTS"
    echo "   Error: $(echo "$OUTPUT" | head -3)" >> "$RESULTS"
    ((FAIL++))
  fi
done

echo "" >> "$RESULTS"
echo "=== Summary ===" >> "$RESULTS"
echo "Total: $((PASS + FAIL))" >> "$RESULTS"
echo "Pass:  $PASS" >> "$RESULTS"
echo "Fail:  $FAIL" >> "$RESULTS"
echo "Rate:  $(( PASS * 100 / (PASS + FAIL) ))%" >> "$RESULTS"

cat "$RESULTS"
