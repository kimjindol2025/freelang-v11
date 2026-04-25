# FreeLang CLI — npm 패키지 배포 가이드

## 📦 npm에 배포하기

### 1단계: npm 계정 준비

```bash
npm login
# Username: your-npm-username
# Password: ***
# Email: your-email@example.com
```

### 2단계: 버전 업데이트

```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

### 3단계: npm에 배포

```bash
npm publish
```

출력:
```
npm notice
npm notice 📦  freelang-cli@1.0.0
npm notice === Tarball Contents ===
npm notice 709B  bin/freelang
npm notice 5.2kB src/CLI.md
...
npm notice === Dist Files ===
npm notice ...
npm notice
npm notice ✓ published to npm (https://www.npmjs.com/package/freelang-cli)
```

---

## 🚀 사용자가 설치하기

### 글로벌 설치

```bash
npm install -g freelang-cli
```

이후:
```bash
freelang new myapp
freelang dev
freelang deploy
```

### 로컬 설치

```bash
npm install freelang-cli --save-dev
```

이후:
```bash
npx freelang new myapp
npm run dev
npm run deploy
```

---

## 📋 배포 체크리스트

- [ ] `package-cli.json` 버전 확인
- [ ] `bin/freelang` 권한 확인 (`chmod +x`)
- [ ] 모든 커맨드 테스트 (`freelang --help`)
- [ ] 로컬에서 `npm pack` 테스트
- [ ] 테스트 프로젝트 생성 (`freelang new test`)
- [ ] git에 태그 추가 (`git tag v1.0.0`)
- [ ] `npm publish` 실행

---

## 🔐 npmrc 설정 (선택)

```bash
# ~/.npmrc
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=YOUR_TOKEN
```

---

## 🐛 배포 문제 해결

### "Permission denied" 오류

```bash
chmod +x bin/freelang
```

### "package.json not found" 오류

package-cli.json을 package.json으로 복사:
```bash
cp package-cli.json package.json
npm publish
```

### 이미 배포된 버전

버전 번호를 올린 후 재배포:
```bash
npm version patch
npm publish
```

---

## 📊 배포 후 확인

### 1. npm 레지스트리에서 확인

https://www.npmjs.com/package/freelang-cli

### 2. 글로벌 설치 테스트

```bash
npm install -g freelang-cli
freelang --version
freelang --help
```

### 3. 새 프로젝트 생성

```bash
mkdir test-workspace && cd test-workspace
freelang new myapp
cd myapp
freelang dev
```

---

## 🔄 업데이트 배포

### 버그 수정 (patch)

```bash
# 코드 수정
npm version patch    # 1.0.0 → 1.0.1
npm publish
```

### 새 기능 (minor)

```bash
# 기능 추가
npm version minor    # 1.0.0 → 1.1.0
npm publish
```

### 주요 변경 (major)

```bash
# 인터페이스 변경
npm version major    # 1.0.0 → 2.0.0
npm publish
```

---

## 📈 배포 후 개선

### 다운로드 추적

```bash
npm stats freelang-cli
```

### 사용자 피드백

- GitHub Issues
- npm 리뷰
- 커뮤니티 포럼

### 다음 버전 계획

1. **v1.1.0** — GUI 대시보드
2. **v1.2.0** — 클라우드 배포 통합
3. **v2.0.0** — TypeScript 완전 지원

---

## 💡 팁

✓ **자동 배포** — CI/CD 파이프라인에서 자동화
✓ **버전 관리** — semantic versioning 준수
✓ **변경로그** — CHANGELOG.md 유지
✓ **테스트** — 배포 전 완전 테스트
✓ **문서화** — README와 wiki 최신화

