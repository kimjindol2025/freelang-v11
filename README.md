# FreeLang v11 — AI-Native Fullstack Language

> 한 언어로 서버, 웹UI, DB, 배포까지 완성하는 풀스택 프로그래밍 언어

[![Tests](https://img.shields.io/badge/tests-637%2F637%20PASS-brightgreen)](./src/__tests__/)
[![Gogs](https://img.shields.io/badge/repo-gogs.dclub.kr-blue)](https://gogs.dclub.kr/kim/freelang-v11)
[![Node](https://img.shields.io/badge/node-v25%2B-green)](https://nodejs.org/)

---

## ✨ 특징

### 🎯 진정한 풀스택
```
✅ 백엔드   — interpreter + 50개 stdlib 모듈
✅ 프론트엔드 — SSR/ISR/SSG 웹 프레임워크
✅ 데이터베이스 — MySQL/SQLite 직접 통합
✅ 배포      — Docker/K8s/Cloud CLI 선언형 블록
✅ 스타일     — CSS를 FL로 선언형 정의 (STYLE + THEME)
```

### 🚀 선언형 인프라
```lisp
;; Dockerfile 자동 생성
(dockerfile :from "node:20-slim" :workdir "/app" :cmd "npm start")

;; Kubernetes 매니페스트 자동 생성
(deployment :name "my-app" :image "my-app:latest" :replicas 3)

;; GitHub Actions CI/CD 자동 생성
(github-actions :name "CI" :on "push" :test "npm test")
```

### ☁️ 클라우드 통합
```lisp
;; AWS S3, Lambda, RDS
(aws-s3-upload "bucket" "key" data)
(aws-lambda-invoke "function" payload)

;; GCP Cloud Run
(gcp-run-deploy "service" "image" "region")

;; Azure Functions
(azure-function-invoke "function" data)
```

### 🎨 스타일 시스템
```lisp
;; 디자인 토큰 (THEME)
(theme default :tokens {
  :primary "#2563eb"
  :space-md "16px"
  :radius-md "8px"
})

;; 컴포넌트 스타일 (STYLE)
(style btn-primary
  :selector ".btn-primary"
  :rules {
    :bg "var(--primary)"
    :padding "var(--space-md)"
    :border-radius "var(--radius-md)"
  })
```

---

## 🚀 빠른 시작 (5분)

### 1️⃣ 설치
```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install
npm run build
```

### 2️⃣ 첫 프로그램
```bash
cat > hello.fl << 'EOF'
(println "Hello, FreeLang!")
EOF

node bootstrap.js run hello.fl
```

### 3️⃣ 웹 서버 실행
```bash
node bootstrap.js serve --port 3000
# → http://localhost:3000 접속
```

### 4️⃣ 배포 파일 자동 생성
```lisp
;; app.fl
(dockerfile :from "node:20-slim" :workdir "/app" :cmd "npm start")
(github-actions :name "CI" :on "push" :test "npm test")
```

---

## 📚 주요 기능

### 백엔드 (50개 stdlib)
```lisp
;; HTTP 클라이언트
(http-get "https://api.example.com")
(http-post "url" "{\"key\": \"value\"}")

;; 데이터베이스
(mariadb-query "SELECT * FROM users")
(db-exec "INSERT INTO ...")

;; 파일 시스템
(file-read "path/to/file.txt")
(file-write "path/to/file.txt" "content")

;; 시간 & 로깅
(time-now)
(log-info "message")
```

### 프론트엔드 (웹 프레임워크)
```lisp
;; 페이지 정의 (파일시스템 기반 라우팅)
[PAGE home
  :class "page-home"
  :render "<h1>Welcome</h1>"]

;; 레이아웃
[LAYOUT root
  :render "<html><body>{content}</body></html>"]

;; 동적 경로
[PAGE users/{id}
  :render "<p>User: {id}</p>"]
```

### 스타일 시스템
```lisp
;; CSS를 FL로 정의
(theme default :tokens {
  :primary "#2563eb"
  :text "#111827"
})

(style card :selector ".card" :rules {
  :bg "white"
  :padding "16px"
  :border-radius "8px"
})
```

### 배포 & 인프라
```lisp
;; Docker 배포
(dockerfile :from "node:20-slim" ...)
→ Dockerfile 자동 생성

;; Kubernetes 배포
(deployment :name "my-app" :replicas 3)
(service :name "my-app" :port 80)
(ingress :name "my-app" :host "example.com")
→ deployment.yaml, service.yaml, ingress.yaml 자동 생성

;; Cloud 배포
(aws-s3-upload "bucket" "key" data)
(gcp-run-deploy "service" "image" "region")
```

---

## 📖 문서

| 가이드 | 내용 |
|--------|------|
| [빠른 시작](./docs/QUICKSTART.md) | 5분 안에 시작하기 |
| [배포 가이드](./docs/DEPLOYMENT.md) | Docker/K8s/Cloud 배포 방법 |
| [스타일 시스템](./docs/STYLE_GUIDE.md) | STYLE + THEME 블록 사용법 |
| [API 레퍼런스](./docs/API.md) | 모든 stdlib 함수 목록 |

---

## 📊 현황

| 항목 | 상태 |
|------|------|
| **테스트** | ✅ 637/637 PASS |
| **빌드** | ✅ bootstrap.js 생성 완료 |
| **기능 완성도** | ✅ 95% |
| **문서화** | 🔄 진행 중 |
| **보안 감사** | 📋 계획 중 |

---

## 🗺️ 로드맵

```
✅ P1: 인프라 블록 (Dockerfile, K8s, CI/CD)
✅ P2: 클라우드 연동 (AWS/GCP/Azure CLI)
✅ P3: 스타일 시스템 (STYLE + THEME)
🔄 P4: 문서화 & 예제 확대 (이번주)
📋 P5: 성능 벤치 + 보안 감사 (2주 후)
📋 🎉 v1.0 글로벌 공개 (1개월 후)
```

---

## 🔧 개발 환경

- **Node.js**: v25+ 필수
- **언어**: TypeScript (내부 구현)
- **사용언어**: FreeLang (FL)

### 빌드 & 테스트
```bash
# 빌드
npm run build

# 테스트 실행
npm test

# 테스트 지켜보기
npm run test:watch

# 성능 벤치
npm run benchmark
```

---

## 📝 예제

### Hello World
```lisp
(println "Hello, FreeLang!")
```

### REST API 서버
```lisp
[ROUTE GET /users
  :handler (fn [] (mariadb-query "SELECT * FROM users"))]

[ROUTE POST /users
  :handler (fn [req]
    (mariadb-exec
      "INSERT INTO users (name) VALUES (?)"
      [(:name req)]))]
```

### 풀스택 앱 (DB + UI + 스타일)
```lisp
;; DB 쿼리
(define users (mariadb-query "SELECT * FROM users"))

;; 스타일
(theme default :tokens {:primary "#2563eb"})
(style user-card :selector ".user-card" :rules {:padding "16px"})

;; UI 렌더링
[PAGE users
  :class "users-page"
  :render (html-for [user users]
    "<div class=\"user-card\">{user.name}</div>")]
```

더 많은 예제는 [`self/examples/`](./self/examples/) 참고.

---

## 🤝 기여

버그 리포트나 기능 제안은 [Gogs Issues](https://gogs.dclub.kr/kim/freelang-v11/issues)에서.

---

## 📄 라이선스

MIT License — 자유롭게 사용, 수정, 배포 가능.

---

**시작하기**: [빠른 시작 가이드](./docs/QUICKSTART.md) 참고  
**배포하기**: [배포 가이드](./docs/DEPLOYMENT.md) 참고  
**스타일 지정**: [스타일 시스템 가이드](./docs/STYLE_GUIDE.md) 참고
