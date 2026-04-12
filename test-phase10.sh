#!/bin/bash
# Phase 10: Conflict Resolution, Semver Composite Ranges, Signature Verification

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
echo "Phase 10: Conflict Resolution & Composite Semver Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# TEST 1: Cross-dependency resolution - web-app installs dependencies
echo "TEST 1: Cross-dependency installation"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install web-app@2.0.0 > /dev/null 2>&1
# web-app@2.0.0 → express@4.17.1 + app-utils@1.0.0 → lodash@4.17.21
COUNT=$(ls -1 vpm/packages/ 2>/dev/null | wc -l)
# Should have: web-app, express, app-utils, lodash = 4 packages
[ $COUNT -eq 4 ]
check $? 0 "Cross-dependency tree installs all transitive dependencies"
echo ""

# TEST 2: Semver range deduplication
echo "TEST 2: Semver range deduplication"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install web-app@2.0.0 > /dev/null 2>&1
# web-app@2.0.0 installs lodash@4.17.21
# Now install lodash with range spec that's satisfied by 4.17.21
VPM_REGISTRY=$REG node dist/vpm-cli.js install "lodash@^4.0.0" 2>&1 | grep -qE "deduped|skipping|satisfies"
check $? 0 "Range spec satisfied by existing version (deduped)"
echo ""

# TEST 3: Semver AND range (>=1.0.0 <2.0.0)
echo "TEST 3: Semver AND range"
setup
VPM_REGISTRY=http://localhost:4002 node dist/vpm-cli.js install "semver-lib@>=1.0.0 <2.0.0" > /dev/null 2>&1
SELECTED=$(cat package-lock.json 2>/dev/null | jq -r '.packages | keys[] | select(startswith("semver-lib"))' | head -1)
echo "$SELECTED" | grep -q "1\.[0-2]\.[0-9]"
check $? 0 "AND range selects 1.x version (not 2.x)"
echo ""

# TEST 4: Semver OR range (^1.0.0 || ^2.0.0)
echo "TEST 4: Semver OR range"
setup
VPM_REGISTRY=http://localhost:4002 node dist/vpm-cli.js install "semver-lib@^1.0.0 || ^2.0.0" > /dev/null 2>&1
SELECTED=$(cat package-lock.json 2>/dev/null | jq -r '.packages | keys[] | select(startswith("semver-lib"))' | head -1)
echo "$SELECTED" | grep -q "2\.[0-9]\.[0-9]"
check $? 0 "OR range selects highest (2.x)"
echo ""

# TEST 5: Wildcard range (1.x)
echo "TEST 5: Wildcard range"
setup
VPM_REGISTRY=http://localhost:4002 node dist/vpm-cli.js install "semver-lib@1.x" > /dev/null 2>&1
SELECTED=$(cat package-lock.json 2>/dev/null | jq -r '.packages | keys[] | select(startswith("semver-lib"))' | head -1)
echo "$SELECTED" | grep -q "1\.[0-9]\.[0-9]"
check $? 0 "Wildcard 1.x selects highest 1.x version"
echo ""

# TEST 6: Signature verification with correct key
echo "TEST 6: Signature verification with correct key"
setup
VPM_SIGNING_KEY=phase10-test-key VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
OUTPUT=$(VPM_SIGNING_KEY=phase10-test-key VPM_REGISTRY=$REG node dist/vpm-cli.js verify 2>&1)
echo "$OUTPUT" | grep -q "OK"
check $? 0 "Signature verify with correct key passes"
echo ""

# TEST 7: Signature verification with wrong key
echo "TEST 7: Signature verification with wrong key"
# Test 7a: Check for SIGNATURE MISMATCH message
OUTPUT=$(VPM_SIGNING_KEY=wrong-key VPM_REGISTRY=$REG node dist/vpm-cli.js verify 2>&1)
echo "$OUTPUT" | grep -q "SIGNATURE MISMATCH"
check $? 0 "Signature verify with wrong key detects mismatch"

# Test 7b: Check exit code
VPM_SIGNING_KEY=wrong-key VPM_REGISTRY=$REG node dist/vpm-cli.js verify > /dev/null 2>&1
check $? 1 "Signature mismatch → exit code 1"
echo ""

# TEST 8: Reinstall preserves signatures
echo "TEST 8: Reinstall preserves signatures"
setup
VPM_SIGNING_KEY=phase10-test-key VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
SIG1=$(cat package-lock.json | jq -r '.packages["lodash@4.17.21"].signature // ""')
VPM_SIGNING_KEY=phase10-test-key VPM_REGISTRY=$REG node dist/vpm-cli.js reinstall > /dev/null 2>&1
SIG2=$(cat package-lock.json | jq -r '.packages["lodash@4.17.21"].signature // ""')
if [ "$SIG1" = "$SIG2" ] && [ -n "$SIG1" ]; then
  check 0 0 "Reinstall produces same signature"
else
  check 1 0 "Reinstall produces same signature"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "✅ All Phase 10 tests passed!"
  exit 0
else
  echo "❌ $FAIL tests failed"
  exit 1
fi
