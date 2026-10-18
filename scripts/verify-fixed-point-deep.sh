#!/usr/bin/env bash
# Legacy depth-based JS check retired; the supported fixed-point is native stages 2-4.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"
