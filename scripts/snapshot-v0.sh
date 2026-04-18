#!/data/data/com.termux/files/usr/bin/bash
# P00/06: bootstrap.js 를 v0 baseline 으로 영구 lock.
# 셀프호스팅 진행 중 회귀 감지용. v12 완료 후에도 보존.

set -e
cd "$(dirname "$0")/.."

if [ ! -f bootstrap.js ]; then
  echo "snapshot=failed reason=no_bootstrap.js" >&2
  exit 1
fi

# 기존 snapshot 존재하면 덮어쓰기 전 확인
if [ -f bootstrap.v0.js ]; then
  OLD=$(sha256sum bootstrap.v0.js | awk '{print $1}')
  NEW=$(sha256sum bootstrap.js | awk '{print $1}')
  if [ "$OLD" = "$NEW" ]; then
    echo "snapshot=unchanged sha256=$NEW"
    exit 0
  fi
  echo "snapshot=warning old_exists=true old_sha256=$OLD new_sha256=$NEW" >&2
  # 확정 스냅샷이 있으면 덮어쓰지 않음
  if [ -n "$FORCE" ]; then
    cp bootstrap.js bootstrap.v0.js
    echo "snapshot=overwritten sha256=$NEW"
  else
    echo "hint=set FORCE=1 to overwrite" >&2
    exit 2
  fi
else
  cp bootstrap.js bootstrap.v0.js
  SHA=$(sha256sum bootstrap.v0.js | awk '{print $1}')
  SIZE=$(stat -c%s bootstrap.v0.js 2>/dev/null || stat -f%z bootstrap.v0.js)
  echo "snapshot=created sha256=$SHA bytes=$SIZE"
fi
