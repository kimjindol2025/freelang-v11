# FreeLang v11

**Observable systems language for backend runtimes, AI orchestration, and deterministic infrastructure.**

- Native ELF executable generation
- Process-based concurrency with observable state
- Deterministic verification pipeline (L4 native self-hosting achieved)
- libc-free runtime option
- AI-native (Claude + other agents)

---

## What Currently Works

✅ **Runtime & Execution**
- Native ELF executable generation
- libc-free runtime path
- Process-based concurrency (explicit isolation boundaries)
- Runtime observable state (inspectable execution)
- Deterministic verify pipeline (L3 self-hosting fixed point)

✅ **Networking & RPC**
- TCP server/client
- RPC framing (sliding-window parser + multiplex)
- WebSocket (RFC 6455)
- HTTP with rate limiting

✅ **Data & Storage**
- MariaDB queries + prepared statements
- SQLite (filesystem-based)
- File I/O with observable jobs
- Serialization (JSON, binary)

✅ **Process & Concurrency**
- OS process isolation
- Process tree management
- IPC (mailbox + message passing)
- Explicit failure boundaries

✅ **Development**
- Native FL compiler (self-hosting L4 achieved - native ELF executable)
- FL-native test runner
- FL-native build tools
- REPL with watch/debug

---

## 30-Second Architecture

```
.fl Source Code
    ↓ [LEXER]
Token Stream
    ↓ [PARSER]
AST (Intermediate Representation)
    ↓ [CODEGEN]
JavaScript (or native backend)
    ↓ [RUNTIME]
Observable Process System
    ↓ [VERIFY]
Canonical State (deterministic)
```

**Self-Hosting Fixed Point (L4 Native)**:
```
bootstrap.js (TypeScript)    [L0]
    ↓ compile self/cgc-main.fl
gen1.c (Native C)            [L1] ✅ 142KB, ~2874 lines
    ↓ gcc + 8 runtime modules
cgc-native1 (ELF binary)     [L2] ✅ 257KB, no Node.js/Bun
    ↓ cgc-native1 self/cgc-main.fl
gen2.c (Native C)            [L3] ✅ SHA256 identical
    ↓ gcc + 8 runtime modules
cgc-native2 (ELF binary)     [L4] ✅ SHA256 identical → fixed point achieved
    ↓ cgc-native2 self/cgc-main.fl
gen3.c (Native C)            [L4] ✅ SHA256 identical (verified 2026-05-24)
```

---

## Current Status (2026-05-24)

| Aspect | Status |
|--------|--------|
| **Version** | v11.7.12 |
| **Runtime Correctness** | ✅ Production (A+ grade) |
| **Self-Hosting** | ✅ L4 fixed point achieved (2026-05-24) - Native ELF path |
| **Native Compiler** | ✅ cgc-native1 (257KB ELF, zero Node.js dependency) |
| **Tests** | ✅ 824+ PASS (1090/1090 regression) |
| **Stdlib** | ✅ 63 core functions + 260 aliases |
| **Native Compilation** | ✅ C codegen + gcc link (build-cgc-native.sh) |
| **Production-Ready** | ✅ Yes (L4 native path verified) |

**Not Yet Complete**:
- Optimizer (compile-time optimizations)
- Production-grade scheduler (fair queue, priority)
- Mature ecosystem (package registry, tooling)
- Windows portability
- Standard library stabilization

---

## Design Priorities

FreeLang prioritizes:

1. **Observable execution** — runtime state must be inspectable
2. **Explicit failure boundaries** — process isolation, not silent errors
3. **Deterministic verification** — same code = same output (bit-for-bit)
4. **Runtime inspectability** — execution traces, state snapshots
5. **Backend/system workloads** — not a general-purpose language

This shapes every design decision: language, runtime, tooling.

---

## Why Process-Based Concurrency?

**Problem**: Threads share memory → hard to reason about state.

**FreeLang's answer**: OS processes as explicit isolation boundaries.

**Tradeoffs (honest)**:
- Higher process overhead (memory per process)
- IPC cost (message passing latency)
- OS dependency (not portable to all platforms)

**Goals (why it's worth it)**:
- ✅ Observable runtime state (inspect each process)
- ✅ Deterministic containment (predict failure scope)
- ✅ Crash isolation (one process fails, others run)
- ✅ AI-agent readability (clear execution boundaries)
- ✅ System architecture clarity (visible topology)

**Concrete example**:
```lisp
;; Process = isolated runtime context
(define worker (spawn-process handle-request))

;; Observable state
(process-state worker)           ;; → {:status "running" :memory 12.5M ...}

;; Explicit failure boundary
(on-process-crash worker (fn [] (restart-worker)))
```

---

## Verification Culture

FreeLang development follows strict verification gates.

**Major runtime and architecture milestones require**:
- **Canonical SHA tracking** — deterministic build output (bit-for-bit)
- **Invariant enforcement** — state machine verification
- **Reproducible runs** — same input = same output (cryptographic proof)
- **Architecture locks** — codegen changes freeze until verified

**Example: L3 Self-Hosting**
```
commit 2026-05-17: stage2.js compiled from stage1.js
commit 2026-05-17: stage3.js compiled from stage2.js
VERIFY: sha256(stage2.js) == sha256(stage3.js) ✅
```

This is **rare in personal language projects** — most lack verification culture.

---

## AI-Native Runtime

**Not**: "AI chatbot builder" or "LLM wrapper library"

**Actually**: Runtime architecture optimized for observable execution orchestration.

FreeLang explores:
- Observable execution (trace every step)
- Explicit orchestration (agent-readable state)
- Deterministic runtime (reproducible behavior)
- Inspectable failures (where did it break?)
- Event-driven systems (message-based composition)

**For agents like Claude**:
- Predictable state transitions
- Clear failure modes
- Observable side effects
- Inspectable runtime

---

## 📖 Philosophy (Context)

**FreeLang is not a general-purpose language.**

**It exists to explore**: What does a systems language look like when designed for:
- Human + AI collaboration (Claude as co-programmer)
- Observable, deterministic execution
- Backend infrastructure (not web frontends, not systems programming)

Key design principles:
- ✅ **AI can write accurately** — `$param` explicit, consistent syntax
- ✅ **AI can write quickly** — single file, zero dependencies
- ✅ **AI can write safely** — automatic serialization, type inference

---

## Quick Start (5 minutes)

### Installation & Basic Commands

```bash
git clone https://github.com/kimjindol2025/freelang-v11.git
cd freelang-v11
npm install && npm run build

# Hello World
node bootstrap.js run -c '(println "Hello, FreeLang!")'

# REPL (interactive shell)
node bootstrap.js repl
```

### Web Server (2 minutes)

```lisp
;; app.fl
(server-get "/" (fn [req]
  (server-html "<h1>Hello World!</h1>")))

(server-start 40100)
```

```bash
node bootstrap.js run app.fl
# Open: http://localhost:40100
```

### Database Example (3 minutes)

```lisp
;; db-app.fl
(define db {
  "host" "localhost"
  "user" "root"
  "password" ""
  "database" "mydb"
})

(server-get "/users" (fn [req]
  (let [users (db-query db "SELECT * FROM users" [])]
    (server-json users))))

(server-start 40100)
```

---

## Learn FreeLang

### 1. Basic Syntax (5 min)

```lisp
;; Define variables
(define x 42)

;; Define functions
(defn greet [name]
  (str "Hello, " name))

;; Data structures
[1 2 3]              ;; vector (array)
{:name "Alice" :age 30}  ;; map (object)

;; Control flow
(if (> x 0) "positive" "non-positive")
(when condition (do-something))
```

### 2. Process Model (10 min)

**Key concept**: Each process = isolated runtime context

```lisp
;; Spawn process (observable boundary)
(define worker (spawn-process handle-request))

;; Observable state
(process-state worker)  ;; → {:status "running" :memory 12.5M ...}

;; Explicit failure boundary
(on-process-crash worker (fn [] (restart-worker)))
```

**Why this matters**:
- Each process has its own state
- Failure in one process doesn't affect others
- Runtime state is fully inspectable

### 3. Observable Jobs (10 min)

```lisp
;; File-based observable jobs
(define job (create-job "task-123"))

(job-start! job)
(job-log! job "Processing batch...")
(job-end! job {:status "success"})

;; State is always readable
(job-state job)  ;; → {:id "task-123" :log [...] :status "success"}
```

### 4. Failure Boundaries (10 min)

```lisp
;; Explicit error handling
(try
  (db-query db "SELECT ..." [])
  (catch error
    (str "Database error: " (get error "message"))))

;; Process-level isolation
(define worker (spawn-process risky-operation))
;; If risky-operation crashes, main process unaffected
```

### 5. Common Patterns

```lisp
;; Map & filter
(map (fn [x] (* x 2)) [1 2 3])         ;; → [2 4 6]
(filter (fn [x] (> x 2)) [1 2 3 4])    ;; → [3 4]

;; Reduce
(reduce (fn [acc x] (+ acc x)) 0 [1 2 3 4])  ;; → 10

;; Let binding
(let [user (get req "body")
      id (get user "id")]
  (str "User: " id))

;; Recursion with loop/recur
(loop [i 0 sum 0]
  (if (< i 10)
    (recur (inc i) (+ sum i))
    sum))  ;; → 45
```

---

## Advanced Runtime Concepts

### Observable Execution

Every step is inspectable:

```lisp
;; Debug watch
:watch $user           ;; REPL command

;; Stack trace on error
(try (risky-op) (catch e (stacktrace e)))

;; Runtime state snapshot
(process-state worker)
```

### Deterministic Verification

Same input → Same output (cryptographically):

```bash
# L3 self-hosting proof
sha256sum stage2.js stage3.js
# Both identical → system verified
```

### Runtime Isolation (FSABI)

No libc dependency option:

```lisp
;; Native system calls
(file-read "/path/to/file")   ;; observable file I/O
(exec "/bin/program")          ;; process execution boundary
```

### Process IPC (Message Passing)

```lisp
;; Send message to process
(process-send worker {:cmd "fetch" :url "..."})

;; Receive reply
(process-recv worker)  ;; → {:result "..." :status "ok"}
```

### AI-Native Semantics

Observable for LLM reasoning:

```lisp
;; Explicit state transition
(define state (atom {}))
(swap! state assoc :status "processing")
(swap! state assoc :status "done")

;; Inspectable result
@state  ;; → {:status "done"}
```

---

## Philosophy

**FreeLang is not a general-purpose language.**

It exists to explore what systems design looks like when optimized for:
- **Human + AI collaboration** (Claude as co-programmer)
- **Observable, deterministic execution** (every step inspectable)
- **Backend infrastructure** (not web frontends, not systems programming)

---

## Recent Evolution

### v11.7.12 — L4 Native Self-Hosting Fixed Point (2026-05-24)
- cgc-native1 (ELF executable, 257KB) compiles cgc-main.fl to identical C
- SHA256(gen1.c) == SHA256(gen2.c) == SHA256(gen3.c)
- Native path verified: no Node.js/Bun/TypeScript required
- Scripts: build-cgc-native.sh, verify-l4-fixpoint.sh

### v11.7.11 — FL-Native Tooling
- Test runner written in FreeLang
- Build tools written in FreeLang
- npm philosophy (zero dependencies) extended

### v11.7.10 — L2 Parser Coverage
- 93% self-hosting test coverage
- Codegen stabilization

See [docs/changelog.md](docs/CHANGELOG.md) for detailed history

---

## Verification Status

✅ **Build**: `npm run build` successful  
✅ **Tests**: 824+ PASS (L2 Tier 1: 100%, L2 Tier 2: 93%)  
✅ **Self-Hosting**: L3 fixed point achieved (sha256: stage2.js == stage3.js)  
✅ **Repositories**: GitHub + Gogs synced

---

## 🏆 핵심 특징

| 특징 | 상태 |
|------|------|
| **npm 0개** | ✅ Node.js 표준만 사용 |
| **자가 컴파일** | ✅ FreeLang으로 FreeLang 컴파일 |
| **L3 고정점** | ✅ stage2==stage3 SHA256 동일 (2026-05-17) |
| **59개 stdlib** | ✅ 모든 주요 기능 포함 |
| **AI-Native** | ✅ 함수 메타, 타입 힌트 |
| **프로덕션** | ✅ A+ 등급 |

---

## 🗺️ 로드맵 (다음 단계)

| 버전 | 완료 | 주요 내용 | 상태 |
|------|------|----------|------|
| **v11.5.3** | ✅ 2026-05-09 | CSRF 토큰 + XSS 방지 + server-set-cookie | ✅ 완료 |
| **v11.6.19** | ✅ 2026-05-09 | Phase X + Phase Y AI 자동 진단 | ✅ 완료 |
| **v11.6.20** | ✅ 2026-05-13 | Rate Limiter 미들웨어 (IP 기반 슬라이딩 윈도우) | ✅ 완료 |
| **v11.6.21** | ✅ 2026-05-13 | Prepared Statement 강화 (배열 IN절 + Date + 검증) | ✅ 완료 |
| **v11.7.0** | ✅ 2026-05-13 | cron 스케줄러 + WebSocket (양방향 통신) | ✅ 완료 |
| **v11.7.10** | ✅ 2026-05-17 | L2 Codegen 버그 수정 (7개 prelude alias + has_key_q) — L2 93% 달성 | ✅ 완료 |
| **v11.7.11** | ✅ 2026-05-17 | FL-Native 빌드/테스트 도구 (fl-build + fl-test) — npm 0개 철학 강화 | ✅ 완료 |
| **v11.7.12** | ✅ 2026-05-24 | **L4 네이티브 자가호스팅 고정점 달성** — cgc-native1 (ELF) + SHA256 검증 | ✅ 완료 |
| **v11.8.0** | 📋 2026-06+ | Phase E-0 (L4 정착) + Phase E-1 (native hardening) | 🟡 진행중 |
| **v11.9+** | 📋 2026-07+ | L5 (TypeScript 완전 제거) 또는 다른 부트스트랩 | 📋 예정 |
| **v12** | 📋 2026-07+ | 타입 시스템 강화 + 모듈 시스템 | 📋 예정 |

---

## 🔗 링크

- **공식 언어 선언**: [OFFICIAL_LANGUAGE.md](docs/OFFICIAL_LANGUAGE.md)
- **Claude AI 가이드**: [CLAUDE.md](docs/CLAUDE.md)
- **시스템 아키텍처**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **전체 함수**: [docs/TOOLS.md](docs/TOOLS.md)
- **100가지 실수**: [docs/MISTAKES-100.md](docs/MISTAKES-100.md)

---

## 📞 지원

- 🐛 버그 리포트: gogs 또는 GitHub Issues
- 💬 질문: docs/CLAUDE.md 참고
- 📝 기여: CONTRIBUTING.md 참고

---

**마지막 검증**: 2026-05-24 L4 네이티브 고정점 달성 (v11.7.12)  
**상태**: Production Ready ✅ (A+ 등급, 네이티브 경로 검증)  
**버전**: v11.7.12 (L4 네이티브 자가호스팅 고정점)  
**완성도**: L4 네이티브 완료 · E-0 L4 정착 진행중 · 프로덕션 앱 10개 운영  
**라이선스**: MIT

---

## 📚 최근 블로그 (15편 완성)

**Phase Y: AI 자동 진단 시스템**
- [Y-1: 자동 진단 시스템 설계](../blog-posts/y1-ai-diagnosis-design.md)
- [Y-2: callStack + 디버그 API](../blog-posts/y2-callstack-debug-api.md)
- [Y-3-A: auto-fix-agent.js (완성)](../blog-posts/y3a-auto-fix-agent.md)

**Phase X: 표준화 + alias**
- [X-1: 표준화 규칙](../blog-posts/x1-standardization-rules.md)
- [X-2: 260개 snake_case alias](../blog-posts/x2-alias-migration.md)

**이전 시리즈 (P0-P8)**
1. [010 — P4: MariaDB 배치 40배](../blog-posts/010-freelang-mariadb-batch-optimization.md)
2. [011 — P5: 문자열 보간 에러](../blog-posts/011-freelang-string-interpolation-error-handling.md)
3. [012 — P6+P7: 함수명 + 술어](../blog-posts/012-freelang-p6-p7-completion.md)
4. [013 — Security: SQL Injection](../blog-posts/013-freelang-sql-injection-security.md)
5. [014 — 로드맵: v11.5.3 계획](../blog-posts/014-freelang-v11-roadmap-p8-migration.md)
6. [015 — P8 완료: MariaDB 인자 순서](../blog-posts/015-freelang-p8-complete.md)
