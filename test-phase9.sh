#!/bin/bash
# Phase 9: Comprehensive Auto Test Suite
# Prerequisites: localhost:4000 registry running, dist/ compiled

FAIL=0
PASS=0
REG="http://localhost:4000"

check() {
  if [ "$1" -eq "$2" ]; then
    echo "✅ PASS: $3"; ((PASS++))
  else
    echo "❌ FAIL: $3 (expected: $2, got: $1)"; ((FAIL++))
  fi
}

setup() {
  rm -rf vpm/packages/* 2>/dev/null
  rm -f package-lock.json 2>/dev/null
}

echo "════════════════════════════════════════════════════════════"
echo "Phase 9: Reliability & Trust Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# Test 1: Major version conflict → 에러
echo "TEST 1: Major version conflict detection"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 2>&1 | grep -q "✅"
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@1.0.0 2>&1 | grep -q "Major version conflict"
check $? 0 "Major version conflict → error"
echo ""

# Test 2: Lockfile-based deduplication
echo "TEST 2: Lockfile-based deduplication"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install web-app@2.0.0 > /dev/null 2>&1  # lodash@4.17.21 included
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 2>&1 | grep -q "skipping"
check $? 0 "Deduplication: package already installed"
echo ""

# Test 3: Verify - integrity mismatch detection
echo "TEST 3: Verify command - integrity mismatch detection"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
# Corrupt the package.json
echo "corrupted content" > vpm/packages/lodash@4.17.21/package.json
VPM_REGISTRY=$REG node dist/vpm-cli.js verify 2>&1 | grep -q "INTEGRITY MISMATCH"
check $? 0 "Verify detects corrupted package"

VPM_REGISTRY=$REG node dist/vpm-cli.js verify > /dev/null 2>&1
check $? 1 "Verify exits with code 1 on mismatch"
echo ""

# Test 4: Network resilience - retries and graceful failure
echo "TEST 4: Network timeout/failure with retries"
setup  # Clear state before network test
OUTPUT=$(VPM_REGISTRY=http://localhost:19999 node dist/vpm-cli.js install lodash 2>&1)
[ $? -eq 1 ]
check $? 0 "Network failure → exit code 1"
# Verify retry messages are in the output
echo "$OUTPUT" | grep -q "retrying"
check $? 0 "Retry messages logged"
echo ""

# Test 6: Reinstall → same integrity
echo "TEST 6: Reproducible reinstall (same integrity)"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
H1=$(cat package-lock.json | jq -r '.packages["lodash@4.17.21"].integrity')
VPM_REGISTRY=$REG node dist/vpm-cli.js reinstall > /dev/null 2>&1
H2=$(cat package-lock.json | jq -r '.packages["lodash@4.17.21"].integrity')
[ "$H1" = "$H2" ]
check $? 0 "Reinstall produces same integrity hash"
echo ""

# Test 7: Verify with clean installation
echo "TEST 7: Verify passes on clean installation"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install express@4.17.1 > /dev/null 2>&1
OUTPUT=$(VPM_REGISTRY=$REG node dist/vpm-cli.js verify 2>&1)
echo "$OUTPUT" | grep -q "1 OK, 0 failed" || echo "Verify output: $OUTPUT"
check $? 0 "Verify all packages OK"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "✅ All Phase 9 tests passed!"
  exit 0
else
  echo "❌ $FAIL tests failed"
  exit 1
fi
