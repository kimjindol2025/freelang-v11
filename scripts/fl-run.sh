#!/usr/bin/env bash
# Run FreeLang through the native C compiler and runner.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
if [[ -n "${FL_TOOLS_DISPATCH_ROOT:-}" ]]; then
  TOOLS_ROOT="$FL_TOOLS_DISPATCH_ROOT"
else
  TOOLS_ROOT="$ROOT_DIR/../freelang-tools"
fi
RUNNER="$TOOLS_ROOT/scripts/fl-cgc-run"

if [[ ! -x "$RUNNER" ]]; then
  echo 'RUN=BLOCKED' >&2
  echo 'CAUSE=native-runner-missing' >&2
  exit 2
fi

exec "$RUNNER" "$@"
