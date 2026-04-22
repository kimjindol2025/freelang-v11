# FreeLang v11 — AI Agent Execution Language

> AI 에이전트가 안정적으로 쓰고, 재현 가능하게 실행되는 언어

[![Tests](https://img.shields.io/badge/tests-643%2F643%20PASS-brightgreen)](./src/__tests__/)
[![Self-Host](https://img.shields.io/badge/self--host-fixed--point%20verified-blue)](./CLAUDE.md)
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

## 📊 현황

| 항목 | 상태 |
|------|------|
| **테스트** | ✅ 643/643 PASS |
| **자가 컴파일** | ✅ Fixed-point 달성 |
| **결정론 보증** | ✅ SHA256 검증 완료 |
| **표준 라이브러리** | ✅ 50개 모듈 |
| **에이전트 패턴** | ✅ Task/State/Workflow |

---

## 🚀 시작하기

### 1️⃣ 설치
```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install && npm run build
```

### 2️⃣ Hello World
```bash
cat > hello.fl << 'EOF'
(println "Hello from AI")
EOF

node bootstrap.js run hello.fl
```

### 3️⃣ 결정론 검증
```bash
# 첫 번째 실행
node bootstrap.js run fib.fl > output1.txt

# 두 번째 실행
node bootstrap.js run fib.fl > output2.txt

# 동일함을 확인
diff output1.txt output2.txt
# → (같음)
```

### 4️⃣ Agent Task 작성
```bash
cat > agent-task.fl << 'EOF'
[TASK analyze
  :action (let [data (json-parse (http-get "https://..."))
                result (map (fn [x] (* x 2)) data)]
            (log-info "Processed: " result)
            result)]
EOF

node bootstrap.js run agent-task.fl
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

- **Runtime**: Node.js v25+
- **Compiler**: FreeLang v11 (self-hosted)
- **Build**: esbuild (TS → bootstrap.js)
- **Test**: Jest (643 cases)
- **Verification**: SHA256 determinism

---

## 📖 문서

| 링크 | 내용 |
|------|------|
| [기술 상세](./CLAUDE.md) | Phase A/B/C 구현 현황, 검증 방법 |
| [stdlib 레퍼런스](./docs/API.md) | 모든 함수 목록 |
| [에이전트 패턴](./self/examples/) | Task, State, Workflow 예제 |
| [블로그](https://blog.dclub.kr/) | 기술 해설, 성능 벤치 |

---

## 💡 설계 철학

**1. AI는 읽기만 재밌게**
```
S-expression: 간단하고 명확한 문법
결정론: 항상 같은 결과
자가 호스팅: 외부 의존 없음
```

**2. 검증 가능해야 한다**
```
SHA256 fixed-point: 컴파일러 신뢰도
test 643개: 기능 검증
자동화: CI/CD 완전 자동
```

**3. 프로덕션 준비됨**
```
재현 가능한 빌드
구조화된 로깅
에러 추적 및 디버깅
```

---

## 🎓 AI가 이 언어를 쓰는 이유

| 기능 | 일반 언어 | FreeLang |
|------|----------|---------|
| 재현성 | 불안정 | ✅ SHA256 보증 |
| 디버깅 | 추측 | ✅ 결정론 로그 |
| 배포 | 환경 차이 | ✅ 불변 아티팩트 |
| 신뢰도 | ~70% | ✅ >99% |

---

## 📞 연락처

- **Issues**: [Gogs](https://gogs.dclub.kr/kim/freelang-v11/issues)
- **Blog**: [blog.dclub.kr](https://blog.dclub.kr/)
- **Email**: bigwash2025a@gmail.com

---

**AI 시대에는 언어도 AI를 위해 설계되어야 한다.**
