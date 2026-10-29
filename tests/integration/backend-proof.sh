#!/usr/bin/env bash
set -Eeuo pipefail
echo 'INTEGRATION=BLOCKED'
echo 'CAUSE=native-cgc-does-not-implement-db-query-bridge' >&2
exit 2
