# FreeLang v9 공식 홈페이지

이 폴더에는 FreeLang v9의 공식 홈페이지가 포함되어 있습니다. **v9로 만든 v9의 홈페이지**입니다.

## 🎯 특징

- **순수 v9 코드**: FLNext 웹 프레임워크로 작성
- **의존성 제로**: Express, React 등 외부 라이브러리 없음
- **자기기술적**: 홈페이지 자체가 v9의 강력함을 보여줌
- **최소주의**: 핵심만 간단하게 구현

---

## 🚀 실행 방법

### 방법 1: v9 CLI (설치 필요)
```bash
npm install -g freelang-v9
cd homepage
v9 main.fl
```

### 방법 2: 소스 코드에서 직접
```bash
cd freelang-v9
npx ts-node src/cli.ts homepage/main.fl
```

### 브라우저에서 확인
```
http://localhost:3000
```

---

## 📂 파일 구조

```
homepage/
├── main.fl               # 메인 홈페이지 (순수 v9)
└── README.md             # 이 파일
```

---

## 🏗️ 구조 설명

### 데이터 섹션
```lisp
(def project-info {...})    ; 프로젝트 정보
(def features [...])         ; 기능 목록
(def stats [...])            ; 통계
(def examples [...])         ; 코드 예제
```

### 렌더링 함수
```lisp
(defn render-header [...])   ; HTML 헤더 생성
(defn render-css [...])      ; CSS 스타일 생성
(defn render-features [...]) ; 기능 영역 렌더링
...
```

### 라우트
```lisp
GET /              ; 홈페이지
GET /api/info      ; API 정보
GET /health        ; 헬스 체크
```

---

## 💻 기술 스택

| 항목 | 사용 기술 |
|------|---------|
| **언어** | FreeLang v9 |
| **프레임워크** | FLNext |
| **스타일링** | 인라인 CSS |
| **데이터** | Lisp 맵/벡터 |
| **포트** | 3000 |

---

## 🔧 커스터마이징

### 데이터 수정
```lisp
(def project-info {
  :name "..."
  :tagline "..."
  ...
})
```

### 새로운 섹션 추가
1. 데이터 추가 (예: `(def new-section [...])`)
2. 렌더링 함수 작성 (예: `(defn render-new-section [...])`)
3. 라우트에 HTML 추가

### 스타일 수정
`render-css` 함수의 CSS 문자열 수정

---

## 📊 페이지 구성

### Header
- 프로젝트명, 태그라인
- 문서/GitHub 링크 버튼

### Features Section
6개의 핵심 기능 카드 표시

### Stats Section
프로젝트 통계 (Phase, Tests, Stdlib 등)

### Examples Section
3개의 코드 예제 표시

### Getting Started Section
빠른 설치 명령어

### Footer
프로젝트 링크 및 정보

---

## 🎨 디자인 철학

- **간결함**: 최소한의 CSS로 깔끔한 디자인
- **반응형**: 모든 기기에서 작동
- **성능**: HTML 문자열 직렬화로 빠른 로딩
- **접근성**: 시맨틱 HTML 구조

---

## 📈 향후 개선

- [ ] 다국어 지원 (영어, 중국어)
- [ ] 대시보드 (실시간 통계)
- [ ] 블로그 통합
- [ ] 커뮤니티 페이지
- [ ] 튜토리얼 페이지
- [ ] 다운로드 통계

---

## 🔗 관련 링크

- [공식 문서](../docs/)
- [GitHub 저장소](https://github.com/kimjindol2025/freelang-v9)
- [npm 패키지](https://www.npmjs.com/package/freelang-v9)

---

## 🤖 참고

이 홈페이지는 FreeLang v9의 강력함을 보여주기 위해 의도적으로 v9로만 작성되었습니다.
Express, React, Next.js 같은 외부 라이브러리 없이 순수 v9 코드로 완전한 웹 애플리케이션을 만들 수 있습니다.

---

[메인 저장소로 돌아가기](../)
