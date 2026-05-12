#!/bin/bash
# Gogs 저장소에 .env 자격증명으로 푸시하는 스크립트

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# .env 파일 확인
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ .env 파일을 찾을 수 없습니다: $ENV_FILE"
    echo "📝 다음 명령어로 .env를 생성하세요:"
    echo "   cp $SCRIPT_DIR/.env.example .env (있으면)"
    echo "   또는 직접 생성: echo 'GOGS_TOKEN=...' > .env"
    exit 1
fi

# .env에서 변수 읽기
source "$ENV_FILE"

# 필수 변수 확인
if [[ -z "$GOGS_TOKEN" || "$GOGS_TOKEN" == "your_personal_access_token_here" ]]; then
    echo "❌ .env에서 GOGS_TOKEN이 설정되지 않았습니다"
    echo "📝 .env에서 다음을 수정하세요:"
    echo "   GOGS_TOKEN=your_actual_token"
    exit 1
fi

GOGS_USERNAME="${GOGS_USERNAME:-kim}"
GOGS_URL="${GOGS_URL:-https://gogs.dclub.kr}"
GOGS_REPO="${GOGS_REPO:-freelang-v11}"
BRANCH="${1:-master}"

echo "🔐 Gogs에 푸시 중..."
echo "   URL: $GOGS_URL"
echo "   저장소: $GOGS_REPO"
echo "   브랜치: $BRANCH"
echo ""

# 임시로 원격 URL 변경 (자격증명 포함)
ORIGINAL_URL=$(git -C "$SCRIPT_DIR" remote get-url origin)
AUTHENTICATED_URL="https://${GOGS_USERNAME}:${GOGS_TOKEN}@gogs.dclub.kr/${GOGS_USERNAME}/${GOGS_REPO}.git"

# 푸시 실행
git -C "$SCRIPT_DIR" remote set-url origin "$AUTHENTICATED_URL"
if git -C "$SCRIPT_DIR" push origin "$BRANCH" 2>&1; then
    echo ""
    echo "✅ 푸시 성공!"
else
    PUSH_RESULT=$?
    git -C "$SCRIPT_DIR" remote set-url origin "$ORIGINAL_URL"
    echo ""
    echo "❌ 푸시 실패 (exit code: $PUSH_RESULT)"
    exit $PUSH_RESULT
fi

# URL 복원 (보안상 토큰 제거)
git -C "$SCRIPT_DIR" remote set-url origin "$ORIGINAL_URL"

echo "✨ 완료!"
