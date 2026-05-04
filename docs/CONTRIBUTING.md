# 기여 가이드

> FreeLang v11 커뮤니티에 참여하는 방법

---

## 🎯 우리의 가치

FreeLang은 다음의 가치를 추구합니다:

- ✅ **포용성**: 모든 기술 수준 환영
- ✅ **투명성**: 의사결정 과정 공개
- ✅ **품질**: 코드 및 문서 품질 우선
- ✅ **존중**: 모든 참여자의 아이디어 존중

---

## 🐛 버그 리포팅

### 버그를 찾았을 때

1. **중복 확인**: [기존 Issues](https://gogs.dclub.kr/kim/freelang-v11/issues) 확인
2. **상세 작성**: 재현 단계 + 예상/실제 결과
3. **환경 정보**: Node.js 버전, OS, 브라우저 (해당시)

### 좋은 버그 리포트 예시

```
제목: JSON 파싱 시 특수문자 처리 오류

재현 단계:
1. 다음 코드 실행:
   (json-parse "{\"test\": \"\\n\"}")
2. 오류 발생

예상 결과:
  {:test "\n"}

실제 결과:
  Error: Invalid escape sequence

환경:
  Node.js: v25
  OS: macOS 14.2
```

### 버그 리포팅 템플릿

```markdown
## 설명
[짧은 설명]

## 재현 단계
1.
2.
3.

## 예상 결과
[예상 동작]

## 실제 결과
[실제 동작]

## 추가 정보
- Node.js 버전: 
- 운영체제: 
- 관련 코드:
```

---

## 💡 기능 제안

### 새로운 기능을 제안할 때

1. **기존 Issues 확인**: 중복 제안 피하기
2. **명확한 설명**: 문제 + 해결책 설명
3. **사용 사례**: 실제 사용 시나리오 포함
4. **우선순위**: 중요도 표시

### 좋은 기능 제안 예시

```
제목: AWS Lambda Layer 지원 추가

문제:
  AWS Lambda 함수에 외부 라이브러리를 포함할 때
  패키지 크기 제한으로 어려움

해결책:
  (aws-lambda-layer :name "my-layer" :dir "node_modules")
  블록으로 Lambda Layer를 자동 생성

사용 사례:
  - 공유 라이브러리를 별도 레이어로 분리
  - 배포 패키지 크기 감소

우선순위: 중간 (AWS 사용자에게 유용)
```

---

## 🔧 코드 기여

### 준비 단계

1. **Fork**: 리포지토리를 포크
2. **브랜치**: `git checkout -b feature/amazing-feature`
3. **개발**: 코드 작성
4. **테스트**: `npm test` 실행 (637/637 PASS 필수)
5. **커밋**: 명확한 메시지로 커밋
6. **푸시**: 브랜치에 푸시
7. **PR**: Pull Request 생성

### 개발 환경 설정

```bash
# 1. 리포지토리 클론
git clone https://github.com/yourname/freelang-v11.git
cd freelang-v11

# 2. 의존성 설치
npm install

# 3. 빌드
npm run build

# 4. 테스트 (개발 중)
npm run test:watch

# 5. 코드 확인
npm test      # 전체 테스트
npm run build # 빌드 확인
```

### 코드 스타일

FreeLang은 다음 스타일을 따릅니다:

```typescript
// 1. 타입 안전성
function processUser(user: User): Result {
  if (!user.email) {
    return { ok: false, error: "Email required" };
  }
  return { ok: true, data: user };
}

// 2. 에러 처리
try {
  const result = await riskyOperation();
  return result;
} catch (e) {
  log.error("Operation failed", e);
  return { error: String(e) };
}

// 3. 테스트
describe("processUser", () => {
  it("should validate email", () => {
    const result = processUser({ name: "Kim" });
    expect(result.ok).toBe(false);
  });
});

// 4. 주석 (필요할 때만)
// 복잡한 알고리즘 설명
// 단순 구현은 코드가 설명이 되도록
```

### 커밋 메시지 규칙

```bash
# 형식
<type>: <제목>

<본문>

# 타입
feat     - 새 기능
fix      - 버그 수정
docs     - 문서
style    - 포맷팅
refactor - 코드 정리
test     - 테스트
perf     - 성능

# 예시
git commit -m "feat: AWS Lambda Layer 자동 생성 블록 추가

- (aws-lambda-layer) 블록 구현
- Layer YAML 생성
- 테스트 추가 (10/10 PASS)
- 문서 업데이트"
```

### Pull Request 작성

```markdown
## 설명
[변경 사항 요약]

## 타입
- [ ] 🐛 버그 수정
- [ ] ✨ 새 기능
- [ ] 📚 문서
- [ ] ♻️ 리팩토링

## 테스트
- [x] npm test (637/637 PASS)
- [x] npm run build (성공)
- [x] 수동 테스트 완료

## 체크리스트
- [ ] 커밋 메시지가 명확한가
- [ ] 테스트를 추가했는가
- [ ] 문서를 업데이트했는가
- [ ] 다른 코드에 영향이 없는가

## 연관 Issue
Closes #123
```

---

## 📚 문서 기여

### 문서 개선 방법

```bash
# 1. 문서 수정 (docs/ 또는 README.md)
git checkout -b docs/improve-quickstart

# 2. 마크다운 작성
# - 영어: 명확하고 간단하게
# - 한국어: 존경체 또는 해체 (일관성)
# - 코드 예제: 실행 가능한 형태

# 3. PR 생성
# 제목: "docs: QUICKSTART.md 오타 수정"
```

### 문서 스타일

```markdown
# 좋은 문서

## 헤더 사용
### 소제목

**굵은 텍스트**로 강조
- 리스트로 항목 나열
- 명확한 구조

\`\`\`javascript
// 코드는 실행 가능해야 함
const user = { name: "Kim" };
\`\`\`

| 테이블 | 로 |
|--------|-----|
| 데이터 | 정리 |
```

---

## 🧪 테스트 작성

### 테스트 원칙

1. **필수**: 새 기능마다 테스트 추가
2. **명확**: 테스트 이름이 동작을 설명
3. **격리**: 테스트는 독립적으로 동작
4. **빠름**: 각 테스트 <100ms

### 테스트 예시

```typescript
describe("mariadb-query", () => {
  // 성공 케이스
  it("should return array of users", async () => {
    const result = await mariadbQuery(
      "SELECT * FROM users WHERE id > ?",
      [0]
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // 실패 케이스
  it("should throw on invalid SQL", () => {
    expect(() => {
      mariadbQuery("INVALID SQL");
    }).toThrow();
  });

  // 엣지 케이스
  it("should handle empty result set", async () => {
    const result = await mariadbQuery(
      "SELECT * FROM users WHERE id > ?",
      [999999]
    );
    expect(result).toEqual([]);
  });
});
```

### 테스트 실행

```bash
# 전체 테스트
npm test

# 특정 테스트 파일
npm test -- stdlib.test.ts

# Watch 모드 (개발 중)
npm run test:watch

# 커버리지 확인
npm run test:coverage
```

---

## 🎓 학습 자료

### 코드 구조

```
freelang-v11/
├── src/
│   ├── lexer.ts              # 토큰화
│   ├── parser.ts             # AST 생성
│   ├── interpreter.ts        # 평가 엔진
│   ├── stdlib-*.ts           # 표준 라이브러리
│   ├── eval-*.ts             # 특수 형식 (인프라, 스타일)
│   └── __tests__/            # 테스트
├── docs/                      # 문서
├── self/examples/             # 예제
└── README.md, package.json
```

### 주요 파일

| 파일 | 용도 | 주의사항 |
|------|------|---------|
| `interpreter.ts` | 핵심 평가 엔진 | 대용량, 신중히 수정 |
| `eval-style-blocks.ts` | STYLE/THEME 처리 | 이 파일에서 스타일 추가 |
| `stdlib-*.ts` | 표준 라이브러리 | 새 함수는 여기에 추가 |
| `__tests__/*.test.ts` | 테스트 | 빠짐없이 커버 |

---

## 🚀 릴리스 프로세스

### 새 버전 릴리스 (메인테이너만)

```bash
# 1. 버전 업데이트
npm version minor  # 또는 patch/major

# 2. CHANGELOG 작성
# RELEASE_NOTES.md 업데이트

# 3. 태그 및 푸시
git push origin v11.1.0
git push origin --tags

# 4. GitHub Release 생성
gh release create v11.1.0 --notes "..."
```

---

## 📋 체크리스트

### 새 기능 제출 전

- [ ] `npm test` (637/637 PASS)
- [ ] `npm run build` (성공)
- [ ] 테스트 추가 (최소 3개 케이스)
- [ ] 문서 업데이트
- [ ] 커밋 메시지 명확
- [ ] 다른 기능에 영향 없음

### PR 작성 전

- [ ] Fork 최신 상태 (upstream 동기화)
- [ ] 브랜치 생성 (feature/* 형식)
- [ ] 모든 테스트 통과
- [ ] 코드 리뷰 요청

### 병합 전 (메인테이너)

- [ ] 코드 리뷰 승인
- [ ] 모든 테스트 PASS
- [ ] 충돌 해결
- [ ] CHANGELOG 업데이트

---

## 💬 문의 및 지원

### 도움이 필요할 때

1. **버그**: [Gogs Issues](https://gogs.dclub.kr/kim/freelang-v11/issues)
2. **질문**: [Discussions](https://gogs.dclub.kr/kim/freelang-v11/discussions)
3. **토론**: [커뮤니티 포럼](https://blog.dclub.kr)

### 응답 시간

- 🚨 **심각 버그**: 24시간
- 🔴 **일반 버그**: 3-5일
- 💡 **기능 제안**: 1-2주
- 📚 **문서**: 1-2주

---

## 📄 행동 강령

모든 기여자는 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)를 따릅니다.

요약:
- ✅ 서로 존중하기
- ✅ 건설적인 피드백
- ✅ 다양성 환영
- ❌ 괴롭힘 금지
- ❌ 차별 금지

---

## 🙏 감사합니다!

FreeLang 발전을 위한 여러분의 기여에 감사합니다!

**Happy Coding! 🚀**
