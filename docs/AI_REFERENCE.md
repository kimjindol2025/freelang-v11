# FreeLang v11 — AI 참조 문서

> **대상**: AI 에이전트가 프로그래밍할 때 참조하는 구조화된 기계 가능 문서

---

## 1. 문법 규칙 (BNF)

```bnf
Program        ::= (Expr)*
Expr           ::= Literal | Variable | Symbol | Keyword | Sexpr | Block | String

Literal        ::= Number | Boolean | String
Number         ::= /^-?[0-9]+(\.[0-9]+)?$/
Boolean        ::= true | false | nil
String         ::= '"' ... '"'
Variable       ::= /^[a-zA-Z_$][a-zA-Z0-9_-]*$/ | '$' [a-zA-Z_$][a-zA-Z0-9_-]*
Keyword        ::= ':' [a-zA-Z_$][a-zA-Z0-9_-]*
Symbol         ::= "'" Expr

SpecialForm    ::= '(' SpecialOp Expr* ')'
Sexpr          ::= '(' FuncName Expr* ')'
FuncName       ::= Variable | Symbol

Block          ::= '[' Expr* ']' | '{' (Keyword Expr)* '}'

IfForm         ::= '(if' Expr Expr Expr ')'
CondForm       ::= '(cond' (Expr Expr)+ ')'
LetForm        ::= '(let' [([Variable Expr]+)] Expr* ')'
DoForm         ::= '(do' Expr* ')'
FnForm         ::= '(fn' [Param+] Expr* ')'
DefnForm       ::= '(defn' FuncName [Param+] Expr* ')'
AsyncForm      ::= '(async' FuncName [Param+] Expr* ')'
TryForm        ::= '(fl-try' Expr '(catch' Var Expr ')' ')'
UseForm        ::= '(use' Symbol ')'

Param          ::= Variable | '&' Variable
```

**핵심 규칙**:
- **토큰 분리**: 공백으로만 구분. 따옴표는 문자열만.
- **예약어 없음**: 모든 이름이 변수 가능 (shadowing 허용).
- **함수 호출**: 함수명이 변수 또는 심볼 가능.
- **Rest args**: `(defn f [& args] ...)` — args는 배열.

---

## 2. AST 노드 스키마 (JSON)

모든 노드는 다음 필드 포함:

```json
{
  "kind": "literal | variable | keyword | sexpr | block | pattern-match | await | throw",
  "line": <number>,
  "col": <number>,
  
  // Literal-specific
  "type": "number | string | boolean | symbol",
  "value": <primitive>,
  
  // Variable/Keyword-specific
  "name": <string>,
  
  // Sexpr-specific
  "op": <string>,
  "args": [<node>, ...],
  
  // Block-specific
  "fields": { "items": [<node>, ...] },
  
  // Pattern-match-specific
  "value": <node>,  // match 대상
  "cases": [
    { "pattern": <pattern>, "guard": <node | null>, "body": <node> },
    ...
  ],
  "defaultCase": <node | null>,
  
  // Await/Throw-specific
  "argument": <node>
}
```

**주의사항**:
- Map literal 필드는 2가지 형식 공존:
  - bootstrap parser: JS Map 사용 (`(map-entries ...)` 함수)
  - self-parser: `{items: [k, v, k, v, ...]}` (평탄 페어 리스트)
- codegen 내부에서 `(array? (get fields "items"))` 로 자동 판별.

---

## 3. stdlib 함수 카탈로그 (카테고리별)

### 3.1 기본 연산 (primitive)

```
+ - * / % abs min max
= == != < > <= >=
and or not
```

### 3.2 타입 검사 (type-predicates)

```
nil? array? object? fn? string? number? boolean? symbol?
keyword? map? list? dict? set? integer? float?
true? false? empty? even? odd?
```

### 3.3 컬렉션 조작 (collections)

**Array/List:**
```
list array first rest last nth count length size
push unshift pop shift reverse sort sort-by
filter map reduce fold fold-right for-each
any? all? contains? includes? index-of find
flatten concat join take drop range
```

**Object/Dict/Map:**
```
keys values entries assoc dissoc merge merge-with
get get-or put set-in get-in update update-in
pick select rename-keys invert
```

### 3.4 문자열 (string)

```
str string-length substr substring starts-with ends-with
includes? contains? index-of last-index-of
split join trim trim-start trim-end trim-left trim-right
uppercase lowercase capitalize
replace replace-all repeat
chars split-lines word-boundaries
```

### 3.5 수학 (math)

```
sin cos tan asin acos atan atan2 sqrt cbrt
pow exp log log10 ceil floor round abs sign
random random-int min max gcd lcm
PI E
```

### 3.6 JSON/Encoding (encoding)

```
json-stringify json-parse
json-set json-get json-keys json-values
base64-encode base64-decode
uri-encode uri-decode
hash md5 sha1 sha256
```

### 3.7 HTTP (http)

```
http-get http-post http-put http-patch http-delete
http-head http-options
parse-url url-encode query-string
server-listen server-handle middleware
request-path request-method request-headers
request-query request-body
response-status response-header response-body
```

### 3.8 파일 (file)

```
file-read file-write file-append file-delete
file-exists? file-dir? file-size file-modified
dir-list dir-create dir-delete
temp-file temp-dir
watch-file
```

### 3.9 시간 (time)

```
now now-ms now-iso now-unix
date-parse date-format
timezone-convert
sleep
```

### 3.10 데이터 구조 (data)

```
vector matrix queue stack heap
min-heap max-heap
graph-new graph-add graph-remove graph-dfs graph-bfs
tree-new tree-add tree-remove tree-dfs tree-bfs
```

### 3.11 AI/ML (ai)

```
vector-add vector-dot vector-scale cosine-sim
score-candidates top-k-retrieval prompt-template
```

### 3.12 데이터베이스 (db)

```
db-connect db-query db-exec db-close
mongo-connect mongo-insert mongo-find mongo-update mongo-delete
```

### 3.13 에러 처리 (error)

```
throw error error-code error-message
catch fl-try
assert assert-equals assert-true assert-false
```

**특수 패턴**:
```fl
(fl-try
  (do-something)
  (catch err (handle-error err)))
```

### 3.14 비동기 (async)

```
async await Promise.all Promise.race
parallel race with-timeout
```

---

## 4. 특수폼 (Special Forms) + JS 변환

| 특수폼 | 형식 | JS 변환 |
|--------|------|--------|
| `if` | `(if cond then else)` | `cond ? then : else` |
| `cond` | `(cond [t1 r1] [t2 r2] [true default])` | `if (t1) { r1 } else if (t2) { r2 } else { default }` |
| `let` | `(let [[v1 e1] [v2 e2]] body)` | `(()=>{ const v1=e1; const v2=e2; return body })()` |
| `do` / `begin` | `(do e1 e2 e3)` | `(()=>{ e1; e2; return e3 })()` |
| `fn` | `(fn [a b] (+ a b))` | `(a, b) => (a + b)` |
| `defn` | `(defn f [a] (+ a 1))` | `const f = (a) => (a + 1)` |
| `defun` | (동의어 defn) | (동일) |
| `async` | `(async f [x] (await g x))` | `const f = async (x) => { return await g(x) }` |
| `fl-try` | `(fl-try expr (catch e handler))` | `try { expr } catch (e) { handler }` |
| `set!` | `(set! x 10)` | `x = 10` |
| `->` | `(-> x (f) (g))` | `g(f(x))` — thread-first (첫 인자) |
| `->>` | `(->> x (f) (g))` | `g(f(...x))` — thread-last (마지막 인자) |
| `use` | `(use auth)` | `require('./auth.fl')` 또는 모듈 로드 |
| `defmacro` | `(defmacro m [x] ...)` | 컴파일 시점 전개 |
| `parallel` | `(parallel [p1 p2 p3])` | `Promise.all([p1, p2, p3])` |
| `race` | `(race [p1 p2])` | `Promise.race([p1, p2])` |
| `with-timeout` | `(with-timeout 5000 promise)` | Promise + timeout wrapper |

---

## 5. 플러그인 메타 블록 형식

플러그인은 `plugins/` 디렉터리에 `.fl` 파일로 저장하고, 파일 상단에 메타 블록 포함:

```fl
;; plugin: weather
;; version: 1.0.0
;; description: 날씨 조회 서비스
;; tags: http, external-api
;; author: Your Name
;; license: MIT

(defn weather/forecast [city days]
  (let [[url (str "https://api.example.com/forecast?city=" city "&days=" days)]
        [res (await (http-get url))]]
    (json-parse res)))

(defn weather/today [city]
  (weather/forecast city 1))
```

**메타 필드**:
- `plugin`: 플러그인 이름 (필수)
- `version`: 버전 (필수)
- `description`: 한 줄 설명
- `tags`: 쉼표/공백 분리 태그
- `author`: 작성자
- `license`: 라이선스

**탐색 순서** (use 호출 시):
1. `./plugins/NAME.fl` (로컬 프로젝트)
2. `~/.fl/plugins/NAME.fl` (글로벌 설치)
3. `./self/stdlib/NAME.fl` (내장 stdlib)
4. `./NAME.fl` (현재 디렉터리)
5. `./NAME` (확장자 없음)

---

## 6. 자주 틀리는 함정 (Pitfalls)

### 6.1 nil vs null 비교

**문제**: `(= x nil)` 이 `false` 반환 시 x는 null도 nil도 아닐 수 있음.

```fl
;; ❌ 틀림
(if (= x nil) ...)

;; ✅ 올바름 — 4중 검사
(if (or (nil? x) (= x nil) (= x null) (empty? x)) ...)

;; ✅ 권장 — 헬퍼 사용
(if (nil-or-empty? x) ...)
```

### 6.2 filter/map 인자 순서 불일치

**문제**: 라이브러리마다 순서가 다름.

```fl
;; ❌ 일부 라이브러리에서 실패
(filter fn list)

;; ✅ 자동 감지 (stdlib)
(filter fn list)           ;; fn을 먼저 → fn을 list 뒤로 자동 전환
(filter list fn)           ;; list를 먼저 → 그대로 사용
```

### 6.3 threading (->, ->>) 혼동

```fl
;; ❌ 틀림 — paren 필요
(-> x - 50 * 2)

;; ✅ 올바름 — 각 단계를 paren으로 감싸기
(-> x (- 50) (* 2))

;; ->> 사용 시 (마지막 인자)
(->> (list 1 2 3) (map (fn [x] (* x 2))))
;; → (map (fn [x] (* x 2)) (list 1 2 3))
```

### 6.4 async/await 블록 구조

```fl
;; ❌ 틀림 — await는 async 함수 내에서만
(let [[x (await (http-get "/api"))]] x)

;; ✅ 올바름
(async fetch-data []
  (let [[x (await (http-get "/api"))]]
    x))
```

### 6.5 defn vs fn 생성 경로

```fl
;; defn — 전역 바인딩 생성, 재귀 가능
(defn fib [n]
  (if (<= n 1) 1 (+ (fib (- n 1)) (fib (- n 2)))))

;; fn — 익명 함수, 여기서는 재귀 불가능 (이름 없음)
(let [[f (fn [n] ...)]]
  (f 10))
```

### 6.6 Map literal의 Key 형식

```fl
;; ❌ 틀림 — 키는 keyword 또는 string만
{key "value"}

;; ✅ 올바름
{:key "value"}      ;; keyword
{"key" "value"}     ;; string
```

### 6.7 get-or / first-or nil 안전성

```fl
;; ❌ 안전하지 않음
(get user :name)

;; ✅ 안전함 — nil이면 default 반환
(get-or user :name "Unknown")
(first-or items "empty")
(last-or events nil)
```

### 6.8 빈 배열 / 빈 맵 체크

```fl
;; ❌ 틀림
(if list "not empty" "empty")

;; ✅ 올바름
(if (empty? list) "empty" "not empty")
```

### 6.9 Symbol vs String

```fl
;; ❌ 틀림
(defn get-key [m key]
  (get m key))
(get-key {:a 1} :a)    ;; key는 string "a"로 전달됨

;; ✅ 올바름 — keyword 명시
(defn get-key [m key]
  (get m key))
(get-key {:a 1} :a)

;; ✅ 권장 — keyword 사용
{:a 1 :b 2}
```

### 6.10 defn 이름과 함수 이름 변경

```fl
;; ❌ 나중에 이름 변경 불가
(defn old-name [x] (+ x 1))

;; ✅ 앞서 정의 후 alias
(defn new-name [x] (old-name x))
```

---

## 7. 에러 코드 시스템 (E_xxx)

| 에러 코드 | 의미 | 예시 |
|----------|------|------|
| `E_TYPE` | 타입 불일치 | `(+ "string" 1)` |
| `E_ARITY` | 인자 개수 불일치 | `(+ 1)` |
| `E_UNDEFINED` | 정의되지 않은 함수 | `(unknown-func)` |
| `E_RECURSION` | 무한 재귀 | `(defn f [] (f))` 실행 |
| `E_PARSE` | 파싱 오류 | `(unclosed paren` |
| `E_LEXER` | 토큰화 오류 | 유효하지 않은 문자 |
| `E_OVERFLOW` | 스택/메모리 오버플로우 | 깊은 재귀 |
| `E_ASYNC` | 비동기 오류 | Promise 거부 |
| `E_IO` | 입출력 오류 | 파일 읽기 실패 |
| `E_ASSERTION` | assert 실패 | `(assert false "failed")` |

**사용법**:
```fl
(fl-try
  (do-something)
  (catch err
    (cond
      [(= (get err :code) "E_TYPE") "타입 오류 처리"]
      [(= (get err :code) "E_ASYNC") "비동기 오류 처리"]
      [true "기타 오류"])))
```

---

## 8. 컴파일 및 실행 경로

### 8.1 Compile + Execute (권장 — 프로덕션)

```bash
node stage1.js input.fl output.js    # FL → JS 컴파일
node output.js                        # 실행
```

**장점**: V8 JIT 컴파일, 빠름, 코드 검사 가능
**사용처**: 프로덕션, CI/CD, 벤치마크

### 8.2 Interpret (개발 친화적)

```bash
node bootstrap.js run input.fl        # FL 직접 해석 + 실행
```

**장점**: 즉시 결과, 디버깅 용이, REPL 가능
**사용처**: 개발 서버, 테스트, REPL

### 8.3 Web Server (Full-stack)

```bash
node bootstrap.js serve app/ --port 3000
```

**장점**: HTTP 라우팅, SSR, 404 처리 자동
**사용처**: 웹 애플리케이션
**제약**: interpreter 의존 (stage1 불가)

---

## 9. 성능 최적화 팁

### 9.1 벡터화 (Vectorization)

```fl
;; ❌ 느림 — loop 내 개별 연산
(loop [i 0 sum 0]
  (if (< i 1000000)
    (recur (+ i 1) (+ sum i))
    sum))

;; ✅ 빠름 — reduce 사용
(reduce + 0 (range 1000000))
```

### 9.2 메모이제이션 (Memoization)

```fl
(defn memo [f]
  (let [[cache {}]]
    (fn [x]
      (if (contains? cache x)
        (get cache x)
        (let [[result (f x)]]
          (do (set! cache (assoc cache x result))
              result))))))

(defn fib [n]
  (if (<= n 1) 1 (+ (fib (- n 1)) (fib (- n 2)))))

(defn fib-fast [n]
  ((memo fib) n))
```

### 9.3 Lazy Evaluation (stream)

```fl
(defn lazy-range [start end]
  (fn []
    (if (< start end)
      (do (set! start (+ start 1))
          (list start (lazy-range start end)))
      nil)))
```

---

## 10. 테스트 작성

```fl
(use assert)

(assert-equals (+ 1 1) 2)
(assert-true (> 5 3))
(assert-false (< 5 3))

(fl-try
  (assert-equals x y)
  (catch err (println "테스트 실패: " err)))
```

---

## 참고 리소스

- `docs/ARCHITECTURE.md` — 시스템 전체 구조
- `docs/AI_SYSTEM_PROMPT.md` — AI 시스템 프롬프트 (전체 함수 목록)
- `docs/AI_QUICKSTART.md` — 5분 빠른 시작
- `self/stdlib/` — 모든 stdlib 구현
- `scripts/property-test.js` — 테스트 스위트
