#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SEED="$ROOT/bin/cgc-bin-x86_64-seed-v11"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/fl-v11-native-fixpoint.XXXXXX")"
trap 'rm -rf -- "$WORK"' EXIT INT TERM

if [[ ! -x "$SEED" ]]; then
  echo 'NATIVE_FIXED_POINT=BLOCKED'
  echo 'CAUSE=seed-compiler-missing'
  exit 2
fi

echo '=== native compiler fixed point: stages 2, 3, 4 ==='
sha256sum "$SEED"
"$SEED" "$ROOT/self/cgc-main.fl" "$WORK/stage2.c"
bash "$SCRIPT_DIR/build-cgc-native.sh" "$WORK/stage2.c" "$WORK/stage2-bin" >/dev/null
"$WORK/stage2-bin" "$ROOT/self/cgc-main.fl" "$WORK/stage3.c"
bash "$SCRIPT_DIR/build-cgc-native.sh" "$WORK/stage3.c" "$WORK/stage3-bin" >/dev/null
"$WORK/stage3-bin" "$ROOT/self/cgc-main.fl" "$WORK/stage4.c"

sha256sum "$WORK/stage2.c" "$WORK/stage3.c" "$WORK/stage4.c"
set +e
cmp -s "$WORK/stage2.c" "$WORK/stage3.c"
CMP_23=$?
cmp -s "$WORK/stage3.c" "$WORK/stage4.c"
CMP_34=$?
set -e
echo "CMP_2_3=$CMP_23"
echo "CMP_3_4=$CMP_34"
if [[ "$CMP_23" -eq 0 && "$CMP_34" -eq 0 ]]; then
  echo 'NATIVE_FIXED_POINT=PASS'
else
  echo 'NATIVE_FIXED_POINT=FAIL'
  exit 1
fi
