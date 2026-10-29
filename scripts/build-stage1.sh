#!/usr/bin/env bash
# Retired legacy JS builder. CI now invokes the seed-based native proof directly.
set -Eeuo pipefail
echo 'BUILD_STAGE1=RETIRED'
echo 'CAUSE=legacy-JS-bootstrap-builder-has-no-native-JS-artifact-equivalent'
exit 2
