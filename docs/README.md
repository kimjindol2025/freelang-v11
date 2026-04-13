# FreeLang v9 공식 문서

이 폴더는 GitHub Pages를 통해 자동으로 웹사이트로 빌드되는 FreeLang v9 공식 문서입니다.

## 📚 문서 구조

### [메인 페이지](./index.md) - 프로젝트 개요
- FreeLang v9 소개
- 핵심 기능 설명
- 빠른 시작 가이드
- 프로덕션 준비 상태

### [가이드](./guide/) - 단계별 학습
- **[기초](./guide/basics.md)** — S-expression 문법, 함수, 제어 흐름
- **[AI 블록](./guide/ai-blocks.md)** — COT, TOT, REFLECT, HYPOTHESIS 등
- **[프레임워크](./guide/frameworks.md)** — FLNext, v9-data, 마이크로서비스

### [API 레퍼런스](./api/) - 기술 문서
- **[stdlib](./api/stdlib.md)** — 30개 표준 모듈 설명

### [예제](./examples/) - 실전 코드
- **[TODO 앱](./examples/todo-app.md)** — 기본 CRUD 앱
- 더 많은 예제 추가 예정

### [설정 가이드](./SETUP.md) - 개발 환경
- GitHub Pages 활성화 방법
- 로컬 테스트 방법
- 문서 추가 방법

---

## 🚀 빠른 시작

### 읽기 순서 (권장)
1. **[메인 페이지](./index.md)** - 프로젝트 이해
2. **[기초](./guide/basics.md)** - 언어 학습
3. **[AI 블록](./guide/ai-blocks.md)** - 고급 기능
4. **[프레임워크](./guide/frameworks.md)** - 실무 개발
5. **[예제](./examples/)** - 코드 작성

### 빠른 설치
```bash
npm install -g freelang-v9
v9 repl
```

---

## 📝 문서 기여

새로운 문서를 추가하려면:

1. **Markdown 파일 생성**
   ```
   docs/guide/새-주제.md
   docs/examples/새-예제.md
   ```

2. **마크다운 템플릿 사용**
   ```markdown
   # 제목
   
   ## 섹션
   내용...
   
   ---
   
   ## 다음 단계
   [다른 페이지](../api/stdlib.md)
   ```

3. **Git에 커밋**
   ```bash
   git add docs/
   git commit -m "docs: 새 문서 추가"
   git push github master
   ```

4. **자동 배포**
   - GitHub Actions가 자동으로 빌드 및 배포
   - 1-2분 내에 웹사이트 업데이트

---

## 🔧 로컬 개발

### 요구사항
- Ruby 2.7+
- Bundler

### 설정
```bash
cd docs
bundle install
```

### 로컬 서버 실행
```bash
bundle exec jekyll serve
```

### 브라우저에서 확인
```
http://localhost:4000/freelang-v9
```

---

## 📂 파일 구조

```
docs/
├── index.md              # 메인 페이지
├── _config.yml           # Jekyll 설정
├── README.md             # 이 파일
├── SETUP.md              # 설정 가이드
├── guide/
│   ├── basics.md         # 기초 문법
│   ├── ai-blocks.md      # AI 블록
│   └── frameworks.md     # 프레임워크
├── api/
│   └── stdlib.md         # 표준 라이브러리
└── examples/
    ├── index.md          # 예제 목록
    └── todo-app.md       # TODO 앱
```

---

## 🌐 GitHub Pages

- **URL**: https://kimjindol2025.github.io/freelang-v9
- **빌드 시스템**: Jekyll
- **테마**: Minima
- **자동 배포**: `.github/workflows/pages.yml`

---

## 📖 마크다운 팁

### 제목
```markdown
# H1
## H2
### H3
```

### 코드
```markdown
\`\`\`lisp
(print "Hello, FreeLang!")
\`\`\`
```

### 링크
```markdown
[텍스트](../path/to/page.md)
[외부 링크](https://example.com)
```

### 표
```markdown
| 항목 | 상태 |
|------|------|
| 항목1 | ✅ |
| 항목2 | 🚀 |
```

---

## ✅ 문서 작성 체크리스트

- [ ] 제목과 소개 추가
- [ ] 섹션 구분 (##, ###)
- [ ] 코드 예제 포함 (lisp, bash)
- [ ] 다음 단계 링크 추가
- [ ] 메인 페이지에서 링크됨
- [ ] 로컬에서 테스트됨

---

## 🎯 다음 목표

- [ ] 데이터 분석 가이드 추가
- [ ] 마이크로서비스 튜토리얼 추가
- [ ] API 상세 문서 작성
- [ ] 비디오 튜토리얼 추가
- [ ] 커뮤니티 블로그 연동

---

[메인 페이지로 돌아가기](./index.md) | [GitHub 저장소](https://github.com/kimjindol2025/freelang-v9)
