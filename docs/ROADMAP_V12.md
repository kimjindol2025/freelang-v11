# FreeLang v12 로드맵 — 생산성 계층 강화

**상태**: v11.7.4 완성 (2026-05-13)  
**다음 목표**: v12.0 Hot Reload (Q3 2026)

---

## TOP 5 우선순위 기능

### 1. 🔥 Hot Reload (v12.0) — 개발 속도 10배

**목표**: 파일 변경 시 애플리케이션 즉시 재로드 (상태/연결 유지)

**기능**:
```lisp
;; 파일 감시 시작
(watch "src" {:extensions [".fl"] :debounce 300})

;; 특정 파일 재로드
(reload "routes/api.fl")

;; 모듈만 재로드
(reload-module std/http)

;; 조건부 재로드
(reload-when-changed "src/**/*.fl"
  (fn [path] (println (str "Reloaded: " path))))
```

**구현 계획**:
1. File watcher 통합 (chokidar)
2. Module dependency graph 추적
3. Hot reload marker (fn/route/state 별)
4. Graceful shutdown 메커니즘
5. WebSocket 유지 (socket ID 추적)

**측정**: 개발 사이클 30초 → 3초

---

### 2. 🎭 Macro System 강화 (v12.1) — 언어 수준 향상

**목표**: 강력한 메타프로그래밍으로 DSL/자동화 가능

**기능**:
```lisp
;; Basic macro
(defmacro unless [cond body]
  `(if (not ~cond) ~body))

;; HTML DSL
(defmacro html [& body]
  `(str "<div>" ~@body "</div>"))

;; ORM DSL
(defmacro select [table & clauses]
  (let [where-clause (find-clause clauses :where)]
    `(db-query db "SELECT * FROM ~table WHERE ..." [])))

;; Test DSL
(defmacro describe [name & tests]
  `(println (str "Testing " ~name)))

;; Macro expansion trace
(macroexpand-1 '(unless true "hi"))
;; → (if (not true) "hi")
```

**구현 계획**:
1. Quasiquote (`), unquote (~), unquote-splice (~@) 확장
2. Macro-local 변수 (gensym)
3. Macro composition
4. Macro expansion cache
5. macroexpand/macroexpand-1 유틸

**영향**: ORM, HTML, Test, Routing DSL 모두 가능

---

### 3. 🐛 Error Trace System (v12.1) — 디버깅 혁신

**목표**: 런타임 에러 시 완전한 콘텍스트 캡처

**기능**:
```lisp
;; Basic try-catch (현재)
(try
  (/ 1 0)
  (catch e
    (println (get e "message"))))

;; Enhanced with trace (v12.1)
(try
  (db-query db "..." [])
  (catch e
    {
      :error (get e "message")
      :stack (get e "stack")           ;; 스택 추적
      :macro-trace (get e "macro-trace") ;; 매크로 확장 경로
      :context (get e "context")       ;; 변수 스냅샷
      :source-line (get e "source-line") ;; 소스 맵
    }))

;; Stack trace 출력
(stacktrace e)
;; →
;; at db-query (db.fl:42)
;;   called from handle-users (routes/api.fl:15)
;;     called from server-handler (app.fl:3)

;; Macro trace
(macrotrace e)
;; →
;; Macro: defroute expanded to...
;; → (defn handler [req] ...)
```

**구현 계획**:
1. Stack frame capture (각 호출 레벨)
2. Source map 생성 (bootstrap.js ↔ .fl 매핑)
3. Variable snapshot (scope 별 바인딩 저장)
4. Macro expansion trace (매크로 전개 경로)
5. Error context enrichment

**영향**: 대형 프로젝트의 디버깅 시간 50% 감소

---

### 4. 📦 Module System 2.0 (v12.2) — 프로젝트 스케일링

**목표**: 대규모 프로젝트 지원 (namespace 충돌 방지, lazy load, 버전 관리)

**기능**:
```lisp
;; 현재 (v11)
(load "stdlib/http.fl")

;; v12.2 — named import
(import std/http)
(import std/auth :as auth)
(import mylib/models :as models)

;; 특정 함수만
(import std/http {server-start server-json})

;; 버전 지정
(import std/http ^1.0)  ;; 1.0.x

;; 내보내기
(export defn add [a b] (+ a b))
(export {add subtract multiply})

;; Lazy load (필요할 때만)
(define db (lazy-load std/db))
(db-query ...)  ;; 실제 로드

;; Cyclic import 검출
(import a)
(import b)  ;; a가 b를 임포트하면 에러 감지

;; 모듈 정보 조회
(module-info :name)    ;; "app"
(module-info :exports) ;; [defn-list]
(module-info :depends) ;; ["std/http" "std/auth"]
```

**구현 계획**:
1. Module registry (이름 ↔ 파일 매핑)
2. Namespace isolation (변수명 충돌 방지)
3. Lazy load mechanism (require 시점 지연)
4. Circular dependency detector
5. Version resolver
6. Module metadata (.module.json)

**영향**: 100개+ 파일 프로젝트 관리 가능

---

### 5. 🎨 Formatter / Linter (v12.2) — 코드 품질

**목표**: 자동 포맷팅 + 정적 검사 + 프로젝트 진단

**기능**:
```bash
# Formatter
freelang fmt src/app.fl
# →  들여쓰기, 스페이싱 자동 정렬

freelang fmt-check src/
# → 포맷 문제 리포트만 (수정 안 함)

# Linter
freelang lint
# →
# app.fl:15: unused variable 'x'
# routes/api.fl:42: performance: use map-indexed instead of map+nth

# Doctor (프로젝트 진단)
freelang doctor
# →
# ✅ All 1090 tests pass
# ✅ No circular imports
# ⚠️  5 unused exports
# ⚠️  Missing type hints: 3 functions
# 📊 Code coverage: 94%

# 설정 파일 (freelang.config.fl)
{:formatter
  {:indent 2
   :line-width 100
   :style :compact}
 :linter
  {:unused-vars true
   :unused-exports true
   :performance true}}
```

**구현 계획**:
1. AST 기반 포매터 (S-expression 최적화)
2. Lint rule engine (성능, 스타일, 보안)
3. Fix suggestion (자동 수정 모드)
4. Configuration system
5. Incremental lint (변경 파일만)

**영향**: 팀 협업 시 코드 스타일 자동화

---

## 구현 타임라인

| 버전 | 예정 | 기능 |
|------|------|------|
| **v12.0** | Q3 2026 | Hot Reload |
| **v12.1** | Q4 2026 | Macro + Error Trace |
| **v12.2** | Q1 2027 | Module System 2.0 + Formatter/Linter |
| **v12.3** | Q2 2027 | Type Hints + ORM Query Builder |
| **v12.4** | Q3 2027 | Observability + Test Framework |
| **v12.5** | Q4 2027 | Process Mgmt + AI Runtime |
| **v13.0** | Q2 2028 | Package Registry + Ecosystem |

---

## v11 → v12 마이그레이션

**호환성**: 100% 하위 호환 (breaking change 없음)

```lisp
;; v11 코드는 v12에서도 그대로 동작
(defn add [a b] (+ a b))
(load "stdlib/http.fl")

;; v12 신기능은 선택적
(import std/http)
(watch "src")
```

---

## 참고: 부가 기능들 (v12.3+)

**Type Hints** (v12.3)
```lisp
(defn add [a:int b:int] -> int
  (+ a b))

(defcontract User
  {:name string :age int})
```

**ORM Query Builder** (v12.3)
```lisp
(select users
  (where (= age 20))
  (order-by :name :asc)
  (limit 10))
```

**Observability** (v12.4)
```lisp
(metrics)    ;; 요청 통계
(heap-info)  ;; 메모리 사용
(route-stats);; 라우트별 성능
```

**Test Framework** (v12.4)
```lisp
(describe "User API"
  (it "should create user"
    (is (= 1 1)))
  (it "should handle error"
    (with-mock fetch (fn [] (throw "error"))
      (is-thrown))))
```

**Process Management** (v12.5)
```lisp
(cluster-start 4)      ;; 4 워커 시작
(supervise handler {}) ;; 자동 재시작
(graceful-shutdown)    ;; 연결 유지 후 종료
```

**AI Runtime** (v12.5)
```lisp
(ai-complete "Write a function that...")
(ai-embed "user input")
(ai-agent {:system "..." :memory true})
```

---

## 성공 지표

- 🔥 Hot Reload: 개발 사이클 30초 → 3초
- 🎭 Macro: 5개 이상 내장 DSL
- 🐛 Error Trace: 스택 추적 완전성 100%
- 📦 Module: 1000개 파일 프로젝트 지원
- 🎨 Formatter: 포맷 일관성 100%

---

**Vision**: FreeLang v12는 "AI-native 언어"에서 "production-grade 플랫폼"으로 진화.
