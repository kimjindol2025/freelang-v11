#!/usr/bin/env bash
set -Eeuo pipefail
echo 'NATIVE_SERVER=BLOCKED'
echo 'CAUSE=native-http-server-unavailable' >&2
exit 2
