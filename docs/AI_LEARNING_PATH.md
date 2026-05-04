# FreeLang v11 — AI 학습 경로

**목표**: AI 에이전트가 효율적으로 이 언어를 배우고, 버그 없는 코드를 생성하도록 설계됨.

**예상 학습 시간**: 2~3시간

---

## 📖 Part 1: 언어 철학 (이것부터 읽기!)

### 왜 AI 전용 언어인가?

일반 프로그래밍 언어는 AI가 쓸 때 3가지 문제가 있다:

```
❌ 비결정론 — 같은 코드 ≠ 같은 결과
  예: Python random(), 해시 순서, 부동소수점 오차
  
❌ 환경 의존성 — Node v20 ≠ Node v18
  예: 모듈 경로, 라이브러리 버전 차이, OS 차이
  
❌ 재현 불가 — 에러 디버깅 어려움
  예: 프로덕션에서만 발생, 재현 불가능
```

**FreeLang v11의 해결책**:
- ✅ **결정론성**: 같은 입력 → 항상 같은 바이트 출력 (SHA256 검증 가능)
- ✅ **자체 컴파일러**: 외부 라이브러리 불필요 (npm 0개)
- ✅ **불변 데이터**: 부작용 없이 안전한 상태 관리
- ✅ **명시적 에러**: try-catch로 모든 에러 처리 가능

### 결정론성이 왜 중요한가?

```lisp
(fib 30)
;; 항상 832040 (매번 동일, SHA256 해시도 동일)

(+ 1 2)
;; 항상 3 (다른 경로로 실행해도 같음)
```

이렇게 하면:
- AI가 **한 번 생성한 코드를 신뢰**할 수 있음
- **재현 가능한 버그 리포트** 가능
- **프로덕션 배포 안심**

---

## 🎯 Part 2: 빠른 시작 (5분)

### Step 1: 기본 문법

FreeLang은 **S-expression** (Lisp 스타일):

```lisp
;; 주석

;; 기본 타입
42                    ;; 숫자
"hello"               ;; 문자열
:name                 ;; 키워드 (맵 키로 자주 사용)
[1 2 3]               ;; 배열
{:a 1 :b 2}          ;; 맵 (JSON 객체와 유사)

;; 함수 호출
(println "Hello, AI!")
(+ 1 2 3)
(map (fn [x] (* x 2)) [1 2 3])
```

**핵심**: `(함수명 인자1 인자2 ...)`

---

### Step 2: 변수 & 함수

```lisp
;; 변수 (불변)
(let [x 5 y 10]
  (+ x y))
;; → 15

;; 함수 정의
(defun add [a b]
  (+ a b))

(add 2 3)
;; → 5

;; 익명 함수
(map (fn [x] (* x 2)) [1 2 3])
;; → [2 4 6]
```

**규칙**:
- 변수는 `:` prefix 없음
- 함수는 소문자 + 하이픈 (예: `my-function`)
- 모든 값은 **불변** (기존 값 수정 불가, 새 복사본 반환)

---

### Step 3: 컬렉션 조작

```lisp
;; 배열
[1 2 3 4 5]
(length [1 2 3])           ;; → 3
(get [1 2 3] 0)            ;; → 1 (0-indexed)
(set [1 2 3] 1 99)         ;; → [1 99 3] (원본 불변)

;; 맵
{:name "Alice" :age 25}
(get {:name "Alice"} :name)  ;; → "Alice"
(keys {:a 1 :b 2})          ;; → [:a :b]
(values {:a 1 :b 2})        ;; → [1 2]
(merge {:a 1} {:b 2})       ;; → {:a 1 :b 2}

;; 문자열
(str "Hello" " " "World")   ;; → "Hello World"
(str-split "a,b,c" ",")     ;; → ["a" "b" "c"]
(str-includes "hello" "ll") ;; → true
```

---

### Step 4: 고차 함수 (중요!)

```lisp
;; map — 변환
(map (fn [x] (* x 2)) [1 2 3])
;; → [2 4 6]

;; filter — 필터링
(filter (fn [x] (> x 5)) [3 7 2 9 1])
;; → [7 9]

;; reduce — 누적 계산
(reduce (fn [acc x] (+ acc x)) 0 [1 2 3 4])
;; → 10  (0+1+2+3+4)
```

**AI 팁**: map/filter/reduce는 거의 모든 데이터 처리에 사용 가능.

---

## ⚠️ Part 3: AI가 자주 하는 실수

### 1️⃣ 함수 인자 순서 헷갈림

```lisp
❌ 틀림:
(map [1 2 3] (fn [x] (* x 2)))

✅ 맞음:
(map (fn [x] (* x 2)) [1 2 3])

규칙: (map function list)
```

**기억**: 함수가 먼저, 데이터가 나중.

---

### 2️⃣ 불변성 무시

```lisp
❌ 틀림 (원본 수정하지 못함):
(defun increment-score [user]
  (set user :score (+ (get user :score) 1))
  user)  ;; 새 객체 반환되지 않음

✅ 맞음:
(defun increment-score [user]
  (set user :score (+ (get user :score) 1)))
  ;; set이 새 객체 반환
```

**기억**: 모든 수정은 새 복사본 반환.

---

### 3️⃣ nil vs false 헷갈림

```lisp
❌ 틀림:
(if (nil? x)
  "x is null")

✅ 맞음:
(if (nil? x)
  "x is nil"
  "x is not nil")

규칙: false, nil, 0을 제외한 모든 값은 truthy
```

**기억**: 
- `nil` = null/undefined
- `false` = 불린 거짓값
- `0` = 숫자 0 (falsy!)

---

### 4️⃣ try-catch 문법

```lisp
❌ 틀림:
(try
  (risky-operation))
  ;; catch가 없으면 에러 발생!

✅ 맞음:
(try
  (risky-operation)
  (catch err
    (println "Error:" err)
    nil))

또는 에러 무시:
(try
  (risky-operation)
  (catch err nil))
```

**기억**: try에는 항상 catch가 필요.

---

### 5️⃣ 맵 생성 문법

```lisp
❌ 틀림:
(let [user {:name "Alice"}]
  {user :age 25})  ;; 변수가 맵 키로 안 됨

✅ 맞음:
(let [user {:name "Alice"}]
  (merge user {:age 25}))

또는:
{:name "Alice" :age 25}
```

**기억**: 맵 키는 리터럴만 가능. 변수는 merge 사용.

---

### 6️⃣ 함수 정의 위치

```lisp
❌ 틀림:
(println (add 2 3))
(defun add [a b] (+ a b))

✅ 맞음:
(defun add [a b] (+ a b))
(println (add 2 3))
```

**기억**: 함수는 사용 전에 정의해야 함.

---

## 🔍 Part 4: 타입 체크 (버그 예방)

AI가 생성한 코드를 자동으로 검증하려면:

```lisp
;; 타입 확인
(number? 42)          ;; → true
(string? "hello")     ;; → true
(array? [1 2 3])      ;; → true
(map? {:a 1})         ;; → true
(nil? nil)            ;; → true
(function? (fn [x] x)) ;; → true

;; 실제 사용
(defun double-number [x]
  (if (not (number? x))
    (throw "Expected number")
    (* x 2)))

(double-number 5)  ;; → 10
(double-number "5") ;; → throw error
```

**AI 팁**: 모든 외부 입력에 대해 `(if-not TYPE? (throw ...))`로 검증!

---

## 🤖 Part 5: AI 에이전트 패턴

### 패턴 A: Task 실행

```lisp
(defun run-task [task-name task-data]
  (case task-name
    "fetch-data"
      (let [url (get task-data :url)]
        (await (http-get url)))
    
    "process-data"
      (let [data (get task-data :data)
            processed (map (fn [item] 
              (+ (get item :value) 10)) 
            data)]
        processed)
    
    "save-result"
      (let [result (get task-data :result)]
        (file-write "output.json" (str result)))
    
    ;; 기본값
    (throw (str "Unknown task: " task-name))))

;; 사용
(run-task "fetch-data" {:url "https://api.example.com"})
```

---

### 패턴 B: 상태 관리

```lisp
(defun handle-event [state event]
  (let [current-state (get state :current)
        new-data (get event :data)]
    (case current-state
      "idle"
        (merge state {:current "running" :start-time (now-ms)})
      
      "running"
        (let [results (get state :results)]
          (merge state {:results (+ results [new-data])}))
      
      "done"
        (merge state {:current "idle" :results []})
      
      state)))  ;; 기본값: 상태 유지
```

---

### 패턴 C: 데이터 검색 & 필터링

```lisp
(defun find-users [criteria]
  (let [users (db-query "SELECT * FROM users")]
    (filter (fn [user]
      (let [age (get user :age)
            name (get user :name)]
        (and
          (>= age (get criteria :min-age))
          (<= age (get criteria :max-age))
          (if (get criteria :name-contains)
            (str-includes (str-lower name) 
                         (str-lower (get criteria :name-contains)))
            true))))
     users)))

;; 사용
(find-users {:min-age 18 :max-age 65 :name-contains "al"})
```

---

## 📋 Part 6: 체크리스트 (코드 생성 후)

AI가 코드를 생성한 후 **반드시 확인**:

- [ ] 함수 정의는 사용 전에?
- [ ] 타입 검증이 있나? (외부 입력)
- [ ] try-catch가 있나? (네트워크, 파일 I/O)
- [ ] nil 체크가 있나? (optional 값)
- [ ] 배열 인덱스는 0부터? (off-by-one 버그)
- [ ] map/filter 함수 순서 맞나?
- [ ] 맵 수정은 merge/set으로?
- [ ] 모든 변수가 바인딩됐나?
- [ ] 문자열 연결은 str() 사용?
- [ ] 불린 연산에 and/or/not 사용?

---

## 🎓 Part 7: 예제 컬렉션

### 예제 1: REST API 호출 & 데이터 처리

```lisp
(defun fetch-and-process [api-url]
  (try
    (let [response (await (http-get api-url))
          items (get response :items)]
      (filter (fn [item] (> (get item :score) 0.5)) items))
    (catch err
      (println "API error:" err)
      [])))
```

### 예제 2: 데이터 변환 & 저장

```lisp
(defun transform-and-save [input-file output-file]
  (try
    (let [content (file-read input-file)
          data (parse-json content)
          transformed (map (fn [item]
            {:id (get item :id)
             :name (str-upper (get item :name))
             :score (* (get item :score) 1.1)})
           data)]
      (file-write output-file (str transformed)))
    (catch err
      (println "Error:" err))))
```

### 예제 3: 상태 머신

```lisp
(defun state-machine [state event]
  (case (get state :status)
    "init"
      (if (= (get event :type) "start")
        (merge state {:status "running" :step 0})
        state)
    
    "running"
      (let [current-step (get state :step)]
        (if (< current-step 10)
          (merge state {:step (+ current-step 1)})
          (merge state {:status "done" :completed-at (now-ms)})))
    
    "done"
      state
    
    state))
```

---

## 🚀 Part 8: 배포 가능한 코드

FreeLang은 **결정론성 보장**이므로, AI가 생성한 코드는 즉시 프로덕션 배포 가능:

```bash
# 1. AI가 생성한 코드
cat > agent.fl << 'EOF'
(defun process [data]
  (filter (fn [item] (> (get item :value) 10)) data))
EOF

# 2. 테스트 (1회만)
node bootstrap.js run agent.fl

# 3. 배포 (결정론성 보증, 재현 가능)
npm run build
docker build -t my-agent:sha256-abc123 .
```

**중요**: AI가 생성한 코드의 SHA256 해시를 기록하면, 향후 동일성 검증 가능.

---

## 📞 Part 9: 디버깅 가이드

### 에러 메시지 읽기

FreeLang 에러는 **파일명:라인**, **소스 컨텍스트**, **콜 스택** 세 부분으로 구성된다:

```
실행 오류  app.fl:9
       8 │ (defn run []
  →    9 │   (undefined-func 42)    ← 에러 라인 (빨간 강조)
      10 │ )

  ✖ Function not found: undefined-func

콜 스택:
  → run (line 9)
    main (line 12)
```

**읽는 법**:
1. `실행 오류  파일명:라인` — 어느 파일 몇 번째 줄인지
2. `→` 화살표가 가리키는 줄이 에러 발생 지점
3. `✖` 뒤가 실제 에러 메시지
4. 콜 스택 — 어떤 함수 체인에서 터졌는지 (역순, 최근 10개)

### 자주 보는 에러

```
✖ Function not found: foo
→ foo 함수 미정의. (defn foo [...] ...) 확인

✖ [E_UNDEFINED_VAR] '$x' at line N
→ 변수 $x 미정의. let 바인딩이나 defn 파라미터 확인

✖ [E_PARSE_UNEXPECTED_TOKEN] Unexpected token: EOF
→ 괄호 불일치. 힌트에 있는 열린 괄호 위치 확인

✖ Import error: file not found: ./utils.fl
→ import 경로 오류. 상대 경로 기준은 현재 파일 위치
```

### 파싱 에러 — 괄호 힌트

```
파싱 오류  app.fl:6:1
     6 │
       ^
  [E_PARSE_UNEXPECTED_TOKEN] Unexpected token: EOF
  힌트: 미닫힘 괄호 스택 (깊이: 2):
  [1] '(' at line 1:1
  [2] '(' at line 2:3

필요한 닫힘 괄호 시퀀스: ))
```

몇 번째 줄에서 열린 괄호가 안 닫혔는지 스택으로 보여준다.

### try/catch로 에러 처리

```lisp
(try
  (risky-operation)
  (catch $e
    (println "에러:" (get $e :message))
    (println "라인:" (get $e :line))))
```

---

## ✨ 결론

**AI로서 FreeLang을 마스터하는 3가지 핵심**:

1. **결정론성 신뢰** — 같은 코드 = 항상 같은 결과 ✅
2. **불변 데이터** — 수정 대신 새 복사본 반환 ✅
3. **명시적 에러** — try-catch로 모든 에러 처리 ✅

**이 3가지만 기억하면 버그 없는 코드 생성 가능!**

다음 단계: [stdlib 참조](./STDLIB_REFERENCE.md) 읽기 → 패턴 예제 실습
