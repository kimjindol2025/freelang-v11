#!/usr/bin/env bash
# Native replacement for the retired JS bootstrap fixed-point check.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"; then
  echo 'FIXED-POINT=PASS'
else
  status=$?
  echo 'FIXED-POINT=FAIL'
  exit "$status"
fi
