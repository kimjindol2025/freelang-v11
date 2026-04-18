# FreeLang v11 프로젝트 템플릿

> **v11 기반으로 새 프로젝트를 시작하는 가이드**

---

## 🚀 3단계 프로젝트 시작

### 1단계: 폴더 생성 및 설정

```bash
# 프로젝트 폴더 생성
mkdir my-project
cd my-project

# v11 bootstrap.js 복사
cp /data/data/com.termux/files/home/freelang-v11/bootstrap.js .

# package.json 생성
cat > package.json << 'EOF'
{
  "name": "my-project",
  "version": "1.0.0",
  "description": "v11 기반 프로젝트",
  "main": "bootstrap.js",
  "scripts": {
    "dev": "node bootstrap.js serve app/",
    "run": "node bootstrap.js run",
    "test": "node bootstrap.js test"
  }
}
EOF
```

### 2단계: 앱 구조 생성

```bash
# 폴더 생성
mkdir -p app
mkdir -p src
mkdir -p tests

# 홈 페이지 생성
cat > app/page.fl << 'EOF'
[PAGE :path "/"
  :name "Home"
  :render "<h1>Welcome to v11</h1><p>Your project starts here</p>"]
EOF

# About 페이지
mkdir app/about
cat > app/about/page.fl << 'EOF'
[PAGE :path "/about"
  :name "About"
  :render "<h1>About Page</h1>"]
EOF
```

### 3단계: 개발 서버 시작

```bash
npm run dev

# 브라우저 열기
http://localhost:43011/
```

---

## 📁 프로젝트 폴더 구조 (권장)

```
my-project/
├── bootstrap.js           # v11 런타임 (복사)
├── package.json           # 프로젝트 설정
├── README.md              # 프로젝트 설명
│
├── app/                   # 📄 프론트엔드 (파일시스템 라우팅)
│   ├── page.fl            # 홈 페이지 (/)
│   ├── layout.fl          # 루트 레이아웃 (선택사항)
│   ├── api/               # API 라우트 (선택사항)
│   │   └── data.fl        # GET /api/data
│   ├── about/
│   │   └── page.fl        # GET /about
│   └── [id]/
│       └── page.fl        # GET /:id (동적 라우트)
│
├── src/                   # 🔧 백엔드 로직
│   ├── main.fl            # 진입점
│   ├── handlers.fl        # 요청 핸들러
│   ├── db.fl              # 데이터베이스 연동
│   └── utils.fl           # 유틸리티
│
├── tests/                 # 🧪 테스트
│   ├── pages.test.fl      # 페이지 테스트
│   └── api.test.fl        # API 테스트
│
├── data/                  # 💾 데이터 파일
│   └── seed.sql           # 초기 데이터
│
└── docs/                  # 📚 문서
    ├── API.md             # API 명세
    └── DEPLOYMENT.md      # 배포 가이드
```

---

## 💡 v11 개발 규칙

### 1. 언어 선택

| 계층 | 언어 | 상황 |
|------|------|------|
| **백엔드** | v11 (.fl) | 모든 비즈니스 로직 |
| **프론트엔드** | v11 (.fl) | 모든 UI/페이지 |
| **테스트** | v11 (.fl) | 모든 테스트 |
| **런타임** | TypeScript | bootstrap.js만 (수정 금지) |

### 2. 포트 할당

```
기본 포트: 43011
환경 변수: FL_PORT=3000 으로 오버라이드 가능

node bootstrap.js serve app/ --port 3000
```

### 3. 데이터베이스

```lisp
; PostgreSQL 예시
(pg_query "SELECT * FROM users WHERE id = $1" [42])

; SQLite 예시
(sqlite_query "SELECT * FROM users WHERE id = ?" [42])

; 메모리 데이터 (개발 전용)
(var users [{:id 1 :name "Alice"} {:id 2 :name "Bob"}])
```

### 4. AI 블록 활용

```lisp
; 추론 (Chain-of-Thought)
[COT :step "요구사항 분석" (analyze-req $req)
     :step "데이터 준비" (fetch-data $req)
     :conclude (fn [$steps] (last $steps))]

; 에이전트
[AGENT :goal "사용자 문제 해결"
        :steps [...]]

; 자기 진화
[EVOLVE :population $solutions
        :fitness score-fn
        :generations 10]
```

### 5. 파일 네이밍

```
페이지:    app/*/page.fl
레이아웃:  app/*/layout.fl
API:      app/api/*/[method].fl
로직:     src/*.fl
테스트:   tests/*.test.fl
```

---

## 🔄 개발 워크플로우

### 1단계: 기능 개발

```bash
# 페이지 추가
cat > app/products/page.fl << 'EOF'
[PAGE :path "/products"
  :name "Products"
  :render (fn []
    (str "<h1>Products</h1>"
         (map (fn [p] (str "<div>" (get p :name) "</div>"))
              (fetch-products))))]
EOF
```

### 2단계: 백엔드 로직

```bash
# src/handlers.fl 작성
cat > src/handlers.fl << 'EOF'
(defn fetch-products []
  (pg_query "SELECT * FROM products ORDER BY created_at DESC" []))

(defn get-product [id]
  (pg_one "SELECT * FROM products WHERE id = $1" [id]))
EOF
```

### 3단계: 테스트

```bash
cat > tests/api.test.fl << 'EOF'
(test "fetch-products returns list"
  (var products (fetch-products))
  (assert (list? products)))
EOF

npm run test
```

### 4단계: 커밋 & 푸시

```bash
git add .
git commit -m "feat: 상품 페이지 추가"
git push origin master
```

---

## 🛠️ 명령어 (모든 프로젝트 공통)

```bash
# 개발 서버 시작
npm run dev

# 파일 직접 실행
node bootstrap.js run src/main.fl

# REPL 시작
node bootstrap.js repl

# 테스트 실행
node bootstrap.js test tests/

# 컴파일 (필요시)
npm run build
```

---

## 📋 프로젝트 시작 체크리스트

- [ ] 프로젝트 폴더 생성
- [ ] bootstrap.js 복사
- [ ] package.json 생성
- [ ] app/ 폴더 생성
- [ ] 홈 페이지 (app/page.fl) 작성
- [ ] 개발 서버 실행 (`npm run dev`)
- [ ] 브라우저에서 확인
- [ ] git 저장소 초기화
- [ ] README.md 작성
- [ ] 첫 커밋

---

## 🚀 빠른 템플릿 (복사-붙여넣기)

### 최소 구성 (Hello World)

```bash
# 폴더 생성
mkdir my-app && cd my-app

# bootstrap.js 복사
cp /data/data/com.termux/files/home/freelang-v11/bootstrap.js .

# 페이지 생성
mkdir app
echo '[PAGE :path "/" :name "Home" :render "<h1>Hello v11</h1>"]' > app/page.fl

# 서버 시작
node bootstrap.js serve app/
```

### 완전 구성 (생산 레벨)

```bash
# 프로젝트 초기화
mkdir my-app && cd my-app
cp /data/data/com.termux/files/home/freelang-v11/bootstrap.js .

# 폴더 구조
mkdir -p app/{api,about} src tests data docs

# 파일 생성
cat > package.json << 'EOF'
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "node bootstrap.js serve app/",
    "test": "node bootstrap.js test tests/"
  }
}
EOF

cat > README.md << 'EOF'
# My App (v11)

[프로젝트 설명]

## 개발

\`\`\`bash
npm run dev
\`\`\`

## 테스트

\`\`\`bash
npm test
\`\`\`
EOF

# 페이지
echo '[PAGE :path "/" :name "Home" :render "<h1>Welcome</h1>"]' > app/page.fl
echo '[PAGE :path "/about" :name "About" :render "<h1>About</h1>"]' > app/about/page.fl

# Git 초기화
git init
git add .
git commit -m "Initial commit (v11)"

# 개발 시작
npm run dev
```

---

## 🎯 v10과의 차이 (주의)

| 항목 | v10 | v11 |
|------|----|----|
| **포트** | 43000 | 43011 |
| **언어** | v10 (.fl) | v11 (.fl) |
| **프론트** | v9 별도 | v11 통합 |
| **런타임** | TypeScript | bootstrap.js |
| **의존성** | 0 | 0 |

### v10에서 v11로 마이그레이션

```
v10: backend/*.fl + frontend/*.fl → 2개 언어
v11: app/*.fl + src/*.fl → 1개 언어 (v11)

bootstrap.js 교체만으로 마이그레이션 가능
```

---

## 📞 지원

- **v11 문서**: `/data/data/com.termux/files/home/freelang-v11/CLAUDE.md`
- **런타임 버그**: `node bootstrap.js repl` 로 디버깅
- **페이지 라우팅**: `app/` 폴더 구조 확인

---

**Happy Coding with v11!** 🚀
