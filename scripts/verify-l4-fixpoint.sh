#!/bin/bash
# verify-l4-fixpoint.sh — L4 고정점 검증 (자가호스팅)
# 목표: 네이티브 컴파일러가 자신과 입력을 동일하게 재생성하는지 증명
# 사용: bash scripts/verify-l4-fixpoint.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="$REPO_ROOT/runtime"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ L4 Self-Hosting Verification                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ── Phase 1: Check native compiler exists ──
if [[ ! -f /tmp/gen1-bin ]]; then
  echo "❌ /tmp/gen1-bin not found. Run Phase D-1/D-2 first."
  exit 1
fi

echo "✅ gen1-bin found"
ldd /tmp/gen1-bin | grep -E "libm|libc|ld-linux" | head -3

echo ""
echo "── Step 1: Bootstrap compile (cgc-main.fl → gen1.c) ──"
node --stack-size=8192 "$REPO_ROOT/bootstrap.js" run \
  "$REPO_ROOT/self/cgc-main.fl" "$REPO_ROOT/self/cgc-main.fl" /tmp/verify-gen1.c > /dev/null 2>&1
SHA1=$(sha256sum /tmp/verify-gen1.c | cut -d' ' -f1)
echo "Bootstrap gen1.c: SHA=$SHA1"

echo ""
echo "── Step 2: Native compile gen1 → gen2 (PATH=/usr/bin:/bin) ──"
(cd "$REPO_ROOT" && env -i PATH=/usr/bin:/bin /tmp/gen1-bin self/cgc-main.fl /tmp/verify-gen2.c)
SHA2=$(sha256sum /tmp/verify-gen2.c | cut -d' ' -f1)
echo "Native gen2.c: SHA=$SHA2"

echo ""
echo "── Step 3: Compile gen2 to binary (gen2-bin) ──"
bash "$SCRIPT_DIR/build-cgc-native.sh" /tmp/verify-gen2.c /tmp/verify-gen2-bin > /dev/null 2>&1
echo "✅ gen2-bin created ($(stat --format=%s /tmp/verify-gen2-bin) bytes)"

echo ""
echo "── Step 4: Native compile gen2 → gen3 (PATH=/usr/bin:/bin) ──"
(cd "$REPO_ROOT" && env -i PATH=/usr/bin:/bin /tmp/verify-gen2-bin self/cgc-main.fl /tmp/verify-gen3.c)
SHA3=$(sha256sum /tmp/verify-gen3.c | cut -d' ' -f1)
echo "Native gen3.c: SHA=$SHA3"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ L4 Verification Results                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"

echo ""
echo "SHA256 Hashes:"
echo "  gen1.c (bootstrap): $SHA1"
echo "  gen2.c (gen1-bin):  $SHA2"
echo "  gen3.c (gen2-bin):  $SHA3"

if [[ "$SHA1" == "$SHA2" ]] && [[ "$SHA2" == "$SHA3" ]]; then
  echo ""
  echo "🎉 L4 FIXED-POINT ACHIEVED!"
  echo "   Native compiler is stable and self-hosting."
  echo ""
  echo "✅ gen1.c == gen2.c == gen3.c (SHA256 match)"
  echo "✅ Node.js/Bun not required for compilation"
  echo "✅ PATH=/usr/bin:/bin compatibility verified"
  exit 0
else
  echo ""
  echo "❌ Fixed-point NOT achieved"
  echo "   SHA256 mismatch detected."
  if [[ "$SHA1" != "$SHA2" ]]; then
    echo "   - gen1.c ≠ gen2.c (bootstrap ≠ gen1-bin)"
  fi
  if [[ "$SHA2" != "$SHA3" ]]; then
    echo "   - gen2.c ≠ gen3.c (gen1-bin ≠ gen2-bin)"
  fi
  exit 1
fi
