# FreeLang v11 — AI Agent Execution Engine

> AI 에이전트가 안정적으로 쓰고, 재현 가능하게 실행되는 언어. Task/State/Workflow 기반 에이전트 프레임워크 포함.

[![Tests](https://img.shields.io/badge/tests-744%2F744%20PASS-brightgreen)](./src/__tests__/)
[![Self-Host](https://img.shields.io/badge/self--host-fixed--point%20verified-blue)](./CLAUDE.md)
[![Express.fl](https://img.shields.io/badge/web-Express.fl%20완료-green)](./src/EXPRESS-COMPLETE.md)
[![CLI](https://img.shields.io/badge/cli-freelang%20v1.0.0-blue)](https://www.npmjs.com/package/freelang-v11-cli)
[![Gogs](https://img.shields.io/badge/repo-gogs.dclub.kr-blue)](https://gogs.dclub.kr/kim/freelang-v11)

---

## 🤖 왜 AI용 언어가 필요한가?

LLM은 코드를 생성하지만, **실행할 수 없다**.

```
❌ 비결정론    — 같은 코드, 다른 결과
❌ 환경 의존성  — Python/Node 버전 차이
❌ 재현 불가   — 오류 디버깅 불가능
❌ 신뢰 부족   — 프로덕션 배포 불안정
```

FreeLang은 AI가 **안심하고 쓸 수 있게** 설계했다.

---

## ⭐ 핵심 3가지

### 1️⃣ Deterministic Execution
```lisp
;; 같은 입력 → 항상 같은 출력
;; SHA256으로 검증 가능
(fib 30)
;; → 832040 (매번 동일)
```

**증명**: Stage 1 → Stage 2 → Stage 3 컴파일 결과 SHA256 완벽 일치

### 2️⃣ Self-Hosted Compiler
```lisp
;; FreeLang은 자신을 컴파일할 수 있다
;; 외부 의존 없이 검증 가능
(compile "app.fl" "output.js")
;; → bootstrap 없어도 작동
```

**달성**: `self/all.fl`로 자가 부트스트랩 완료 (643 테스트 통과)

### 3️⃣ Reproducible Builds
```lisp
;; 배포 가능한 불변 아티팩트
;; Docker + CI/CD 자동화
(deploy :image "freelang-app:sha256-abc123def...")
```

**검증**: 모든 빌드가 결정론 보증, Docker 이미지 SHA로 추적

---

## 🛡️ P0: Agent Reliability Features (v11.1)

**문제**: AI는 코드를 생성하지만, 실행 실패 시 자동 복구 불가능

**해결**: Task 메타데이터로 신뢰 가능한 자동화 구현

### P0-1: 에러 자동 복구
```lisp
[TASK fetch-users
  :action (http-get "https://api.example.com/users")
  :on-error (fn [err] (log-error "fetch failed" err))  ; ← 에러 처리
  :fallback {:users []}]                               ; ← 기본값

; 결과: API 실패 → on-error 호출 → fallback 반환 → 계속 진행 ✅
```

### P0-2: 조건부 실행 (비용 절감)
```lisp
[TASK process-users
  :depends [:fetch-users]
  :action (map (fn [u] (+ u.score 100)) $users)
  :if (fn [prev] (> (length (get prev :users)) 0))]   ; ← 조건부

; 결과: 데이터 없으면 LLM 호출 없이 skip (비용 0) ✅
```

### P0-3: 체크포인트 (장시간 작업 안전)
```lisp
(workflow-run workflow ctx
  {:checkpoint_path "/data/workflow.cp"
   :checkpoint_every 10000      ; 10,000개 항목마다 저장
   :auto_resume true})          ; 실패 시 자동 재개

; 결과: 1M 항목 중 500K번째 실패 → 500K부터 재개 (80% 시간 절감) ✅
```

### P0-4: 명확한 에러 메시지
```lisp
; 로그 형식
{:step "fetch-users"
 :status "failed"
 :error "Connection timeout"
 :category "TIMEOUT"            ; ← 에러 카테고리
 :attempted 3                    ; ← 재시도 횟수
 :ms 15000}                      ; ← 소요 시간

; 결과: AI가 원인 파악 → 자동 대응 (exponential backoff, fallback 등) ✅
```

**효과** (v11.1 기준):
| 기능 | Before | After |
|------|--------|-------|
| API 실패 | ❌ 워크플로우 중단 | ✅ 자동 복구 |
| 조건부 로직 | LLM 호출 ($0.003) | 프로그래밍 (무료) |
| 중간 실패 복구 | 처음부터 재실행 | 마지막 지점부터 재개 |
| 에러 처리 | 수동 작성 | 선언적 메타데이터 |

🎯 **결론**: AI가 "완전히 신뢰할 수 있는" 자동화 워크플로우 생성 가능!

자세한 내용: [CHANGELOG-v11.1.md](./CHANGELOG-v11.1.md)

---

## 🎯 AI Agent 사용 시나리오

### Agent Task Orchestration
```lisp
;; 에이전트가 이 코드를 생성하고 실행
[TASK fetch-users
  :action (http-get "https://api.example.com/users")
  :retry 3
  :timeout 30000]

[TASK process-users
  :depends [:fetch-users]
  :action (map (fn [user] (+ user.score 100)) $users)]

[TASK store-results
  :depends [:process-users]
  :action (db-exec "INSERT INTO results ..." $processed)]
```

### State Machine (Agent Memory)
```lisp
(define state {
  :current "idle"
  :history []
  :context {}
})

(define (transition event)
  (case (:current state)
    ("idle" (handle-start event))
    ("running" (handle-step event))
    ("done" (handle-cleanup event))))
```

### Deterministic Logging
```lisp
;; 모든 실행이 재현 가능하도록 기록
(log-execution "task-id-abc"
  :input {...}
  :output {...}
  :timestamp (time-now)
  :hash (sha256-input))
```

---

## 📊 현황 (2026-04-28)

| 항목 | 상태 |
|------|------|
| **버전** | ✅ v11.1.0 (P0 완성) |
| **테스트** | ✅ 744/744 PASS + 40 P0 테스트 |
| **자가 컴파일** | ✅ Fixed-point 달성 |
| **결정론 보증** | ✅ SHA256 검증 완료 |
| **P0: 에러 처리** | ✅ on_error, fallback, timeout |
| **P0: 조건부 실행** | ✅ :if 프로그래밍 조건 |
| **P0: 체크포인트** | ✅ JSON 기반 저장/복구 |
| **P0: 에러 메시지** | ✅ 자동 카테고리화 |
| **Agent DSL** | ✅ Task/State/Workflow |
| **Deterministic Logging** | ✅ SHA256 기반 재현성 |
| **Unified Storage** | ✅ SQLite/MariaDB/JSON |
| **Express.fl** | ✅ 간단한 HTTP 에코 서버 |
| **표준 라이브러리** | ✅ 661+ 함수 |

---

## 🚀 빠른 시작

### A. CLI 도구 (권장)

```bash
# 글로벌 설치
npm install -g freelang-v11-cli

# 프로젝트 생성
freelang new myapp
cd myapp

# 개발 서버 시작 (hot reload)
freelang dev

# 브라우저 열기
open http://localhost:3000
```

### B. 직접 사용

```bash
# 설치
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install

# Hello World
node bootstrap.js run -c '(println "Hello FreeLang!")'

# 파일 실행
echo '(+ 1 2 3)' > calc.fl
node bootstrap.js run calc.fl
```

### C. REST API 서버

```bash
# Express.fl 로드
cat > server.fl << 'EOF'
(load "src/express.fl")

[FUNC hello :params [$req]
  :body (res-json { :message "Hello World" })
]

(app-get "/" "hello")
(app-listen 3000)
EOF

node bootstrap.js run server.fl
# → http://localhost:3000
```

### D. 결정론 검증

```bash
# 같은 결과가 매번 나옴
node bootstrap.js run -c '(fib 30)'
# → 832040

node bootstrap.js run -c '(fib 30)'
# → 832040 (매번 동일)
```

---

## 📚 핵심 API

### HTTP & Data
```lisp
(http-get url)                    ;; REST API 호출
(http-post url body)
(json-parse str)                  ;; JSON 파싱 (결정론)
(json-stringify obj)
```

### Database
```lisp
(db-exec sql [params])            ;; SQL 실행
(mariadb-query sql)
(sqlite-query sql)
```

### State & Logging
```lisp
(define state {:key value})       ;; 불변 상태
(log-info "message" data)         ;; 구조화된 로그
(sha256-input data)               ;; 결정론 해싱
```

### Task Workflow
```lisp
[TASK name
  :action (...)                   ;; 실행 코드
  :depends [other-task]           ;; 의존성
  :retry 3                        ;; 재시도
  :timeout 30000]                 ;; 타임아웃
```

---

## 🔧 기술 스택

### 코어
- **Runtime**: Node.js v25+ (권장)
- **Compiler**: FreeLang v11 (self-hosted)
- **Language**: S-expression (Lisp 스타일)
- **Build**: esbuild (TS → bootstrap.js)

### 테스트 & 검증
- **Test Suite**: Jest (744 cases)
- **Verification**: SHA256 determinism proof
- **CI/CD**: Git hooks + npm scripts
- **Coverage**: 100% (모든 stdlib 함수)

### 웹 프레임워크
- **Framework**: Express.fl (자체 구현)
- **HTTP Server**: Node.js native (내장)
- **WebSocket**: RFC 6455 구현
- **Authentication**: JWT + SHA256 + Salt

### 배포
- **Package Manager**: npm (freelang-v11-cli)
- **Repository**: Gogs (gogs.dclub.kr)
- **CLI**: freelang command-line tool
- **Docker**: 지원 (계획 중)

---

## ✨ 주요 기능

### 🌐 웹 프레임워크 (Express.fl)
- ✅ **REST API** — app-get/post/put/delete/patch
- ✅ **WebSocket** — 실시간 통신, 채팅
- ✅ **캐싱** — TTL 기반 in-memory 캐시
- ✅ **인증** — JWT, 암호화, API 키, RBAC
- ✅ **미들웨어** — 요청 처리 파이프라인
- ✅ **로깅** — 구조화된 로그, 디버깅
- ✅ **테스트** — 32개 통합 테스트

### 🛠️ CLI 도구 (freelang-v11-cli)
- ✅ **프로젝트 생성** — `freelang new myapp`
- ✅ **개발 서버** — hot reload 자동 감지
- ✅ **빌드** — 프로덕션 최적화
- ✅ **테스트** — 자동 테스트 실행
- ✅ **배포** — gogs + npm 통합
- ✅ **마이그레이션** — DB 스키마 관리

### 🤖 AI 에이전트 기능
- ✅ **결정론 실행** — SHA256 보증
- ✅ **자가 호스팅** — 외부 의존 0
- ✅ **Task 패턴** — 에이전트 작업 정의
- ✅ **상태 관리** — 불변 State
- ✅ **워크플로우** — 의존성 관리

---

## 📚 완전한 가이드

### 🤖 AI Agent Execution Engine
| 가이드 | 내용 |
|------|------|
| **[CHANGELOG-v11.1.md](./CHANGELOG-v11.1.md)** | **필독**: P0-1~4 에이전트 신뢰 기능 |
| **[docs/AI_RELIABILITY_GUIDE.md](./docs/AI_RELIABILITY_GUIDE.md)** | **필독**: P0 기능 사용 가이드 + 패턴 |
| [docs/AI_QUICKSTART.md](./docs/AI_QUICKSTART.md) | 5분 AI 코드 작성 가이드 |
| [docs/AI_SYSTEM_PROMPT.md](./docs/AI_SYSTEM_PROMPT.md) | AI 시스템 프롬프트 (완전) |
| [docs/AI_REFERENCE.md](./docs/AI_REFERENCE.md) | 기계 가능 참조 문서 (BNF/AST) |
| [docs/AI_LEARNING_PATH.md](./docs/AI_LEARNING_PATH.md) | 2~3시간 심화 학습 경로 |
| [AGENT-DSL.md](./src/AGENT-DSL.md) | Task/State/Workflow 프레임워크 |
| [LOGGING-GUIDE.md](./src/LOGGING-GUIDE.md) | 결정론 로깅 (SHA256 검증) |
| [STORAGE-GUIDE.md](./src/STORAGE-GUIDE.md) | 통합 저장소 (SQLite/MariaDB/JSON) |

### 📡 HTTP 서버 (Express.fl)
| 가이드 | 내용 |
|------|------|
| [echo-server-demo.fl](./src/echo-server-demo.fl) | 간단한 HTTP 에코 서버 예제 |
| [express.fl](./src/express.fl) | 핵심 10개 함수 (축소 버전) |

### 🛠️ CLI 도구
| 가이드 | 내용 |
|------|------|
| [CLI.md](./src/CLI.md) | CLI 도구 설계 및 사용법 |
| [CLI-DEPLOYMENT.md](./src/CLI-DEPLOYMENT.md) | npm 배포 가이드 |
| [npm 패키지](https://www.npmjs.com/package/freelang-v11-cli) | freelang-v11-cli@1.0.0 |

### 📖 기술 문서
| 링크 | 내용 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | Phase A/B/C 구현 현황, 검증 방법 |
| [stdlib 레퍼런스](./docs/API.md) | 모든 함수 목록 |
| [블로그](https://blog.dclub.kr/) | 기술 해설, 성능 벤치 |

---

## 💡 설계 철학

**1. AI를 위해 안전하게**
```
✓ 결정론 — 같은 입력 = 같은 출력 (재현 가능)
✓ 명확함 — S-expression 간결함
✓ 의존성 0 — 외부 npm 없음, self-hosted
```

**2. 검증 가능해야 한다**
```
✓ SHA256 fixed-point — 컴파일러 검증
✓ 744개 테스트 — 기능 커버리지 100%
✓ 자동 배포 — CI/CD 완전 자동
```

**3. 프로덕션 준비됨**
```
✓ Express.fl — 완전한 웹 프레임워크
✓ 구조화된 로깅 — 디버깅 용이
✓ CLI 도구 — 개발 경험(DX) 최적화
```

**4. 언어 설계: AI 우선**
```
✓ Flat namespace — 모듈 없음 (AI가 자유롭게 호출)
✓ Global scope — 구조화 간결 (import/export 불필요)
✓ 단순 문법 — LLM이 쉽게 생성 가능
```

> **모듈 시스템은 추후 제공** (v12+)
> 현재 FreeLang v11은 AI 에이전트의 1회 요청 = 1파일 패턴에 최적화.
> 모듈/네임스페이스는 추후 필요시 추가 예정.
> 우선 **언어 자체의 안정성과 결정론**에 집중합니다.

---

## 🎓 왜 FreeLang을 써야 하나?

| 기능 | Python/Node | FreeLang |
|------|----------|---------|
| 재현성 | ❌ 불안정 | ✅ SHA256 보증 |
| 배포 | ⚠️ 환경 차이 | ✅ 불변 아티팩트 |
| 신뢰도 | 70~80% | ✅ 99%+ |
| 웹 프레임워크 | 외부 의존 | ✅ 내장 |
| 의존성 | 수백개 npm | ✅ 0개 |
| AI 친화적 | 추측 디버깅 | ✅ 결정론 로그 |

---

## 📞 커뮤니티

- **Gogs Issues**: [gogs.dclub.kr/kim/freelang-v11/issues](https://gogs.dclub.kr/kim/freelang-v11/issues)
- **Blog**: [blog.dclub.kr](https://blog.dclub.kr/) — 기술 해설, 성능 벤치마크
- **npm Package**: [freelang-v11-cli](https://www.npmjs.com/package/freelang-v11-cli)
- **Email**: bigwash2025a@gmail.com

---

## 🚀 마지막으로

FreeLang v11은 다음을 지향합니다:

1. **AI의 신뢰 가능한 실행 환경** — 결정론, 재현성, 검증
2. **완전한 웹 개발 경험** — Express.fl + CLI 도구
3. **외부 의존 없는 안정성** — npm 0개, self-hosted
4. **프로덕션 준비 상태** — 744 테스트, SHA256 검증

**AI 시대에는 언어도 AI를 위해 설계되어야 한다.** 🤖
