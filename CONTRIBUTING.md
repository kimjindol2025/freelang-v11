# FreeLang v9에 기여하기

FreeLang v9 프로젝트에 기여해주셔서 감사합니다! 🙏

이 가이드는 어떻게 기여할 수 있는지 설명합니다.

---

## 🤝 기여하는 방법

### 1. 버그 리포트
**문제를 찾으셨나요?**

1. [버그 리포트 이슈](./github/ISSUE_TEMPLATE/bug-report.md) 생성
2. 다음 정보 포함:
   - 재현 방법
   - 예상 동작
   - 실제 동작
   - 환경 정보
   - 스크린샷/로그

**체크리스트:**
- [ ] 비슷한 이슈 검색함
- [ ] 최신 버전에서도 발생하는지 확인
- [ ] 재현 단계가 명확함
- [ ] 환경 정보 포함함

### 2. 기능 요청
**새로운 기능 아이디어가 있나요?**

1. [기능 요청 이슈](./github/ISSUE_TEMPLATE/feature-request.md) 생성
2. 또는 [Discussion](./github/DISCUSSIONS.md)에서 토론

**포함할 내용:**
- [ ] 기능 설명
- [ ] 사용 사례
- [ ] 코드 예제
- [ ] 대안 검토

### 3. 코드 기여
**코드로 기여하고 싶으신가요?**

#### Step 1: 준비
```bash
# 저장소 포크
git clone https://github.com/YOUR_USERNAME/freelang-v9.git
cd freelang-v9

# 브랜치 생성
git checkout -b feature/your-feature-name
```

#### Step 2: 개발
```bash
# 의존성 설치
npm install

# 테스트 실행
npm test

# 개발 서버 시작
npm run dev
```

#### Step 3: 커밋
```bash
# 변경사항 스테이징
git add .

# 의미 있는 메시지로 커밋
git commit -m "feat: 기능 설명"

# 푸시
git push origin feature/your-feature-name
```

#### Step 4: Pull Request
1. GitHub에서 PR 생성
2. PR 템플릿 채우기:
   - 무엇을 변경했는가?
   - 왜 이 변경이 필요한가?
   - 어떻게 테스트했는가?

#### Step 5: 리뷰
- 코드 리뷰 받기
- 피드백 반영
- 승인 후 머지

---

## 📋 기여 체크리스트

### 코드 기여 전
- [ ] 이슈나 Discussion에서 먼저 논의
- [ ] 비슷한 PR이 없는지 확인
- [ ] 타겟 브랜치는 `master`
- [ ] 최신 코드로 리베이스

### 코드 작성 중
- [ ] v9-First 정책 따름 (stdlib는 TS, 앱은 v9)
- [ ] 기존 패턴 따름
- [ ] 주석 추가 (필요시)
- [ ] 타입 안정성 유지

### 제출 전
- [ ] 테스트 추가/수정
- [ ] 모든 테스트 통과: `npm test`
- [ ] TypeScript 오류 없음: `npm run type-check`
- [ ] 커밋 메시지가 명확함
- [ ] CHANGELOG 업데이트

---

## 💻 개발 환경

### 요구사항
- Node.js 18+
- npm 9+
- 터미널 (bash/zsh/PowerShell)

### 설치
```bash
git clone https://github.com/kimjindol2025/freelang-v9.git
cd freelang-v9
npm install
```

### 주요 명령어
```bash
npm test          # 테스트 실행
npm run build     # 빌드
npm run dev       # 개발 모드
npm run format    # 코드 포매팅
npm run type-check # 타입 체크
```

---

## 📚 코드 스타일

### 커밋 메시지
```
type: 짧은 설명 (50자 이하)

자세한 설명 (필요시)
- 줄 바꿈으로 구분
- 70자 이내로 감싸기
```

**타입:**
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `docs:` 문서
- `style:` 코드 스타일
- `refactor:` 리팩토링
- `test:` 테스트
- `chore:` 기타

### 코드 포매팅
```bash
# 자동 포매팅
npm run format

# 체크만
npm run format:check
```

---

## 🧪 테스트

### 테스트 작성
```typescript
describe('기능명', () => {
  it('동작을 설명', () => {
    expect(result).toBe(expected);
  });
});
```

### 테스트 실행
```bash
npm test                    # 모든 테스트
npm test -- --watch        # 감시 모드
npm test -- --coverage     # 커버리지 리포트
```

### 커버리지 목표
- 최소 80% 라인 커버리지
- 모든 새로운 기능은 테스트 필수

---

## 📖 문서 기여

### 문서 추가
```bash
# 새 문서 생성
docs/guide/새-주제.md
```

### 마크다운 템플릿
```markdown
# 제목

## 소개

## 사용법

## 예제

## 다음 단계

---

[이전 페이지](../path/) | [메인](../README.md)
```

### 문서 테스트
```bash
# 로컬에서 보기
cd docs
bundle install
jekyll serve
```

---

## 🎯 기여 아이디어

### 쉬운 작업 (초보자)
- 문서 개선
- 오타 수정
- 예제 추가
- 라벨 추가

### 중간 작업
- 버그 수정
- 테스트 추가
- 작은 기능
- 리팩토링

### 어려운 작업
- 새로운 stdlib 모듈
- 언어 기능 추가
- 성능 최적화
- 아키텍처 개선

---

## 🚀 릴리스 프로세스

1. **기능 완료**: 모든 테스트 통과
2. **버전 업데이트**: package.json
3. **CHANGELOG 작성**: 변경 사항 기록
4. **PR 검토**: 유지보수자 승인
5. **머지**: main 브랜치에 머지
6. **릴리스**: npm publish
7. **태그**: Git 태그 생성

---

## 🤔 FAQ

### Q: 첫 기여는 어떻게 시작하나요?
A: "good first issue" 라벨을 찾아서 시작해보세요!

### Q: 큰 변경을 하려면?
A: 먼저 Discussion이나 이슈에서 논의해주세요.

### Q: 리뷰는 얼마나 걸리나요?
A: 보통 3-7일 내에 피드백을 드립니다.

### Q: 내 PR이 거절되면?
A: 피드백을 반영해서 다시 시도하거나 Discussion에서 논의할 수 있습니다.

---

## 📞 도움이 필요하신가요?

- **질문**: [Discussions - Help](https://github.com/kimjindol2025/freelang-v9/discussions?discussions_q=category%3AHelp)
- **버그**: [Issues - Bug](https://github.com/kimjindol2025/freelang-v9/issues?q=is%3Aissue+label%3Abug)
- **문서**: [CLAUDE.md](./CLAUDE.md)
- **블로그**: [blog.dclub.kr](https://blog.dclub.kr)

---

## 💝 감사의 말

FreeLang v9에 기여해주셔서 감사합니다! 🙏

당신의 기여는 AI를 위한, AI에 의한, AI가 쓰고 싶은 언어를 만드는 데 도움이 됩니다.

---

**Happy coding! 🚀**
