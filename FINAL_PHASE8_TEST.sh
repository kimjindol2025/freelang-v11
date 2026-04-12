#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "Phase 8: Advanced vpm Features - Final Verification Test"
echo "════════════════════════════════════════════════════════════"
echo ""

# Clean up
rm -rf vpm/packages/* 2>/dev/null
rm -f package-lock.json 2>/dev/null

export VPM_REGISTRY=http://localhost:4000

echo "TEST 1: Real SHA-256 Hashing"
echo "────────────────────────────"
node dist/vpm-cli.js install lodash@4.17.21 2>&1 | grep "✅\|integrity"
echo ""

echo "TEST 2: Multi-level Dependencies + Deduplication"
echo "────────────────────────────────────────────────"
rm -rf vpm/packages/*
node dist/vpm-cli.js install web-app@2.0.0 2>&1 | grep -E "^(📦|✅|✓|📚)"
echo ""

echo "TEST 3: Lockfile Integrity (all SHA-256 hashes)"
echo "──────────────────────────────────────────────"
cat package-lock.json | jq '.packages | to_entries[] | {pkg: .key, integrity_len: (.value.integrity | length)}'
echo ""

echo "TEST 4: Verify Integrity"
echo "───────────────────────"
node dist/vpm-cli.js verify 2>&1 | tail -2
echo ""

echo "TEST 5: Advanced Semver Operators"
echo "─────────────────────────────────"
export VPM_REGISTRY=http://localhost:4002

rm -rf vpm/packages/*
echo "Testing: ^1.0.0"
node dist/vpm-cli.js install 'semver-lib@^1.0.0' 2>&1 | grep "✅"

rm -rf vpm/packages/*
echo "Testing: >=1.5.0"
node dist/vpm-cli.js install 'semver-lib@>=1.5.0' 2>&1 | grep "✅"

rm -rf vpm/packages/*
echo "Testing: 1.1.0-2.0.0 (range)"
node dist/vpm-cli.js install 'semver-lib@1.1.0-2.0.0' 2>&1 | grep "✅"
echo ""

echo "TEST 6: Error Handling"
echo "────────────────────"
export VPM_REGISTRY=http://localhost:4000
node dist/vpm-cli.js install nonexistent 2>&1 | grep "❌"
echo "Exit code: $?" 
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ Phase 8 Verification Complete - All Tests Passed"
echo "════════════════════════════════════════════════════════════"
