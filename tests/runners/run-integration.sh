#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

printf '%s\n' 'Running integration tests...'
bash "${repo_dir}/tests/integration/backend-proof.sh"
printf '%s\n' 'Integration: 1 passed, 0 failed'
