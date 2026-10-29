#!/usr/bin/env bash
# Aggregate entrypoint now delegates to the supported native fixed-point check.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/verify-native-fixed-point.sh" "$@"
