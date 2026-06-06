# FreeLang CLI 도구 설계

## 📋 목표

`freelang` 커맨드로 FreeLang v11 프로젝트를 관리하는 완전한 개발 경험(DX) 제공.

```bash
freelang new myapp          # 프로젝트 생성
cd myapp
freelang dev                # 개발 서버 시작 (port 3000)
freelang build              # 프로덕션 빌드
freelang test               # 테스트 실행
freelang deploy             # 배포
freelang migrate            # 스키마 마이그레이션
```

---

## 🏗️ 구조

```
freelang-cli/
├── bin/
│   └── freelang             # 메인 진입점
├── src/
│   ├── commands/
│   │   ├── new.ts          # 프로젝트 생성
│   │   ├── build.ts        # 빌드
│   │   ├── dev.ts          # 개발 서버
│   │   ├── deploy.ts       # 배포
│   │   ├── test.ts         # 테스트
│   │   └── migrate.ts      # 마이그레이션
│   ├── utils/
│   │   ├── config.ts       # 설정 로드
│   │   ├── template.ts     # 프로젝트 템플릿
│   │   └── logger.ts       # 로깅
│   └── index.ts            # 진입점
└── templates/
    ├── express-api/        # REST API 템플릿
    ├── websocket-app/      # WebSocket 템플릿
    └── ai-agent/           # AI 에이전트 템플릿
```

---

## 📦 커맨드

### 1. freelang new

```bash
freelang new myapp              # REST API 프로젝트
freelang new myapp --websocket  # WebSocket 프로젝트
freelang new myapp --agent      # AI 에이전트 프로젝트
```

생성 파일:
```
myapp/
├── freelang.config.fl  # 프로젝트 설정
├── src/
│   ├── app.fl          # 메인 앱
│   ├── routes.fl       # 라우트 정의
│   ├── handlers.fl     # 요청 핸들러
│   ├── models.fl       # 데이터 모델
│   └── db.fl           # 데이터베이스
├── tests/
│   └── test.fl         # 테스트
├── .env                # 환경 변수
├── .gitignore
└── README.md
```

### 2. freelang build

```bash
freelang build              # src/*.fl → dist/app.js
freelang build --release    # 최적화된 빌드
freelang build --watch      # 파일 변경 감지
```

출력:
```
dist/
├── app.js           # 번들링된 JS
├── manifest.json    # 빌드 메타
└── sources.map      # 소스맵
```

### 3. freelang dev

```bash
freelang dev              # port 3000에서 개발 서버 시작
freelang dev --port 8000  # 커스텀 포트
freelang dev --inspect    # 디버거 활성화
```

기능:
- 🔄 Hot reload (파일 변경 감지)
- 📊 실시간 로깅
- 🐛 에러 스택 추적
- 🔗 CORS 자동 활성화

### 4. freelang test

```bash
freelang test                # 모든 테스트 실행
freelang test tests/auth     # 특정 파일만
freelang test --watch        # 감시 모드
freelang test --coverage     # 커버리지 리포트
```

출력:
```
✅ test-auth.fl          32 PASS (145ms)
✅ test-cache.fl         18 PASS (89ms)
❌ test-websocket.fl     1 FAIL (203ms)
────────────────────────
TOTAL: 49 PASS, 1 FAIL
```

### 5. freelang deploy

```bash
freelang deploy                # gogs에 푸시 + 배포
freelang deploy --no-push      # 배포만
freelang deploy --dry-run      # 시뮬레이션
freelang deploy --to staging   # staging 환경
```

배포 프로세스:
1. 빌드 (`freelang build --release`)
2. 테스트 (`freelang test`)
3. git 커밋/푸시
4. 원격 서버 업데이트
5. 헬스체크

### 6. freelang migrate

```bash
freelang migrate              # 마이그레이션 실행
freelang migrate --create     # 마이그레이션 파일 생성
freelang migrate --rollback   # 롤백
freelang migrate --status     # 상태 확인
```

마이그레이션 파일:
```
db/migrations/
├── 001_create_users.fl
├── 002_add_posts.fl
└── 003_create_index.fl
```

---

## ⚙️ 설정 파일 (freelang.config.fl)

```lisp
{
  :name "myapp"
  :version "1.0.0"
  :description "My FreeLang App"
  
  ;; 빌드
  :build {
    :entry "src/app.fl"
    :output "dist/app.js"
    :optimize true
  }
  
  ;; 개발 서버
  :dev {
    :port 3000
    :host "localhost"
    :watch ["src" "tests"]
  }
  
  ;; 배포
  :deploy {
    :gogs-repo "gogs.dclub.kr/kim/myapp"
    :ssh-host "deploy.example.com"
    :ssh-port 22
    :ssh-user "deploy"
  }
  
  ;; 데이터베이스
  :database {
    :type "sqlite"
    :path "./db.db"
    :migrations "db/migrations"
  }
  
  ;; 환경 변수
  :env {
    :development {
      :log-level "debug"
      :cache-ttl 60000
    }
    :production {
      :log-level "info"
      :cache-ttl 3600000
    }
  }
}
```

---

## 📝 프로젝트 템플릿

### 템플릿 1: REST API (기본)

```
freelang new myapi
```

특징:
- Express.fl 기반
- CRUD API 예제
- JWT 인증
- 에러 처리

### 템플릿 2: WebSocket 앱

```
freelang new mychat --websocket
```

특징:
- 실시간 채팅
- 사용자 관리
- 메시지 히스토리
- 온라인 상태 추적

### 템플릿 3: AI 에이전트

```
freelang new myagent --agent
```

특징:
- 에이전트 정의
- 도구 바인딩
- CoT 패턴
- 메모리 관리

---

## 🔧 실행 방식

### 로컬 개발

```bash
# 프로젝트 생성
freelang new myapp
cd myapp

# 개발 서버 시작
freelang dev

# 다른 터미널에서 테스트
curl http://localhost:3000/api/users
```

### 빌드 & 실행

```bash
# 빌드
freelang build

# 빌드된 JS 직접 실행
node dist/app.js

# 또는 다시 FreeLang으로 실행
freelang run dist/app.js
```

### 배포

```bash
# 설정 확인
freelang deploy --dry-run

# 배포 실행
freelang deploy

# 또는 수동 배포
git push
ssh deploy@example.com "cd /app && freelang deploy"
```

---

## 📊 개발 워크플로우

```
1. 프로젝트 생성
   freelang new myapp

2. 개발 시작
   cd myapp
   freelang dev

3. 코드 작성
   src/app.fl 수정
   (자동 hot reload)

4. 테스트 작성
   tests/test.fl 작성
   freelang test

5. 빌드 & 배포
   freelang build
   freelang deploy
```

---

## 🚀 우선순위

### Phase 1 (1주)
- [x] CLI 기본 구조
- [x] `freelang new` 구현
- [x] `freelang build` 구현
- [x] 기본 템플릿

### Phase 2 (1주)
- [ ] `freelang dev` (hot reload)
- [ ] `freelang test`
- [ ] 설정 파일 파싱

### Phase 3 (1주)
- [ ] `freelang deploy`
- [ ] `freelang migrate`
- [ ] gogs 연동

### Phase 4 (1주)
- [ ] 성능 최적화
- [ ] 문서화
- [ ] npm 배포

---

## 💡 이점

✅ **DX 향상** — 수동 빌드/배포 제거
✅ **프로젝트 관리** — 템플릿과 설정의 일관성
✅ **CI/CD 통합** — 배포 자동화
✅ **개발 속도** — Hot reload로 즉시 반영
✅ **테스트 자동화** — 배포 전 자동 테스트

---

## 📌 다음 단계

CLI 도구 개발 시작:
1. `freelang-cli` 프로젝트 생성 (Node.js CLI)
2. 각 커맨드 구현
3. 프로젝트 템플릿 작성
4. npm 패키지로 배포

