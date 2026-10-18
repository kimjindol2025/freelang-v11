#!/usr/bin/env bash
# Legacy JS self-host suite retired; use the seed-based native compiler proof.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"
