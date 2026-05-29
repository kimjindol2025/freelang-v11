#!/bin/bash
# verify-l4-fixpoint.sh — L4 고정점 검증 (Node.js 불필요)
# 목표: cgc-bin이 자신을 정확히 재생성하는지 3중 SHA256으로 증명
# 사용: bash scripts/verify-l4-fixpoint.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ L4 Self-Hosting Verification (Node.js 불필요)            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ── cgc-bin 위치 확인 ──
CGC_BIN="$REPO_ROOT/bin/cgc-bin"
if [[ ! -x "$CGC_BIN" ]]; then
  if [[ -x /tmp/gen1-bin ]]; then
    CGC_BIN=/tmp/gen1-bin
    echo "⚠️  bin/cgc-bin 없음, /tmp/gen1-bin 사용 (make install-native 권장)"
  else
    echo "❌ cgc-bin not found. Run: make install-native"
    exit 1
  fi
fi

echo "✅ cgc-bin: $CGC_BIN"
ldd "$CGC_BIN" | grep -E "libm|libc|ld-linux" | head -3

echo ""
echo "── Step 1: cgc-bin → gen1.c ──"
(cd "$REPO_ROOT" && "$CGC_BIN" self/cgc-main.fl /tmp/verify-gen1.c)
SHA1=$(sha256sum /tmp/verify-gen1.c | cut -d' ' -f1)
echo "gen1.c SHA: $SHA1"

echo ""
echo "── Step 2: gen1.c → gen1-bin ──"
bash "$SCRIPT_DIR/build-cgc-native.sh" /tmp/verify-gen1.c /tmp/verify-gen1-bin > /dev/null 2>&1
echo "✅ gen1-bin: $(stat --format=%s /tmp/verify-gen1-bin) bytes"

echo ""
echo "── Step 3: gen1-bin → gen2.c ──"
(cd "$REPO_ROOT" && /tmp/verify-gen1-bin self/cgc-main.fl /tmp/verify-gen2.c)
SHA2=$(sha256sum /tmp/verify-gen2.c | cut -d' ' -f1)
echo "gen2.c SHA: $SHA2"

echo ""
echo "── Step 4: gen2.c → gen2-bin → gen3.c ──"
bash "$SCRIPT_DIR/build-cgc-native.sh" /tmp/verify-gen2.c /tmp/verify-gen2-bin > /dev/null 2>&1
(cd "$REPO_ROOT" && /tmp/verify-gen2-bin self/cgc-main.fl /tmp/verify-gen3.c)
SHA3=$(sha256sum /tmp/verify-gen3.c | cut -d' ' -f1)
echo "gen3.c SHA: $SHA3"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ L4 Verification Results                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "SHA256:"
echo "  gen1.c (cgc-bin):   $SHA1"
echo "  gen2.c (gen1-bin):  $SHA2"
echo "  gen3.c (gen2-bin):  $SHA3"

if [[ "$SHA1" == "$SHA2" ]] && [[ "$SHA2" == "$SHA3" ]]; then
  echo ""
  echo "🎉 L4 FIXED-POINT ACHIEVED!"
  echo "✅ gen1.c == gen2.c == gen3.c (SHA256 match)"
  echo "✅ Node.js 완전 불필요"
  exit 0
else
  echo ""
  echo "❌ Fixed-point NOT achieved — SHA256 mismatch"
  [[ "$SHA1" != "$SHA2" ]] && echo "   gen1.c ≠ gen2.c"
  [[ "$SHA2" != "$SHA3" ]] && echo "   gen2.c ≠ gen3.c"
  exit 1
fi
