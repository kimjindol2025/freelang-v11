#!/usr/bin/env bash
# Legacy bundle determinism entrypoint redirected to native compiler fixed point.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"
