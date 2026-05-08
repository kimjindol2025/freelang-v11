#!/usr/bin/env bash
# safe-push.sh — bootstrap.js 충돌 없이 안전하게 gogs에 푸시
# Usage: ./scripts/safe-push.sh "commit message"
set -e

MSG="${1:-chore: auto safe-push}"
REMOTE="${2:-origin}"
BRANCH="${3:-master}"

cd "$(git rev-parse --show-toplevel)"

echo "=== [1/6] 현재 변경 stash ==="
git stash --include-untracked

echo "=== [2/6] 원격 최신 merge ==="
git fetch "$REMOTE"
git merge "$REMOTE/$BRANCH" --no-edit || {
  echo "Merge 충돌 — bootstrap.js만 충돌 시 자동 해결"
  git checkout --theirs bootstrap.js 2>/dev/null || true
  git add bootstrap.js 2>/dev/null || true
  git merge --continue --no-edit
}

echo "=== [3/6] stash pop ==="
git stash pop

echo "=== [4/6] 빌드 (bootstrap.js 재생성) ==="
npm run build

echo "=== [5/6] 커밋 ==="
git add -A
git commit -m "$MSG" || echo "(변경 없음 — 커밋 스킵)"

echo "=== [6/6] 푸시 ==="
git push "$REMOTE" "$BRANCH"

echo "=== Done ==="
