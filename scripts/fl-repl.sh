#!/usr/bin/env bash
set -Eeuo pipefail
echo 'NATIVE_REPL=BLOCKED'
echo 'CAUSE=native-interactive-repl-unavailable' >&2
exit 2
