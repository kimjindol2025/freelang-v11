#!/usr/bin/env bash
# Legacy entrypoint retained for CI compatibility; verification is native C only.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"
