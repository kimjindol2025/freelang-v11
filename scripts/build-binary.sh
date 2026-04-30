#!/bin/bash
# Node.js SEA (Single Executable Application) 빌드 스크립트
# 목표: ./freelang 단일 바이너리로 실행 가능하게

set -e

PROJECT_ROOT="/root/kim/freelang-v11"
cd "$PROJECT_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 FreeLang v11 SEA 바이너리 빌드"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: SEA blob 생성
echo "1️⃣ SEA blob 생성..."
node --experimental-sea-config sea-config.json
echo "✓ sea-prep.blob 생성 완료"
echo ""

# Step 2: Node.js 바이너리 복사
echo "2️⃣ Node.js 바이너리 복사..."
NODE_BIN=$(which node)
cp "$NODE_BIN" ./freelang
echo "✓ $NODE_BIN → ./freelang"
echo ""

# Step 3: SEA blob 임베드
echo "3️⃣ SEA blob 임베드..."
SENTINEL_FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
npx postject ./freelang NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse "$SENTINEL_FUSE"
echo "✓ SEA blob 임베드 완료"
echo ""

# Step 4: 실행 권한 부여
echo "4️⃣ 실행 권한 부여..."
chmod +x ./freelang
echo "✓ chmod +x ./freelang"
echo ""

# Step 5: 검증
echo "5️⃣ 검증..."
FILE_TYPE=$(file ./freelang)
echo "파일 타입: $FILE_TYPE"
echo ""

# Step 6: 테스트
echo "6️⃣ 간단한 테스트..."
echo '(println "✨ FreeLang v11 바이너리 작동 확인!")' > /tmp/test-binary.fl
./freelang run /tmp/test-binary.fl
rm /tmp/test-binary.fl
echo ""

# 정리
rm -f sea-prep.blob

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 빌드 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "사용법:"
echo "  ./freelang run hello.fl"
echo "  ./freelang compile src.fl out.js"
echo "  file ./freelang  # ELF 바이너리 확인"
echo ""
