# FreeLang v11 — AI Quickstart (5분 가이드)

**목적**: AI 에이전트가 5분 안에 안정적인 FreeLang 코드를 작성하기 시작.  
**전제**: 다른 Lisp 계열(Clojure/Common Lisp/Scheme) 경험 있음.  
**연계**: `AI_SYSTEM_PROMPT_MINI.md`(시스템 프롬프트), `AI_LEARNING_PATH.md`(2~3h 심화 학습).

---

## 1. 1분 첫걸음

```fl
;; 함수 정의 (Clojure 스타일)
(defn greet [name]
  (str "안녕, " name "!"))

;; 실행
(println (greet "FreeLang"))
;; 출력: 안녕, FreeLang!
```

```bash
# 파일 저장: hello.fl
node bootstrap.js run hello.fl
```

---

## 2. 즉시 복사 템플릿 10개

### T1. CLI 도구 (인자 받아서 처리)

```fl
;; (use io)는 println 등 기본 — 대부분 자동
(defn main []
  (let [[args __argv__]                   ;; CLI 인자 (자동 주입)
        [name (get-or args 0 "world")]]
    (println (str "Hello, " name "!"))))

(main)
```

### T2. JSON 데이터 변환

```fl
(defn process-users [users]
  (->> users
       (filter (fn [u] (> (get u :age) 18)))
       (map (fn [u] {:name (get u :name) :adult true}))))

(println (process-users [{:name "Alice" :age 25} {:name "Bob" :age 12}]))
;; 출력: [{:name "Alice" :adult true}]
```

### T3. nil-safe 데이터 접근

```fl
(defn safe-name [user]
  (get-or user :name "익명"))               ;; user nil이거나 :name 없으면 "익명"

(safe-name nil)              ;; → "익명"
(safe-name {:name "Alice"})  ;; → "Alice"
```

### T4. 에러 처리 (Result 패턴)

```fl
(defn safe-divide [a b]
  (fl-try
    (/ a b)
    (catch err {:error (str err)})))

(safe-divide 10 0)  ;; → {:error "..."}
(safe-divide 10 2)  ;; → 5
```

### T5. HTTP 요청 (async)

```fl
(async fetch-user [id]
  (let [[res (await (http_get (str "/api/users/" id)))]]
    (json-parse res)))

;; 호출 예: (await (fetch-user "42"))
```

### T6. 상태 기계 (immutable update)

```fl
(defn transition [state event]
  (cond
    [(and (= state :idle) (= event :start)) :running]
    [(and (= state :running) (= event :pause)) :paused]
    [(and (= state :paused) (= event :resume)) :running]
    [(= event :stop) :idle]
    [true state]))                          ;; 변환 없으면 그대로

(transition :idle :start)   ;; → :running
```

### T7. 재귀 → reduce 변환 (스택 안전)

```fl
;; ❌ 위험: 큰 리스트 → E_STACK_OVERFLOW
(defn sum-bad [xs]
  (if (empty? xs) 0
    (+ (first xs) (sum-bad (rest xs)))))

;; ✅ 안전: reduce 사용
(defn sum-good [xs]
  (reduce (fn [acc x] (+ acc x)) 0 xs))
```

### T8. stdlib 모듈 import

```fl
(use ai)         ;; self/stdlib/ai.fl 로드
(use json)
(use crypto)

;; 이제 해당 모듈 함수 사용 가능
```

### T9. 패턴 매칭 (cond 활용)

```fl
(defn describe [x]
  (cond
    [(nil? x)      "nothing"]
    [(string? x)   (str "문자열: " x)]
    [(number? x)   (str "숫자: " x)]
    [(list? x)     (str "리스트 " (length x) "개")]
    [true          "기타"]))
```

### T10. 파이프라인 (->>)

```fl
(->> "  Hello World  "
     (trim)
     (lower-case)
     (split " "))
;; → ["hello" "world"]
```

### T11. defstruct (타입이 있는 레코드)

```fl
;; 단순 형태 (모든 field type=any)
(defstruct Point [x y])
(let [[p (Point 3 4)]] (println (get p :x)))   ;; → 3

;; 명시적 타입 형태
(defstruct User [:name :string :age :int])
(let [[u (User "Alice" 25)]] (println (get u :name)))   ;; → "Alice"

;; 자동 술어 (Point? v) → true/false
(println (Point? p))   ;; → true
```

### T12. match (패턴 매칭)

```fl
;; (match value (pattern body) ... (default body))
(defn classify [n]
  (match n
    (0 "zero")
    (1 "one")
    (2 "two")
    (default "many")))

(println (classify 2))   ;; → "two"
(println (classify 99))  ;; → "many"
```

---

## 3. 자주 틀리는 10가지 (반드시 체크)

### F1. ❌ `defn`을 `def`로 잘못 씀
```fl
(def greet [n] ...)   ;; ❌ def는 변수 정의
(defn greet [n] ...)  ;; ✅ defn은 함수 정의
```

### F2. ❌ `if`에 else 빠뜨림
```fl
(if (> x 0) "양수")           ;; ❌ else 없으면 nil 반환 (의도?)
(if (> x 0) "양수" "음수")    ;; ✅ 명시적
```

### F3. ❌ map 인자 순서
```fl
(map [1 2 3] inc)   ;; ❌ data-first
(map inc [1 2 3])   ;; ✅ fn-first (Lisp 관례)
```

### F4. ❌ nil 접근
```fl
(get user :name)               ;; ❌ user가 nil이면 nil (디버깅 어려움)
(get-or user :name "default")  ;; ✅ 명시적 default
;; FL_STRICT=1 환경에선 ❌가 E_TYPE_NIL throw
```

### F5. ❌ `=` 와 `==` 혼동
```fl
;; FreeLang에서는 = 만 있음 (== 없음)
(if (= x 1) ...)    ;; ✅
(if (== x 1) ...)   ;; ❌ 미정의 함수 (E_FN_NOT_FOUND)
```

### F6. ❌ keyword vs string
```fl
{:name "Alice"}        ;; map: key는 :keyword
(get m :name)          ;; ✅ keyword로 접근
(get m "name")         ;; ✅ string도 동작 (alias)
```

### F7-scope. ⚠️ `let` 스코프 — `do` 블록 형제에서 안 보임

```fl
;; ❌ 문제: do 안 let 바인딩이 다음 형제에서 사라짐
(do
  (let [[$x 10]] (println $x))   ;; → 10
  (println $x))                   ;; ❌ Undefined variable '$x'

;; ✅ 해결: outer let으로 끌어올리기
(let [[$x 10]]
  (do (println $x) (println (* $x 2))))
```

### F7. ✅ `let` 형식 — **두 형태 모두 작동** (2026-04-25 검증)
```fl
;; Clojure 스타일 (single bracket, 1차원 평탄) — 작동
(let [x 10] (+ x 1))
(let [x 10 y 20] (+ x y))
(let [a 1 b 2 c 3] (+ a b c))

;; FreeLang 전통 (2차원, [[k v]] [[k v]]) — 작동
(let [[x 10]] (+ x 1))
(let [[x 10] [y 20]] (+ x y))

;; 주의: 한 form 안에 1차원/2차원 혼합 ❌
(let [[x 10] y 20] ...)        ;; ❌ "바인딩 형식이 일관되지 않음"
```

### F8. ❌ list literal vs Array block
```fl
(list 1 2 3)      ;; 런타임 list (값)
[1 2 3]           ;; Array block (AST 노드, 평가 시 list로)
;; 대부분 동일 동작이나, 메타프로그래밍에서 차이
```

### F9. ❌ string concat
```fl
(+ "a" "b")     ;; ❌ + 는 숫자만
(str "a" "b")   ;; ✅ str로 concat
```

### F10. ❌ 함수 body가 여러 표현식
```fl
(defn foo [x]
  (println x)
  (+ x 1))           ;; ❌ defn body는 single expression — 마지막만 반환

(defn foo [x]
  (do                ;; ✅ do로 묶음
    (println x)
    (+ x 1)))
```

---

## 4. 디버깅 명령

| 환경변수/명령 | 효과 |
|---------------|------|
| `FL_STRICT=1` | nil 접근을 즉시 `E_TYPE_NIL`로 throw (디버깅 모드) |
| `FL_TRACE=1` | 모든 함수 호출 trace 출력 (stderr) |
| `node bootstrap.js repl` | 대화형 REPL — `:ls` `:src` `:inspect` 등 |
| 에러 메시지 `[E_xxx]` | 코드별 자동 복구 힌트 표시 |

---

## 5. 코드 작성 후 자체 검증 5단계

작성한 코드를 실행하기 전 AI가 자체 점검:

1. **구조**: `(defn fn [args] body)` body는 single expression?
2. **분기**: 모든 `if`에 then + else?
3. **nil-safety**: 외부 데이터 접근 시 `-or` wrapper 또는 `nil?` 가드?
4. **명명**: 함수명 lowercase + hyphen, 미정의 함수 호출 없음?
5. **재귀**: 무한 재귀 위험 시 종료 조건 명시?

검증 명령:
```bash
node bootstrap.js run my-code.fl                  # 일반 실행
FL_STRICT=1 node bootstrap.js run my-code.fl      # nil 엄격 모드
FL_TRACE=1 node bootstrap.js run my-code.fl       # 호출 trace
```

---

## 새 alias (2026-04-25 추가)

메인 dispatch에 누락되었던 함수들이 통합되었습니다 — AI가 어느 형태로 작성해도 작동:

| Alias | Canonical | 효과 |
|-------|-----------|------|
| `keys` ⟷ `json_keys` | 둘 다 작동 | map의 키 추출 |
| `values` ⟷ `json_vals` | 둘 다 작동 | map의 값 추출 |
| `upper-case` / `uppercase` / `upper` | 모두 동작 | 대문자 변환 |
| `lower-case` / `lowercase` / `lower` | 모두 동작 | 소문자 변환 |
| `starts-with?` / `str-starts-with?` | 둘 다 작동 | prefix 검사 |
| `ends-with?` / `str-ends-with?` | 둘 다 작동 | suffix 검사 |
| `char-at` / `str-char-at` | 둘 다 작동 | 인덱스로 글자 |
| `pow` / `math-pow` | 둘 다 작동 | 거듭제곱 |
| `nil?` / `null?` | 둘 다 작동 | nil 체크 |
| `array?` / `list?` | 둘 다 작동 | 배열 검사 |
| `bool?` / `boolean?` | 둘 다 작동 | bool 검사 |
| `function?` / `fn?` | 둘 다 작동 | 함수 검사 |
| `defun` / `defn` | 둘 다 작동 | 함수 정의 (Lisp 호환) |

또한 **list/map deep-equal**: `(= (list 1 2 3) (list 1 2 3))` → `true`

## FL-Bench로 본 AI 모델 평가 가능

100개 표준 task로 AI 모델 점수 측정:
```bash
node benchmarks/fl-bench/run.js --reference                    # 참조 100/100
node scripts/ai-eval.js --provider=claude-cli --label=opus-4.7 # 실제 모델 평가
```

## 다음 단계

- **2~3h 심화**: `docs/AI_LEARNING_PATH.md` (전체 학습 경로)
- **시스템 프롬프트**: `docs/AI_SYSTEM_PROMPT_MINI.md` (1,351 토큰, 매 conversation 컨텍스트로)
- **stdlib 전체 참조**: `docs/AI_SYSTEM_PROMPT.md` (384 함수, 5,888 토큰)
- **명명 규칙 audit**: `docs/STDLIB_NAMING_AUDIT.md`
- **FL-Bench 100 task**: `benchmarks/fl-bench/README.md`

---

작성: 2026-04-25 (AI-2 단계)  
근거: AI_COMPLETENESS_ANALYSIS.md "AI가 잘 쓰게 하기" 전략
