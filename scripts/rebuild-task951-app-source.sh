#!/usr/bin/env bash
set -Eeuo pipefail

FRONTEND_REPO="${1:?usage: rebuild-task951-app-source.sh <freelang-front-repo> <record-dir>}"
RECORD_DIR="${2:?usage: rebuild-task951-app-source.sh <freelang-front-repo> <record-dir>}"
EXPECTED_HEAD=9c1202dae761f1faff777c48887ed19f5960b3c9

actual_head="$(git -C "$FRONTEND_REPO" rev-parse HEAD)"
if [[ "$actual_head" != "$EXPECTED_HEAD" ]]; then
  printf 'FRONTEND_HEAD_MISMATCH expected=%s actual=%s\n' "$EXPECTED_HEAD" "$actual_head" >&2
  exit 2
fi
mkdir -p "$RECORD_DIR"
if [[ -e "$RECORD_DIR/_app.fl" || -e "$RECORD_DIR/build.log" ]]; then
  echo 'record directory already contains source output' >&2
  exit 2
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$FRONTEND_REPO" archive "$EXPECTED_HEAD" | tar -x -C "$work"
(cd "$work" && node ./fl-front-build.js) >"$RECORD_DIR/build.log" 2>&1
cp "$work/_app.fl" "$RECORD_DIR/_app.fl"
printf 'FRONTEND_HEAD=%s\n' "$actual_head"
wc -l "$RECORD_DIR/_app.fl"
sha256sum "$RECORD_DIR/_app.fl"
