# GitHub Pages 설정 가이드

## 자동 배포 (GitHub Actions)

GitHub Pages는 GitHub Actions를 통해 자동으로 배포됩니다.

- **워크플로우**: `.github/workflows/pages.yml`
- **트리거**: `docs/` 폴더 변경 또는 수동 실행
- **빌드**: Jekyll을 사용한 정적 사이트 생성
- **배포**: GitHub Pages에 자동 배포

---

## 수동 설정 (GitHub UI)

만약 GitHub Pages가 활성화되지 않았다면:

### Step 1: Repository Settings 열기
1. GitHub 저장소 페이지로 이동
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 선택

### Step 2: GitHub Pages 활성화
1. **Source** 섹션에서 **Deploy from a branch** 선택
2. **Branch**에서 `master` 또는 `main` 선택
3. **Folder**에서 `/docs` 선택
4. **Save** 클릭

### Step 3: 확인
- 수 초에서 수 분 내에 GitHub Pages가 활성화됨
- URL: `https://kimjindol2025.github.io/freelang-v9`

---

## 문서 구조

```
docs/
├── index.md                      # 메인 페이지
├── _config.yml                   # Jekyll 설정
├── guide/
│   ├── basics.md                # 기초 문법
│   ├── ai-blocks.md             # AI 블록 가이드
│   └── frameworks.md            # 프레임워크 사용법
├── api/
│   └── stdlib.md                # 표준 라이브러리 API
└── examples/
    ├── index.md                 # 예제 목록
    └── todo-app.md              # TODO 앱 예제
```

---

## 문서 추가 방법

### 새로운 가이드 페이지 추가
```
docs/guide/새-페이지.md
```

내용 템플릿:
```markdown
# 제목

## 섹션 1
내용

## 섹션 2
내용

---

## 다음 단계
[다른 페이지](./다른-페이지.md)
```

### 새로운 예제 추가
```
docs/examples/새-예제.md
```

### API 문서 확장
```
docs/api/새-모듈.md
```

---

## 로컬에서 테스트

### Jekyll 설치
```bash
gem install bundler jekyll
```

### 로컬 서버 실행
```bash
cd docs
jekyll serve
```

### 브라우저에서 확인
```
http://localhost:4000/freelang-v9
```

---

## 배포 상태 확인

GitHub Actions 워크플로우 상태:
1. GitHub 저장소 → **Actions** 탭
2. **GitHub Pages** 워크플로우 확인
3. 최신 실행 상태 확인

---

## 참고

- **테마**: Minima (GitHub Pages 기본 테마)
- **마크다운**: Kramdown (Jekyll 기본)
- **자동 빌드**: 각 푸시 시 자동 실행
- **배포 시간**: 보통 1-2분

---

[메인 페이지로](./index.md)
