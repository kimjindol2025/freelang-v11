#!/bin/bash
# Shared helpers for parity test scripts.
# Each NN-<feature>.sh sources this, runs curl/grep, and prints one line:
#   RESULT feature=<id> pass=<true|false> score=<0..1> evidence=<path> observed=<k=v;...>
# Aggregator (run-all.sh) collects these lines into parity-report.json.

set -u

# Repo root = parent-parent of this script
PARITY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVIDENCE_DIR="$PARITY_ROOT/tests/evidence"
FIXTURE_APP="$PARITY_ROOT/tests/fixtures/basic-app"
PARITY_PORT="${PARITY_PORT:-30099}"

mkdir -p "$EVIDENCE_DIR"

# Start a background serve process for the fixture app. Returns PID on stdout.
serve_start() {
  local app="${1:-$FIXTURE_APP}"
  local port="${2:-$PARITY_PORT}"
  local log="${3:-$EVIDENCE_DIR/_serve.log}"
  ( cd "$PARITY_ROOT" && node bootstrap.js serve "$app" --port "$port" > "$log" 2>&1 ) &
  local pid=$!
  # Poll for readiness (up to 5s)
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" | grep -q "^[2345]"; then
      echo "$pid"
      return 0
    fi
  done
  echo "$pid"
  return 1
}

serve_stop() {
  local pid="$1"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
  fi
}

# Emit one RESULT line.
emit_result() {
  local feature="$1"
  local pass="$2"
  local score="$3"
  local evidence="$4"
  local observed="$5"
  echo "RESULT feature=$feature pass=$pass score=$score evidence=$evidence observed=$observed"
}
