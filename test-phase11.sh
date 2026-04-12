#!/bin/bash
# Phase 11: Disk Cache & Install Performance

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
  rm -f "$CACHE_DIR"/*.json 2>/dev/null
}

echo "════════════════════════════════════════════════════════════"
echo "Phase 11: Disk Cache & Install Performance Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# TEST 1: Install and verify cache created
echo "TEST 1: Cache creation after install"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
COUNT=$(ls -1 "$CACHE_DIR"/*.json 2>/dev/null | wc -l)
[ $COUNT -ge 1 ]
check $? 0 "Cache file created after install"
echo ""

# TEST 2: Cache hit - reinstall without registry
echo "TEST 2: Cache-based install (registry unavailable)"
setup
# First install with valid registry (populates cache)
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
# Now try with dead registry - should succeed from cache
VPM_REGISTRY=http://localhost:19999 node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
check $? 0 "Cache hit enables install without registry"
echo ""

# TEST 3: Cache list
echo "TEST 3: Cache list command"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
OUTPUT=$(node dist/vpm-cli.js cache list 2>&1)
echo "$OUTPUT" | grep -q "lodash@4.17.21"
check $? 0 "cache list shows cached packages"
echo ""

# TEST 4: Cache verify - clean cache
echo "TEST 4: Cache verify on clean cache"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
OUTPUT=$(node dist/vpm-cli.js cache verify 2>&1)
echo "$OUTPUT" | grep -q "0 failed"
check $? 0 "cache verify passes on clean cache"
echo ""

# TEST 5: Cache verify - detect integrity mismatch
echo "TEST 5: Cache verify detects integrity mismatch"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
# Corrupt the cache file
echo '{"pkgInfo":{"name":"lodash","tampered":true},"integrity":"fakehash","cachedAt":"2026-04-12T00:00:00Z","registry":"http://localhost:4000"}' > "$CACHE_DIR/lodash@4.17.21.json"
OUTPUT=$(node dist/vpm-cli.js cache verify 2>&1)
echo "$OUTPUT" | grep -q "CACHE INTEGRITY MISMATCH"
check $? 0 "cache verify detects corrupted cache"
echo ""

# TEST 6: Cache prune removes unreferenced entries
echo "TEST 6: Cache prune removes unreferenced entries"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
VPM_REGISTRY=$REG node dist/vpm-cli.js install express@4.17.1 > /dev/null 2>&1
# Remove express from lockfile (simulate uninstall)
VPM_REGISTRY=$REG node dist/vpm-cli.js uninstall express > /dev/null 2>&1
# Run prune
node dist/vpm-cli.js cache prune > /dev/null 2>&1
# Check if express@4.17.1 cache is removed
ls "$CACHE_DIR/express@4.17.1.json" 2>/dev/null
check $? 1 "prune removes cache entries not in lockfile"
echo ""

# TEST 7: Cache clean
echo "TEST 7: Cache clean removes all entries"
setup
VPM_REGISTRY=$REG node dist/vpm-cli.js install lodash@4.17.21 > /dev/null 2>&1
node dist/vpm-cli.js cache clean > /dev/null 2>&1
COUNT=$(ls -1 "$CACHE_DIR"/*.json 2>/dev/null | wc -l)
[ $COUNT -eq 0 ]
check $? 0 "cache clean removes all cache entries"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "✅ All Phase 11 tests passed!"
  exit 0
else
  echo "❌ $FAIL tests failed"
  exit 1
fi
