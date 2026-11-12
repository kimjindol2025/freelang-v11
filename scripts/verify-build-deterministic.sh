#!/usr/bin/env bash
# Verify that two production bundle artifacts are unchanged across two builds.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/fl-build-deterministic.XXXXXX")"
cleanup() {
  rm -f -- "$WORK/build-1.log" "$WORK/build-2.log" "$WORK/first.sha" "$WORK/second.sha"
  rmdir -- "$WORK"
}
trap cleanup EXIT

for run in 1 2; do
  if ! npm run build >"$WORK/build-$run.log" 2>&1; then
    echo "Build $run failed"
    tail -n 30 "$WORK/build-$run.log"
    exit 1
  fi
  if [[ "$run" -eq 1 ]]; then
    sha256sum bootstrap.js stdlib-extensions.js >"$WORK/first.sha"
  else
    sha256sum bootstrap.js stdlib-extensions.js >"$WORK/second.sha"
  fi
done

if ! cmp -s "$WORK/first.sha" "$WORK/second.sha"; then
  echo 'Build DIFFERS'
  diff -u "$WORK/first.sha" "$WORK/second.sha" || true
  exit 1
fi

echo 'Build Deterministic'
echo '2/2 artifacts identical (bootstrap.js, stdlib-extensions.js)'
