# 빠른 시작 (5분)

> FreeLang v11을 5분 안에 시작하는 가이드

---

## Step 1️⃣: 설치 (1분)

```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install
npm run build
```

**확인**: `dist/` 디렉토리와 `bootstrap.js`가 생성되어야 합니다.

---

## Step 2️⃣: 첫 번째 FL 파일 (1분)

```bash
cat > hello.fl << 'EOF'
(println "✨ FreeLang v11에 오신 것을 환영합니다!")
(println "한 언어로 풀스택 개발을 시작하세요.")
EOF
```

실행:
```bash
node bootstrap.js run hello.fl
```

**예상 출력**:
```
✨ FreeLang v11에 오신 것을 환영합니다!
한 언어로 풀스택 개발을 시작하세요.
```

---

## Step 3️⃣: 웹 서버 실행 (2분)

```bash
cat > app.fl << 'EOF'
;; 간단한 HTTP 서버
(route-get "/"
  (fn [req]
    (http-response
      :status 200
      :body "<h1>🚀 FreeLang v11!</h1><p>서버가 정상 실행 중입니다.</p>"
      :headers {:content-type "text/html"})))

(println "✅ 서버 시작: http://localhost:3000")
EOF
```

실행:
```bash
node bootstrap.js serve --port 3000
```

**브라우저에서 접속**:
```
http://localhost:3000
```

---

## Step 4️⃣: 배포 파일 자동 생성 (1분)

FreeLang은 인프라 블록을 선언형으로 정의하면 자동으로 배포 파일을 생성합니다.

```bash
cat > deploy.fl << 'EOF'
;; Dockerfile 자동 생성
(dockerfile
  :from "node:20-slim"
  :workdir "/app"
  :copy "*.fl" "."
  :copy "package.json" "."
  :run "npm install"
  :cmd "node bootstrap.js serve --port 3000")

;; Kubernetes 배포 매니페스트 자동 생성
(deployment
  :name "freelang-app"
  :image "freelang-app:latest"
  :replicas 3
  :port 3000)

(println "✅ Dockerfile, deployment.yaml 생성됨")
EOF
```

실행:
```bash
node bootstrap.js run deploy.fl
```

**생성 파일**:
- `Dockerfile` — 컨테이너 이미지 빌드용
- `deployment.yaml` — Kubernetes 배포용

---

## 🎯 다음 단계

- **배포 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker, Kubernetes, AWS/GCP/Azure
- **스타일 시스템**: [STYLE_GUIDE.md](./STYLE_GUIDE.md) — STYLE + THEME 블록 사용법
- **API 레퍼런스**: [API.md](./API.md) — 모든 stdlib 함수 목록
- **예제**: [examples/](../self/examples/) — 더 많은 코드 샘플

---

## ✅ 요약

| 단계 | 시간 | 내용 |
|------|------|------|
| 1 | 1분 | npm install + npm run build |
| 2 | 1분 | hello.fl 작성 및 실행 |
| 3 | 2분 | 웹 서버 실행 |
| 4 | 1분 | 배포 파일 자동 생성 |

**총 5분 안에 FreeLang v11의 모든 핵심 기능을 경험할 수 있습니다.**

---

## 🆘 문제 해결

### `npm install` 실패
```bash
# Node.js v25+ 필요
node --version

# npm 캐시 초기화
npm cache clean --force
npm install
```

### `bootstrap.js` 찾을 수 없음
```bash
# 빌드 확인
npm run build
ls -la bootstrap.js
```

### 포트 3000 이미 사용 중
```bash
# 다른 포트 사용
node bootstrap.js serve --port 8000
```

---

## 💡 더 알아보기

- **CLI 명령어**: `node bootstrap.js --help`
- **테스트 실행**: `npm test`
- **성능 측정**: `npm run benchmark`
