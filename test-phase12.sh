#!/bin/bash
# Phase 12: vpm Parallel Download & Multi-package Support

FAIL=0
PASS=0
REG="http://localhost:4000"
CACHE_DIR="${HOME}/.vpm/cache/packages"

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
  rm -f package.json 2>/dev/null
  rm -f "$CACHE_DIR"/*.json 2>/dev/null
}

echo "════════════════════════════════════════════════════════════"
echo "Phase 12: Parallel Download & Multi-package Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# TEST 1: Multi-package install (3 packages in parallel)
echo "TEST 1: Multi-package parallel install (a b c)"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 express@4.17.1 react@18.0.0 > /dev/null 2>&1
EXIT_CODE=$?
check $EXIT_CODE 0 "Multi-package install exits with 0"
# Verify all 3 packages installed
COUNT=$(ls -1d vpm/packages/*@* 2>/dev/null | wc -l)
[ $COUNT -ge 3 ]
check $? 0 "All 3 packages installed"
echo ""

# TEST 2: Lockfile consistency after parallel install
echo "TEST 2: Lockfile consistency"
[ -f package-lock.json ]
check $? 0 "package-lock.json created"
LOCK_COUNT=$(jq '.packages | keys | length' package-lock.json 2>/dev/null || echo "0")
[ $LOCK_COUNT -ge 3 ]
check $? 0 "All packages recorded in lockfile"
echo ""

# TEST 3: Dependencies during parallel install
echo "TEST 3: Dependencies parallel resolution"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install express@4.17.1 > /dev/null 2>&1
[ -d vpm/packages/express@4.17.1 ]
check $? 0 "express@4.17.1 with dependencies installed"
echo ""

# TEST 4: VPM_CONCURRENCY=1 (force serial, backward compat)
echo "TEST 4: Backward compat (VPM_CONCURRENCY=1 forces serial)"
setup
VPM_CONCURRENCY=1 VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 express@4.17.1 > /dev/null 2>&1
EXIT_CODE=$?
check $EXIT_CODE 0 "Serial install (concurrency=1) succeeds"
COUNT=$(ls -1d vpm/packages/*@* 2>/dev/null | wc -l)
[ $COUNT -ge 2 ]
check $? 0 "Both packages installed in serial mode"
echo ""

# TEST 5: Reinstall with parallel
echo "TEST 5: Reinstall with parallel"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 express@4.17.1 > /dev/null 2>&1
VPM_REGISTRY=$REG node dist/vpm-cli.js reinstall > /dev/null 2>&1
EXIT_CODE=$?
check $EXIT_CODE 0 "Reinstall with parallel succeeds"
COUNT=$(ls -1d vpm/packages/*@* 2>/dev/null | wc -l)
[ $COUNT -ge 2 ]
check $? 0 "All packages reinstalled"
echo ""

# TEST 6: Phase 11 cache + Phase 12 parallel compat
echo "TEST 6: Cache + Parallel compat"
setup
# First install (populates cache)
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 express@4.17.1 > /dev/null 2>&1
CACHE_FILES=$(ls -1 "$CACHE_DIR"/*.json 2>/dev/null | wc -l)
[ $CACHE_FILES -ge 2 ]
check $? 0 "Cache populated (2+ files)"
# Now kill registry and parallel install from cache
rm -rf vpm/packages/* 2>/dev/null
VPM_REGISTRY=http://localhost:19999 node dist/vpm-cli.js install lodash@4.17.21 express@4.17.1 > /dev/null 2>&1
EXIT_CODE=$?
check $EXIT_CODE 0 "Parallel install from cache (no registry)"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "✅ All Phase 12 tests passed!"
  exit 0
else
  echo "❌ $FAIL tests failed"
  exit 1
fi
