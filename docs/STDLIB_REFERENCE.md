# FreeLang v11 표준 라이브러리 완전 참조

**대상**: AI 에이전트 & 개발자  
**최종 업데이트**: 2026-05-10 (v11.6.21)

---

## 📚 목차

- [핵심 함수 (Core)](#핵심-함수)
- [컬렉션 (Collection)](#컬렉션)
- [문자열 (String)](#문자열)
- [수학 (Math)](#수학)
- [타입 & 검증 (Type & Validation)](#타입--검증)
- [AI & 벡터 (AI & Vector)](#ai--벡터)
- [비동기 (Async)](#비동기)
- [파일 I/O (File I/O)](#파일-io)
- [보안 & 이스케이프 (Security & Escape)](#보안--이스케이프-v1153)
- [HTTP & 네트워킹 (HTTP & Network)](#http--네트워킹)
- [HTTP 서버 요청 파싱](#http-서버-요청-파싱)
- [데이터베이스 (Database)](#데이터베이스)
- [날짜/시간 (Date & Time)](#날짜시간)
- [에러 처리 (Error Handling)](#에러-처리)
- [환경변수](#환경변수-v1160)
- [HTTP Bearer 헬퍼](#http-bearer-헬퍼-lir-004)
- [HTTP Retry](#http-retry-s4-04-2026-05-07)
- [frequencies](#frequencies-s4-03-2026-05-07)
- [매크로 시스템](#매크로-시스템-defmacro)
- [v11.6.x 신규 기능](#v116x-신규--확인된-기능-2026-05-08) — `->` 스레딩, `if-let` 평탄형, `some?`, 기본값 인자, `return`, `mariadb-transaction`, 상호재귀

---

## 핵심 함수

### `(println value)`
콘솔에 값을 출력하고 줄바꿈.

**파라미터**:
- `value` (any) — 출력할 값 (자동 stringify)

**반환값**: `nil`

**예제**:
```lisp
(println "Hello, AI!")
;; 출력: Hello, AI!

(println {:name "Alice" :score 95})
;; 출력: {name: "Alice", score: 95}
```

**주의**: 문자열이 아닌 값도 자동 변환됨. `JSON.stringify` 사용.

---

### `(print value)`
줄바꿈 없이 콘솔에 출력.

**파라미터**:
- `value` (any) — 출력할 값

**반환값**: `nil`

**예제**:
```lisp
(print "Loading")
(print ".")
(print ".")
(print "done")
;; 출력: Loading...done
```

---

### `(defn name [params...] body)`
함수 정의.

**파라미터**:
- `name` (symbol) — 함수명
- `params` ([symbol...]) — 파라미터 벡터
- `body` (expr) — 함수 본체

**반환값**: 함수 객체

**예제**:
```lisp
(defn greet [name]
  (println (+ "Hello, " name "!")))

(greet "Claude")
;; 출력: Hello, Claude!

(defn add [a b]
  (+ a b))

(add 2 3)
;; → 5
```

**규칙**:
- 함수명은 소문자 + 하이픈 권장 (예: `my-function`)
- 마지막 표현식이 반환값
- 재귀 가능 (TCO 최적화)

---

### `(fn [params...] body)`
익명 함수 (λ).

**파라미터**:
- `params` ([symbol...]) — 파라미터 벡터
- `body` (expr) — 함수 본체

**반환값**: 함수 객체

**예제**:
```lisp
(map (fn [x] (* x 2)) [1 2 3])
;; → [2 4 6]

(filter (fn [x] (> x 5)) [3 7 2 9])
;; → [7 9]
```

---

### `(let [symbol value ...] body)` — 권장 형식 (v11.1+)
로컬 바인딩 (변수 정의). **평탄형(flat)이 권장 문법**.

**파라미터**:
- `bindings` ([symbol value ...]) — 이름-값 쌍을 1차원으로 나열
- `body` (expr) — 바인딩 내에서 실행

**반환값**: `body`의 결과

**예제**:
```lisp
; ✅ 권장: 평탄형 (Clojure 스타일)
(let [x 5 y 10]
  (+ x y))
;; → 15

(let [name "Alice"
      greeting (str "Hello, " name)]
  (println greeting))
;; 출력: Hello, Alice

; 구버전 중첩형도 동작 (하위 호환)
(let [[x 5] [y 10]]
  (+ x y))
;; → 15
```

**규칙**:
- 바인딩은 순서대로 평가됨 (후속 바인딩에서 이전 값 참조 가능)
- 스코프는 `let` 블록 내부로 제한
- `$` 접두사 없이 순수 심볼 사용

---

### `(if condition then-expr else-expr)`
조건 분기.

**파라미터**:
- `condition` (expr) — 조건 (truthy/falsy)
- `then-expr` (expr) — 참일 때 실행
- `else-expr` (expr) — 거짓일 때 실행 (선택사항)

**반환값**: 선택된 분기의 결과

**예제**:
```lisp
(if (> 5 3)
  "5 is greater"
  "3 is greater")
;; → "5 is greater"

(if (= x 0)
  "zero")
;; x가 0이면 "zero", 아니면 nil
```

**주의**:
- `false`, `nil`, `0` 제외 모두 truthy
- 3번째 인자 없으면 else는 `nil`

---

### `(cond ...)` — 다중 조건 분기
여러 조건을 순서대로 평가해 첫 번째 참인 분기 실행.

**세 가지 문법 — 모두 지원**:

```lisp
; 1. 평탄형 (권장, Clojure 스타일)
(cond
  (= x 1) "one"
  (= x 2) "two"
  :else   "other")   ; :else 또는 else → catch-all

; 2. 브래킷형
(cond
  [(= x 1) "one"]
  [(= x 2) "two"]
  [:else   "other"])  ; [:else ...] 또는 [else ...] → catch-all

; 3. 괄호형 (구버전)
(cond
  ((= x 1) "one")
  ((= x 2) "two")
  (else    "other"))
```

**반환값**: 첫 번째 참인 분기의 결과, 없으면 `nil`

**예제**:
```lisp
(define score 85)
(cond
  (>= score 90) "A"
  (>= score 80) "B"
  (>= score 70) "C"
  :else         "F")
;; → "B"
```

**규칙**:
- `:else`, `else` 모두 catch-all로 작동 (v11.6.2+)
- 평탄형에서 홀수 번째 마지막 항목도 default로 작동

---

## 컬렉션

### `(map function list)`
리스트의 각 요소에 함수 적용.

**파라미터**:
- `function` (fn) — 각 요소에 적용할 함수
- `list` (array/list) — 입력 컬렉션

**반환값**: 변환된 배열

**예제**:
```lisp
(map (fn [x] (* x 2)) [1 2 3])
;; → [2 4 6]

(map (fn [user] (get user :name)) 
     [{:name "Alice"} {:name "Bob"}])
;; → ["Alice" "Bob"]
```

**성능**: O(n)

---

### `(filter predicate list)`
조건을 만족하는 요소만 필터링.

**파라미터**:
- `predicate` (fn) — 필터 함수 (true/false 반환)
- `list` (array/list) — 입력 컬렉션

**반환값**: 필터된 배열

**예제**:
```lisp
(filter (fn [x] (> x 5)) [3 7 2 9 1])
;; → [7 9]

(filter (fn [item] (get item :active))
        [{:id 1 :active true} {:id 2 :active false}])
;; → [{:id 1 :active true}]
```

---

### `(reduce function initial list)`
누적 계산 (fold).

**파라미터**:
- `function` (fn [accumulator item]) — 누적 함수
- `initial` (any) — 초기값
- `list` (array/list) — 입력 컬렉션

**반환값**: 누적된 최종값

**예제**:
```lisp
(reduce (fn [acc x] (+ acc x)) 0 [1 2 3 4])
;; → 10

(reduce (fn [acc item]
  (+ acc (get item :price)))
 0
 [{:price 10} {:price 20} {:price 30}])
;; → 60
```

**규칙**:
- `function`의 첫 번째 파라미터는 누적값, 두 번째는 현재 요소
- 초기값 없으면 첫 요소가 초기값

---

### `(length collection)`
컬렉션의 길이 (배열, 문자열, 맵).

**파라미터**:
- `collection` (array/string/map) — 길이 측정할 값

**반환값**: 정수

**예제**:
```lisp
(length [1 2 3 4])
;; → 4

(length "hello")
;; → 5

(length {:a 1 :b 2 :c 3})
;; → 3
```

---

### `(get collection key-or-index)`
컬렉션에서 값 조회.

**파라미터**:
- `collection` (array/map/string) — 조회할 컬렉션
- `key-or-index` (keyword/number/string) — 키 또는 인덱스

**반환값**: 해당하는 값, 없으면 `nil`

**예제**:
```lisp
(get [10 20 30] 1)
;; → 20

(get {:name "Alice" :age 25} :name)
;; → "Alice"

(get "hello" 0)
;; → "h"
```

**주의**: 배열은 0-indexed

---

### `(set collection key value)`
컬렉션의 값 설정 (불변, 새로운 복사본 반환).

**파라미터**:
- `collection` (array/map) — 원본 컬렉션
- `key` (keyword/number) — 키 또는 인덱스
- `value` (any) — 설정할 값

**반환값**: 새 컬렉션 (원본 불변)

**예제**:
```lisp
(set [1 2 3] 1 99)
;; → [1 99 3]

(set {:name "Alice" :age 25} :age 26)
;; → {:name "Alice" :age 26}
```

---

### `(obj_merge map1 map2 ...)`
여러 맵 병합.

**파라미터**:
- `mapN` (map) — 병합할 맵들

**반환값**: 병합된 새 맵

**예제**:
```lisp
(obj_merge {:a 1} {:b 2} {:c 3})
;; → {:a 1 :b 2 :c 3}

(obj_merge {:name "Alice"} {:age 25})
;; → {:name "Alice" :age 25}
```

**규칙**: 뒤의 맵이 앞의 키를 덮어씀

---

### `(keys map)`
맵의 모든 키 반환.

**파라미터**:
- `map` (map) — 대상 맵

**반환값**: 키 배열

**예제**:
```lisp
(keys {:a 1 :b 2 :c 3})
;; → [:a :b :c]
```

---

### `(values map)`
맵의 모든 값 반환.

**파라미터**:
- `map` (map) — 대상 맵

**반환값**: 값 배열

**예제**:
```lisp
(values {:a 1 :b 2 :c 3})
;; → [1 2 3]
```

---

### `(range start end [step])`
숫자 범위 생성.

**파라미터**:
- `start` (number) — 시작값 (포함)
- `end` (number) — 종료값 (미포함)
- `step` (number) — 증가 간격 (기본: 1)

**반환값**: 숫자 배열

**예제**:
```lisp
(range 0 5)
;; → [0 1 2 3 4]

(range 1 10 2)
;; → [1 3 5 7 9]

(range 10 0 -1)
;; → [10 9 8 7 6 5 4 3 2 1]
```

---

### `(take n list)`
리스트의 처음 n개 요소.

**파라미터**:
- `n` (number) — 개수
- `list` (array) — 원본 배열

**반환값**: 부분 배열

**예제**:
```lisp
(take 3 [1 2 3 4 5])
;; → [1 2 3]
```

---

### `(drop n list)`
리스트의 처음 n개 요소 제외.

**파라미터**:
- `n` (number) — 건너뛸 개수
- `list` (array) — 원본 배열

**반환값**: 부분 배열

**예제**:
```lisp
(drop 2 [1 2 3 4 5])
;; → [3 4 5]
```

---

### `(sort list [compare-fn])`
배열 정렬.

**파라미터**:
- `list` (array) — 정렬할 배열
- `compare-fn` (fn) — 비교 함수 `[a b]` → 음수/0/양수 (선택사항)

**반환값**: 정렬된 새 배열

**예제**:
```lisp
(sort [3 1 4 1 5])
;; → [1 1 3 4 5]

(sort [{:id 1 :score 90} {:id 2 :score 85}]
      (fn [a b] (- (get b :score) (get a :score))))
;; → [{:id 1 :score 90} {:id 2 :score 85}]  (내림차순)
```

---

### `(reverse list)`
배열 역순.

**파라미터**:
- `list` (array) — 원본 배열

**반환값**: 역순 배열

**예제**:
```lisp
(reverse [1 2 3 4 5])
;; → [5 4 3 2 1]
```

---

### `(count coll)`
배열, 문자열, 맵의 크기. `length` 별칭.

**예제**:
```lisp
(count [1 2 3])        ;; → 3
(count "hello")        ;; → 5
(count {:a 1 :b 2})   ;; → 2  (키 개수)
```

---

### `(every? pred coll)`
컬렉션의 모든 요소가 pred를 만족하면 true.

**예제**:
```lisp
(every? even? [2 4 6])                         ;; → true
(every? (fn [u] (>= (get u :age) 18)) users)  ;; → false
```

---

### `(any? pred coll)`
하나라도 만족하면 첫 번째 매칭 값 반환, 없으면 nil.

**예제**:
```lisp
(any? even? [1 3 4 5])   ;; → 4
(any? even? [1 3 5])     ;; → nil
```

---

### `(none? pred coll)`
하나도 만족하지 않으면 true.

**예제**:
```lisp
(none? even? [1 3 5])   ;; → true
(none? even? [1 2 5])   ;; → false
```

---

### `(get-in map keys [default])`
중첩 맵에서 키 경로로 값 접근.

**예제**:
```lisp
(get-in {:user {:name "Alice" :score 95}} [:user :score])     ;; → 95
(get-in {:user {:name "Alice"}} [:user :email] "없음")         ;; → "없음"
```

---

### `(assoc-in map keys value)`
중첩 경로에 값을 세팅한 새 맵 반환 (불변).

**예제**:
```lisp
(assoc-in {:user {:score 90}} [:user :score] 100)
;; → {:user {:score 100}}
```

---

### `(update-in map keys fn & extra-args)`
중첩 경로의 값에 함수를 적용한 새 맵 반환 (불변).

**예제**:
```lisp
(update-in {:user {:score 90}} [:user :score] inc)      ;; → {:user {:score 91}}
(update-in {:user {:score 90}} [:user :score] + 5)      ;; → {:user {:score 95}}
(update-in {} [:count] (fn [x] (+ (if (nil? x) 0 x) 1)))  ;; → {:count 1}
```

---

### `(?? val1 val2 ...)`
첫 번째 nil이 아닌 값 반환. nil 병합 연산자.

**예제**:
```lisp
(?? nil nil "default")                           ;; → "default"
(?? (get user :nickname) (get user :name))       ;; 닉네임 없으면 이름
```

---

### `(comp fn1 fn2 ...)`
함수들을 오른쪽→왼쪽 순서로 합성.

**예제**:
```lisp
(define double-inc (comp inc (* 2)))
(double-inc 3)   ;; → 7  ( (inc (* 2 3)) = (inc 6) = 7 )

(map (comp str inc) [1 2 3])   ;; → ["2" "3" "4"]
```

---

## 문자열

### 멀티라인 문자열 `"""..."""`
이스케이프 없는 Raw 문자열. HTML, JSON, SQL 임베드에 적합.

```lisp
; """ 로 시작하고 """ 로 끝남 — 내부 이스케이프 없음
(define html """
<div class="container">
  <h1>Hello FreeLang</h1>
</div>
""")

; JSON 임베드
(define body """{
  "name": "Alice",
  "score": 100
}""")

; SQL 임베드
(define q """
  SELECT * FROM users
  WHERE age > 18
  ORDER BY name
""")
```

**특징**:
- 줄바꿈, 쌍따옴표, 역슬래시 모두 그대로 사용 가능
- 이스케이프 시퀀스(`\n`, `\"`)가 해석되지 않음
- 일반 문자열과 동일하게 `str`, `length`, `replace` 사용 가능

---

### `(str value1 value2 ...)`
값들을 문자열로 연결.

**파라미터**:
- `valueN` (any) — 연결할 값들 (자동 stringify)

**반환값**: 연결된 문자열

**예제**:
```lisp
(str "Hello, " "World")
;; → "Hello, World"

(str "The answer is " 42)
;; → "The answer is 42"
```

---

### `(replace string search replacement)`
문자열에서 부분 문자열 치환.

**파라미터**:
- `string` (string) — 원본 문자열
- `search` (string) — 찾을 문자열
- `replacement` (string) — 대체 문자열

**반환값**: 치환된 문자열

**예제**:
```lisp
(str-replace "hello world" "world" "AI")
;; → "hello AI"
```

**주의**: 첫 번째 일치만 치환. 전체 치환하려면 정규식 사용.

---

### `(str-split string delimiter)`
문자열을 구분자로 분할.

**파라미터**:
- `string` (string) — 원본 문자열
- `delimiter` (string) — 구분자

**반환값**: 부분 문자열 배열

**예제**:
```lisp
(str-split "apple,banana,orange" ",")
;; → ["apple" "banana" "orange"]

(str-split "a b c d" " ")
;; → ["a" "b" "c" "d"]
```

---

### `(lower string)`
문자열을 소문자로 변환.

**파라미터**:
- `string` (string) — 원본 문자열

**반환값**: 소문자 문자열

**예제**:
```lisp
(str-lower "Hello, WORLD!")
;; → "hello, world!"
```

---

### `(upper string)`
문자열을 대문자로 변환.

**파라미터**:
- `string` (string) — 원본 문자열

**반환값**: 대문자 문자열

**예제**:
```lisp
(str-upper "Hello, World!")
;; → "HELLO, WORLD!"
```

---

### `(str-trim string)`
문자열의 양쪽 공백 제거.

**파라미터**:
- `string` (string) — 원본 문자열

**반환값**: 공백 제거된 문자열

**예제**:
```lisp
(str-trim "  hello world  ")
;; → "hello world"
```

---

### `(str-includes string substring)`
문자열이 부분 문자열을 포함하는지 확인.

**파라미터**:
- `string` (string) — 원본 문자열
- `substring` (string) — 찾을 부분 문자열

**반환값**: boolean

**예제**:
```lisp
(str-includes "hello world" "world")
;; → true

(str-includes "hello world" "AI")
;; → false
```

---

## 수학

### `(+ a b [c ...])`
덧셈 (여러 인자 지원).

**파라미터**:
- `a, b, ...` (number) — 더할 숫자들

**반환값**: 합계

**예제**:
```lisp
(+ 2 3)
;; → 5

(+ 1 2 3 4)
;; → 10
```

---

### `(- a [b c ...])`
뺄셈 (여러 인자 지원).

**파라미터**:
- `a` (number) — 피감수
- `b, c, ...` (number) — 감수들

**반환값**: 차이

**예제**:
```lisp
(- 10 3)
;; → 7

(- 20 5 3 2)
;; → 10  (20 - 5 - 3 - 2)
```

---

### `(* a b [c ...])`
곱셈 (여러 인자 지원).

**파라미터**:
- `a, b, ...` (number) — 곱할 숫자들

**반환값**: 곱셈 결과

**예제**:
```lisp
(* 3 4)
;; → 12

(* 2 3 4)
;; → 24
```

---

### `(/ a b)`
나눗셈.

**파라미터**:
- `a` (number) — 피제수
- `b` (number) — 제수 (0 불가)

**반환값**: 나눗셈 결과

**예제**:
```lisp
(/ 10 2)
;; → 5

(/ 7 2)
;; → 3.5
```

---

### `(% a b)`
나머지 (modulo).

**파라미터**:
- `a` (number) — 피제수
- `b` (number) — 제수

**반환값**: 나머지

**예제**:
```lisp
(% 10 3)
;; → 1

(% 20 7)
;; → 6
```

---

### `(math-sqrt number)`
제곱근.

**파라미터**:
- `number` (number) — 양수

**반환값**: 제곱근

**예제**:
```lisp
(math-sqrt 16)
;; → 4

(math-sqrt 2)
;; → 1.414...
```

---

### `(math-pow base exponent)`
거듭제곱.

**파라미터**:
- `base` (number) — 밑
- `exponent` (number) — 지수

**반환값**: 결과

**예제**:
```lisp
(math-pow 2 3)
;; → 8

(math-pow 10 2)
;; → 100
```

---

### `(math-abs number)`
절대값.

**파라미터**:
- `number` (number) — 정수 또는 실수

**반환값**: 절대값

**예제**:
```lisp
(math-abs -5)
;; → 5

(math-abs 3.14)
;; → 3.14
```

---

### `(math-min a b [c ...])`
최솟값.

**파라미터**:
- `a, b, ...` (number) — 비교할 숫자들

**반환값**: 최솟값

**예제**:
```lisp
(math-min 5 2 8 1)
;; → 1
```

---

### `(math-max a b [c ...])`
최댓값.

**파라미터**:
- `a, b, ...` (number) — 비교할 숫자들

**반환값**: 최댓값

**예제**:
```lisp
(math-max 5 2 8 1)
;; → 8
```

---

## 타입 & 검증

### `(number? value)`
값이 숫자인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(number? 42)
;; → true

(number? "42")
;; → false
```

---

### `(string? value)`
값이 문자열인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(string? "hello")
;; → true

(string? 42)
;; → false
```

---

### `(array? value)`
값이 배열인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(array? [1 2 3])
;; → true

(array? "abc")
;; → false
```

---

### `(map? value)`
값이 맵인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(map? {:a 1})
;; → true

(map? [1 2 3])
;; → false
```

---

### `(nil? value)`
값이 nil인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(nil? nil)
;; → true

(nil? false)
;; → false
```

---

### `(function? value)`
값이 함수인지 확인.

**파라미터**:
- `value` (any) — 확인할 값

**반환값**: boolean

**예제**:
```lisp
(function? +)
;; → true

(function? 42)
;; → false
```

---

## AI & 벡터

### `(vector-add v1 v2)`
두 벡터 덧셈.

**파라미터**:
- `v1`, `v2` (array) — 같은 길이의 숫자 배열

**반환값**: 합 벡터

**예제**:
```lisp
(vector-add [1 2 3] [4 5 6])
;; → [5 7 9]
```

---

### `(vector-dot v1 v2)`
벡터 내적 (dot product).

**파라미터**:
- `v1`, `v2` (array) — 같은 길이의 숫자 배열

**반환값**: 내적 (숫자)

**예제**:
```lisp
(vector-dot [1 2 3] [4 5 6])
;; → 32  (1*4 + 2*5 + 3*6)
```

---

### `(cosine-sim v1 v2)`
코사인 유사도.

**파라미터**:
- `v1`, `v2` (array) — 임베딩 벡터

**반환값**: -1 ~ 1 범위의 유사도

**예제**:
```lisp
(cosine-sim [1 0 0] [1 0 0])
;; → 1.0  (동일 방향)

(cosine-sim [1 0 0] [0 1 0])
;; → 0.0  (수직)
```

---

### `(top-k-retrieval scored-list k)`
상위 K개 항목 반환.

**파라미터**:
- `scored-list` (array) — `{:idx idx :score score}` 맵 배열
- `k` (number) — 반환할 개수

**반환값**: 점수 내림차순 배열

**예제**:
```lisp
(top-k-retrieval [{:idx 0 :score 0.9} {:idx 1 :score 0.7} {:idx 2 :score 0.95}] 2)
;; → [{:idx 2 :score 0.95} {:idx 0 :score 0.9}]
```

---

## 비동기

### `(async expr)`
비동기 표현식 실행 (Promise 래핑).

**파라미터**:
- `expr` (expr) — 비동기로 실행할 표현식

**반환값**: Promise

**예제**:
```lisp
(async (http-get "https://api.example.com"))
```

---

### `(await promise)`
Promise 대기.

**파라미터**:
- `promise` (Promise) — 대기할 Promise

**반환값**: Promise 해결값

**예제**:
```lisp
(let [result (await (http-get "https://api.example.com"))]
  (println result))
```

---

## 파일 I/O

### `(file-read path)`
파일 읽기.

**파라미터**:
- `path` (string) — 파일 경로

**반환값**: 파일 내용 (문자열)

**예제**:
```lisp
(file-read "config.json")
;; → "{\"port\": 3000}"
```

---

### `(file-write path content)`
파일 쓰기.

**파라미터**:
- `path` (string) — 파일 경로
- `content` (string) — 쓸 내용

**반환값**: nil (성공) 또는 에러

**예제**:
```lisp
(file-write "output.txt" "Hello, World!")
```

---

### `(file-read-or path default)` — v11.6.20
파일 읽기. 파일이 없거나 오류 발생 시 기본값 반환.

**파라미터**:
- `path` (string) — 파일 경로
- `default` (any) — 파일 없거나 오류 시 반환할 기본값

**반환값**: 파일 내용 (문자열) 또는 `default`

**예제**:
```lisp
(file-read-or "config.json" "{}")
;; 파일 없으면 → "{}"

(file-read-or ".env" nil)
;; 오류 시 → nil
```

**비교**: `file-read`는 파일 없으면 에러 발생, `file-read-or`는 기본값 반환 (안전).

---

## 보안 & 이스케이프 (v11.5.3)

### `(html-escape str)`
HTML 특수 문자를 엔티티로 변환하여 XSS 공격을 방지.

**파라미터**:
- `str` (string) — 변환할 문자열

**반환값**: 이스케이프된 문자열

**예제**:
```lisp
(html-escape "<script>alert(1)</script>")
;; → "&lt;script&gt;alert(1)&lt;/script&gt;"

(let [[$name (get $req-body "name")]]
  (server-html (str "<h1>" (html-escape $name) "</h1>")))
;; 사용자 입력이 안전하게 표시됨
```

**변환 규칙**:
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&#x27;`

**주의**: HTML 콘텐츠 삽입 시 **반드시** 이 함수 사용

---

### `(js-escape str)`
JavaScript 문자열 내 특수 문자를 이스케이프하여 문법 오류 & 인젝션 방지.

**파라미터**:
- `str` (string) — 변환할 문자열

**반환값**: 이스케이프된 문자열

**예제**:
```lisp
(js-escape "He said \"Hello\"")
;; → "He said \\\"Hello\\\""

(let [[$msg (get $req-body "message")]]
  (server-html (str "<script>console.log('" (js-escape $msg) "')</script>")))
;; 변수 주입 시 문자열 경계 보호
```

**변환 규칙**:
- `\` → `\\`
- `"` → `\"`
- `'` → `\'`
- `\n` → `\n` (줄바꿈 이스케이프)
- `\r` → `\r` (캐리지 리턴)
- `\0` → `\0` (null 바이트)

**주의**: JS 문자열 리터럴(`'...'` 또는 `"..."`) 내에만 사용

---

### `(auth-csrf-token secret)`
CSRF 방지용 타임스탬프 기반 토큰 생성 (60분 유효).

**파라미터**:
- `secret` (string) — 서버 시크릿 키

**반환값**: 토큰 문자열 (형식: `"timestamp.hmac16"`)

**예제**:
```lisp
(let [[$token (auth-csrf-token "my-secret-key")]]
  (server-html (str """
    <form method="POST" action="/submit">
      <input type="hidden" name="_csrf" value="${$token}">
      <input name="data"><button>제출</button>
    </form>
  """)))
```

**특징**:
- **Stateless**: 서버 저장소 불필요
- **HMAC 검증**: SHA256 기반 서명
- **시간 제한**: 생성 후 60분 유효
- **재생 공격 방지**: 타임스탬프 + 서명

**구조**: `1748168501.db1e7cb72af9cf22`

---

### `(auth-csrf-verify token secret)`
CSRF 토큰 검증. 토큰 유효성 및 만료 시간 확인.

**파라미터**:
- `token` (string) — 검증할 토큰
- `secret` (string) — 서버 시크릿 키 (생성 시와 동일)

**반환값**: boolean (유효하면 true, 만료/불일치하면 false)

**예제**:
```lisp
;; POST 핸들러
(defn handle-submit [$req]
  (let [[$body (get $req "body")]
        [$token (get $body "_csrf")]]
    (if (auth-csrf-verify $token "my-secret-key")
      (server-json {:status "success"})
      (server-status 403 "CSRF token invalid or expired"))))
```

**검증 로직**:
1. 토큰 형식 확인 (timestamp.hmac 구조)
2. HMAC-SHA256 재계산 → 서명 비교
3. 타임스탬프 나이 확인 (60분 이내)

---

### `(server-set-cookie name value [opts])`
HTTP 응답에 안전한 쿠키 설정. HttpOnly, Secure, SameSite 플래그 자동 적용.

**파라미터**:
- `name` (string) — 쿠키명
- `value` (string) — 쿠키 값
- `opts` (map, 선택) — 옵션 맵
  - `:max_age` (number) — 유지 시간 (초)
  - `:path` (string) — 경로 (기본: `/`)
  - `:domain` (string) — 도메인
  - `:same_site` (string) — SameSite 정책 (기본: `"Strict"`, `"Lax"` 가능)

**반환값**: Set-Cookie 헤더 문자열

**예제**:
```lisp
;; 기본 사용 (HttpOnly + Secure + SameSite=Strict 자동)
(let [[$cookie (server-set-cookie "session" "token123" {:max_age 3600})]]
  (server-html-cookie "<h1>로그인 됨</h1>" $cookie))

;; 결과 헤더:
;; session=token123; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Strict

;; 커스텀 옵션
(let [[$cookie (server-set-cookie "auth" "token" {
  :max_age 86400
  :path "/app"
  :same_site "Lax"
})]]
  (server-html-cookie $html $cookie))
```

**보안 특징**:
- **HttpOnly**: JavaScript 접근 차단 (항상 활성)
- **Secure**: HTTPS 연결에서만 전송 (항상 활성)
- **SameSite=Strict**: 크로스-사이트 요청에서 전송 안 함 (CSRF 방지)

---

## HTTP & 네트워킹

### `(http-get url [options])`
HTTP GET 요청.

**파라미터**:
- `url` (string) — 요청할 URL
- `options` (map) — 선택사항 (헤더, 타임아웃 등)

**반환값**: Promise (응답 본문)

**예제**:
```lisp
(await (http-get "https://api.example.com/users"))

(await (http-get "https://api.example.com/data"
                  {:headers {:Authorization "Bearer token"}}))
```

---

### `(http-post url body [options])`
HTTP POST 요청.

**파라미터**:
- `url` (string) — 요청할 URL
- `body` (any) — 요청 본문 (자동 JSON 변환)
- `options` (map) — 선택사항

**반환값**: Promise (응답 본문)

**예제**:
```lisp
(await (http-post "https://api.example.com/users"
                   {:name "Alice" :email "alice@example.com"}))
```

---

### `(http-get-data url [headers])` — **JSON 직접 반환 (이중구조 없음)**
GET 요청 후 파싱된 JSON을 **바로** 반환. `{:status :data}` 래퍼 없음.

```lisp
; ✅ 이제 이렇게
(define user (http-get-data "https://api.example.com/users/1"))
(define name (get user "name"))

; ❌ 기존 이중구조 패턴 (불필요)
(define resp (http-get-json "https://api.example.com/users/1"))
(define user (get resp :data))
(define name (get user "name"))
```

**반환값**: 파싱된 map/array, 또는 `nil` (에러/파싱 실패)

---

### `(http-post-data url body [headers])` — **JSON 직접 반환**
POST 요청 후 파싱된 JSON을 바로 반환.

```lisp
(define result (http-post-data
  "https://api.example.com/items"
  (json-stringify {:name "Widget" :price 9.99})))
(define id (get result "id"))
```

**반환값**: 파싱된 map/array, 또는 `nil` (에러/파싱 실패)

---

## HTTP 서버 요청 파싱

서버 핸들러 내에서 `$req` 객체에서 데이터를 추출하는 함수들.

### `(server-req-json req)` — **POST body 파싱 권장**
요청 본문을 JSON 객체로 자동 파싱. Content-Type과 무관하게 작동.

```lisp
; ✅ 권장 — 한 줄로 body 파싱
(route POST "/api/users"
  (fn [$req]
    (define data (server-req-json $req))
    (define name (get data "name"))
    (json-response {:ok true :name name})))

; ❌ 이전 보일러플레이트 패턴 (불필요)
(define raw (server-req-body $req))
(define data (if (string? raw) (json-parse raw) raw))
```

**반환값**: 파싱된 map/array, 또는 `nil` (body 없음 / 파싱 실패)

---

### `(server-req-body req)`
요청 본문을 **문자열**로 반환. JSON이 이미 파싱됐으면 다시 stringify.

```lisp
(define raw (server-req-body $req))
;; → "{\"name\":\"Alice\"}"
```

---

### `(server-req-query req [key])`
쿼리 파라미터 반환. `key` 없으면 전체 map 반환.

```lisp
; GET /search?q=hello&page=2
(server-req-query $req "q")    ;; → "hello"
(server-req-query $req "page") ;; → "2"
(server-req-query $req)        ;; → {:q "hello" :page "2"}
```

---

### `(server-req-header req header-name)`
요청 헤더 값 반환.

```lisp
(server-req-header $req "authorization")
;; → "Bearer eyJ..."
(server-req-header $req "content-type")
;; → "application/json"
```

---

## 데이터베이스

### `(db-query sql [params])`
SQL 쿼리 실행 (SELECT).

**파라미터**:
- `sql` (string) — SQL 문
- `params` (array) — 파라미터 바인딩

**반환값**: 결과 행 배열

**예제**:
```lisp
(db-query "SELECT * FROM users WHERE age > ?" [18])
;; → [{:id 1 :name "Alice" :age 25} ...]
```

---

### `(db-exec sql [params])`
SQL 명령 실행 (INSERT, UPDATE, DELETE).

**파라미터**:
- `sql` (string) — SQL 문
- `params` (array) — 파라미터 바인딩

**반환값**: 영향받은 행 수

**예제**:
```lisp
(db-exec "INSERT INTO users (name, email) VALUES (?, ?)"
         ["Alice" "alice@example.com"])
;; → 1
```

---

### `(mariadb-one db sql [params])` — **단일 행 조회**
첫 번째 결과 행만 반환. 없으면 `nil`.

```lisp
(define user (mariadb-one DB "SELECT * FROM users WHERE id = ?" [42]))
(if (= user nil)
  (print "없음")
  (print (get user "name")))
```

**반환값**: map (첫 번째 행), 또는 `nil`

---

### `(mariadb-pool-one pool-id sql [params])` — **풀에서 단일 행 조회**
`mariadb-pool-query` 대신 한 행만 필요할 때 사용.

```lisp
(define DB_POOL (mariadb-pool-create "localhost" "mydb" "user" "pass"))
(define user (mariadb-pool-one DB_POOL "SELECT * FROM users WHERE email = ?" [$email]))
(define name (get user "name"))
```

**반환값**: map (첫 번째 행), 또는 `nil`

---

## 날짜/시간

### `(now-ms)`
현재 시간 (밀리초). **canonical 형태** — `now_ms`는 deprecated alias.

**반환값**: Unix timestamp (밀리초)

**예제**:
```lisp
(now-ms)
;; → 1703001600000
```

---

### `(now-iso)`
현재 시간 (ISO 8601).

**반환값**: ISO 문자열

**예제**:
```lisp
(now-iso)
;; → "2024-12-20T10:00:00Z"
```

---

## 에러 처리

### `(try expr)`
에러 캐칭 (try-catch).

**파라미터**:
- `expr` (expr) — 실행할 표현식
- `catch` (keyword) — 캐치 블록
- `error-name` (symbol) — 에러 변수명
- `error-handler` (expr) — 에러 처리 코드

**반환값**: 정상/에러 결과

**예제**:
```lisp
(try
  (/ 10 0)
  (catch err
    (println "Error:" err)
    nil))
```

---

### `(throw error-message)`
에러 발생.

**파라미터**:
- `error-message` (string) — 에러 메시지

**반환값**: 에러 발생 (실행 중단)

**예제**:
```lisp
(if (< age 18)
  (throw "Must be 18 or older"))
```

---

---

## 문자열 슬라이싱 (LIR-001 명문화)

### `(str-slice str start end)`
`str[start..end)` — **end-exclusive** index 방식.

```lisp
(str-slice "hello" 1 3)   ;; → "el"   (index 1, 2)
(str-slice "hello" 0 5)   ;; → "hello"
(str-slice $auth 7 (length $auth))  ;; Bearer 토큰 추출 패턴
```

### `(str-substr str start length)`
`str[start..start+length)` — **length** 방식. str-slice의 별칭.

```lisp
(str-substr "hello" 1 3)  ;; → "ell"  (1번부터 3글자)
(str-substr "hello" 0 5)  ;; → "hello"
```

---

### `(str-contains-in s pattern)` — v11.6.20
`(str-contains pattern s)` 의 인자 순서 alias. `(s pattern)` 순서로 호출 가능.

**파라미터**:
- `s` (string) — 검색 대상 문자열
- `pattern` (string) — 찾을 패턴

**반환값**: boolean

```lisp
(str-contains-in "hello world" "world")  ;; → true
(str-contains-in "hello world" "xyz")    ;; → false
```

**비교**: `(str-contains "world" "hello world")` — 기존 방식은 pattern 먼저.

---

### `(str-replace-in s old new)` — v11.6.20
`(str-replace old new s)` 의 인자 순서 alias. `(s old new)` 순서로 호출 가능 (replaceAll).

**파라미터**:
- `s` (string) — 원본 문자열
- `old` (string) — 찾을 문자열
- `new` (string) — 대체 문자열

**반환값**: 치환된 문자열

```lisp
(str-replace-in "a-b-c" "-" "_")  ;; → "a_b_c"
(str-replace-in "hello world" "world" "AI")  ;; → "hello AI"
```

---

## 인증 함수 반환 타입 (LIR-003 명문화)

### `(auth-sha256 data)`
SHA-256 해시.

**반환값**: hex-string (소문자 hex 64자)

```lisp
(auth-sha256 "hello")  ;; → "2cf24dba..." (64자 hex)
```

### `(auth-hmac data key)`
HMAC-SHA256.

**반환값**: hex-string (소문자 hex 64자)  
**key**: UTF-8 문자열로 처리됨.

```lisp
(auth-hmac "data" "secret")  ;; → hex-string 64자
;; ※ SigV4 key chain에서 hex 출력을 다음 key로 재사용 가능
;; ⚠️ SigV4 정식 구현 시 raw-bytes key 필요 (향후 auth-hmac-raw 예정)
```

---

## map 키 정규화 보장 (LIR-002 명문화)

FreeLang v11에서 keyword 키(`:name`)와 문자열 키(`"name"`)는 **동일하게 취급**됩니다.

```lisp
;; 아래 4가지 조합 모두 동일한 결과
(get {:key "val"} "key")    ;; → "val"
(get {:key "val"} :key)     ;; → "val"
(get {"key" "val"} "key")   ;; → "val"
(get {"key" "val"} :key)    ;; → "val"

;; contains?, has-key? 도 동일
(contains? {:key "val"} "key")   ;; → true
(has-key? {:key "val"} :key)     ;; → true
```

**권장**: map 리터럴은 keyword 키(`{:key val}`), 접근은 문자열/keyword 자유롭게.

---

## HTTP Bearer 헬퍼 (LIR-004)

### `(http-get-bearer url token)`
Bearer 토큰 인증 GET 요청.

**반환값**: `{:status N :body "..."}`

```lisp
(http-get-bearer "http://api/userinfo" $token)
;; Before: (http_request "GET" url {"Authorization" (str "Bearer " token)} "")
```

### `(http-post-bearer url body token)`
Bearer 토큰 인증 POST 요청 (Content-Type: application/json 자동 설정).

**반환값**: `{:status N :body "..."}`

```lisp
(http-post-bearer "http://api/invoke" (json-stringify {:fn "myFn"}) $token)
```

---

## 매크로 시스템 (defmacro)

FreeLang v11은 **위생적 매크로(Hygienic Macro)**를 지원한다.  
매크로는 컴파일 타임에 코드를 코드로 변환한다 — 함수와 달리 인자가 평가되기 전에 변환.

### 기본 문법

```lisp
(defmacro 이름 [$패턴변수...] 변환-템플릿)
```

### 예제 1: when (조건 참일 때만 실행)

```lisp
(defmacro when [$cond $body]
  (if $cond $body nil))

(when (> x 0) (println "양수"))
;; 확장됨 → (if (> x 0) (println "양수") nil)
```

### 예제 2: unless (조건 거짓일 때 실행)

```lisp
(defmacro unless [$cond $body]
  (if $cond nil $body))

(unless (nil? $user) (do-something $user))
```

### 예제 3: with-logging (실행 전후 로그)

```lisp
(defmacro with-logging [$name $body]
  (do
    (println (str "[START] " $name))
    $body
    (println (str "[END] " $name))))

(with-logging "db-query" (mariadb-query DB "SELECT 1" []))
```

### macroexpand — 확장 결과 확인

```lisp
(macroexpand '(when (> x 0) (println "ok")))
;; → (if (> x 0) (println "ok") nil)
```

### 주의사항

- 매크로 파라미터는 `$` 접두사 사용 (변수와 동일 규칙)
- 위생성 보장: 매크로 내부 `let` 바인딩은 gensym으로 충돌 방지
- 중첩 매크로 가능 (확장 결과를 다시 확장)
- `defmacro`는 파일 상단에 정의 권장 (사용 전 선언 필수)

---

## frequencies (S4-03, 2026-05-07~)

### `(frequencies arr)`
배열 내 각 값의 빈도수를 맵으로 반환. Clojure `frequencies`와 동일.

**파라미터**:
- `arr` (array) — 임의 타입의 배열

**반환값**: `{value: count}` — 값을 문자열 키로, 빈도수를 값으로

**예제**:
```lisp
(frequencies [1 2 1 3 2 1])
;; → {"1": 3, "2": 2, "3": 1}

(frequencies ["a" "b" "a" "c" "a"])
;; → {"a": 3, "b": 1, "c": 1}

;; 상위 빈도 찾기
(define counts (frequencies $words))
(define sorted (arr-sort-by-desc (map (fn [k] {:word k :cnt (get counts k)}) (keys counts)) "cnt"))
(get (get sorted 0) "word")   ;; → 가장 많이 등장한 단어
```

**vs arr-count-by**: `arr-count-by`는 객체 배열의 특정 필드를 기준으로 분류.
`frequencies`는 값 자체를 키로 사용.

```lisp
;; arr-count-by: 객체 배열 + 필드명 필요
(arr-count-by [{:role "admin"} {:role "user"} {:role "admin"}] "role")
;; → {"admin": 2, "user": 1}

;; frequencies: 스칼라 배열 직접 집계
(frequencies ["admin" "user" "admin"])
;; → {"admin": 2, "user": 1}
```

---

## HTTP Retry (S4-04, 2026-05-07~)

### `(http-retry url token retries?)`
GET 요청 + 5xx/네트워크 오류 시 자동 재시도.

**파라미터**:
- `url` (string) — 요청 URL
- `token` (string) — Bearer 인증 토큰
- `retries` (number, 선택) — 최대 재시도 횟수 (기본값: 3)

**반환값**: `{:status N :body "..."}`

**재시도 조건**: status 0 (네트워크 오류) 또는 5xx. 4xx는 즉시 반환.

**백오프**: 200ms × 시도 횟수 (1회=200ms, 2회=400ms, 3회=600ms)

```lisp
(http-retry "https://api/status" $token)        ;; 기본 3회
(http-retry "https://api/status" $token 5)      ;; 최대 5회

(define res (http-retry "https://api/users" $token 3))
(if (is-http-success (get res "status"))
  (json-parse (get res "body"))
  (throw "API 실패"))
```

---

### `(http-retry-post url body token retries?)`
POST 요청 + 5xx/네트워크 오류 시 자동 재시도.

**파라미터**:
- `url` (string) — 요청 URL
- `body` (string) — JSON 문자열 body
- `token` (string) — Bearer 인증 토큰
- `retries` (number, 선택) — 최대 재시도 횟수 (기본값: 3)

**반환값**: `{:status N :body "..."}`

```lisp
(http-retry-post "https://api/jobs"
  (json-stringify {:task "process" :id $id})
  $token 3)
```

---

## catch $e — category 필드 (L-04, 2026-05-07~)

`try-catch`에서 `$e` 맵에 `"category"` 필드가 추가됐다.

```lisp
(try
  (http-get-bearer $url $token)
  (catch $e
    (println (get $e "message"))    ;; 에러 메시지
    (println (get $e "category"))   ;; "IO" | "TYPE_ERROR" | "RUNTIME_ERROR" | "NOT_FOUND" | "ARITY" | "AI" | "USER" | "TIMEOUT"
    (println (get $e "line"))       ;; 발생 줄 번호
    (if (= (get $e "category") "IO")
      (println "네트워크 문제")
      (println "기타 에러"))))
```

**category 값 목록**:
| 값 | 의미 |
|----|------|
| `"IO"` | 파일/HTTP/네트워크 오류 |
| `"TYPE_ERROR"` | 타입 불일치 |
| `"RUNTIME_ERROR"` | 일반 런타임 오류 |
| `"NOT_FOUND"` | 함수/변수 미정의 |
| `"ARITY"` | 인자 수 불일치 |
| `"AI"` | AI API 오류 |
| `"USER"` | 사용자 정의 throw |
| `"TIMEOUT"` | 시간 초과 |

---

## 환경변수 (v11.6.0+)

### `(env-get key)` — nil 반환 (v11.6.0+)
환경변수 값 반환. 미정의 시 `""` 대신 **`nil` 반환** (or/env-or와 조합 가능).

```lisp
; ✅ 권장: env-or 사용
(define db-url (env-or "DATABASE_URL" "localhost:3306"))

; 직접 nil 체크
(define val (env-get "MY_VAR"))
(if (nil? val)
  "not set"
  val)

; or과 조합
(define port (or (env-get "PORT") 3000))
```

**주의**: v11.6.0 이전에는 `""` 반환 → `(or "" default)` 가 `""` 선택하는 버그 존재.

---

### `(env-or key default)`
환경변수가 없거나 빈 문자열이면 `default` 반환.

```lisp
(env-or "PORT" 3000)
;; PORT 미정의 → 3000

(env-or "API_KEY" nil)
;; API_KEY 미정의 → nil

(env-or "DB_HOST" "localhost")
;; DB_HOST="prod.db.example.com" → "prod.db.example.com"
```

---

### `(shell-env key)` — 레거시 동의어
`env-get`과 동일. 레거시 코드 호환용.

```lisp
(shell-env "HOME")  ;; → "/root"
```

---

### `.env` 자동 로드 (v11.6.20+)

인터프리터 초기화 시 `.env` 파일을 자동으로 파싱하여 환경변수로 주입.

```bash
# .env 파일 예시
DATABASE_URL=localhost:3306
API_KEY=my-secret-key
PORT=3000
```

```lisp
; .env 자동 로드 후 env-get으로 접근 가능
(define db-url (env-or "DATABASE_URL" "localhost"))
```

**비활성화**: `FL_NO_AUTO_ENV=1` 환경변수 설정 시 자동 로드 건너뜀.

---

## 프로세스 & 쉘 (v11.6.20+)

### `(shell-exec-stdout cmd)` — v11.6.20
셸 명령을 실행하고 stdout 문자열을 직접 반환. 실패 시 `nil`.

**파라미터**:
- `cmd` (string) — 실행할 쉘 명령

**반환값**: stdout 문자열, 실패/오류 시 `nil`

```lisp
(shell-exec-stdout "git log --oneline -3")
;; → "abc1234 first commit\ndef5678 second commit\n..."

(shell-exec-stdout "cat /nonexistent")
;; → nil (오류 시)
```

**비교**: `shell-exec`는 `{:stdout :stderr :code :ok}` 구조체 반환. `shell-exec-stdout`는 stdout 문자열만 직접 반환.

---

## 빈값 체크 (v11.6.20+)

### `(empty? x)` — v11.6.20
배열, 문자열, 맵, nil 모두 빈값 체크. `(= arr [])` 참조 비교 버그 대체.

**파라미터**:
- `x` (any) — 검사할 값

**반환값**: boolean

```lisp
(empty? [])          ;; → true
(empty? "")          ;; → true
(empty? {})          ;; → true
(empty? nil)         ;; → true
(empty? [1 2 3])     ;; → false
(empty? "hello")     ;; → false
```

**비교**: `(= arr [])` 는 참조 비교라 빈 배열도 `false` 반환할 수 있음. `empty?` 사용 권장.

---

### `(array-empty? x)` — v11.6.20
배열만 빈값 체크. 배열이 아닌 경우 `false`.

**파라미터**:
- `x` (any) — 검사할 값

**반환값**: boolean

```lisp
(array-empty? [])        ;; → true
(array-empty? [1 2 3])   ;; → false
(array-empty? "")        ;; → false  (문자열은 false)
(array-empty? nil)       ;; → false  (nil은 false)
```

---

## 캐시 (v11.6.20+)

### `(cache-set-ttl key val ttl)` — v11.6.20
`cache-set` 의 `(key value ttl)` 순서 alias.

**파라미터**:
- `key` (string) — 캐시 키
- `val` (any) — 캐시할 값
- `ttl` (number) — 유효시간 (밀리초)

**반환값**: nil

```lisp
(cache-set-ttl "user:123" $user 60000)
;; 60초 TTL로 캐시

(cache-set-ttl "rate-limit:ip" $count 1000)
;; 1초 TTL
```

**비교**: `cache-set` 은 `(ttl key value)` 순서 (기존). `cache-set-ttl` 은 `(key value ttl)` 순서 (직관적).

---

## cond — :else 포함 3가지 문법 (LIR-006, 2026-05-08~)

`cond`의 전통 방식과 편의 문법 3가지.

### 형태 1 — `[true ...]` (전통)

```lisp
(cond
  [(= $x 1) "one"]
  [(= $x 2) "two"]
  [true "default"])
```

### 형태 2 — `:else` (권장)

```lisp
(cond
  [(= $x 1) "one"]
  [(= $x 2) "two"]
  [:else "default"])
```

`true`와 완전히 동일. 의도를 명시적으로 표현.

### 형태 3 — `else` 심볼

```lisp
(cond
  [(> $x 0) "양수"]
  [(< $x 0) "음수"]
  [else "영"])
```

세 가지 모두 동작. `:else` 사용 권장.

---

## """ 멀티라인 문자열 (triple-quote, 2026-05-08~)

삼중 따옴표로 여러 줄 문자열을 그대로 작성 가능. HTML/SQL/JSON 작성 시 유용.

```lisp
;; 기본
(let [[$html """
<div>
  <h1>제목</h1>
  <p>내용</p>
</div>
"""]]
  (server-html $html))

;; 변수 보간
(let [[$name "Kim"] [$count 5]]
  (server-html """
    <h1>안녕 ${$name}</h1>
    <p>항목 수: ${$count}</p>
  """))

;; SQL
(db-query DB_PATH """
  SELECT data FROM crm_events
  WHERE json_extract(data,'$.entity_id') = ?
    AND json_extract(data,'$.event_type') = 'STATE_TRANSITION'
  ORDER BY json_extract(data,'$.event_ms') DESC
  LIMIT 1
""" [$entity-id])
```

---

## server-req-json (2026-05-08~)

POST body 자동 JSON 파싱. `server-req-body` + `json-parse` 조합 대체.

```
(server-req-json req) → map | nil
```

- Content-Type 무관하게 body 파싱 시도
- 이미 객체로 파싱된 경우 그대로 반환
- 파싱 실패 시 `nil`

```lisp
;; Before
(let [[$body (json-parse (server-req-body $req))]] ...)

;; After
(let [[$body (server-req-json $req)]] ...)

;; 예제
(defn handle-create [$req]
  (let [[$body (server-req-json $req)]
        [$name (get $body "name")]]
    (if (nil? $name)
      (res-err 400 "name 필수")
      (res-ok {:created $name}))))
```

> `server-req-body` → 문자열 반환 / `server-req-json` → 파싱된 맵 반환
---

## v11.6.20~21 신규 함수 (2026-05-10)

### `(file-read-or path default)` — 파일 안전 읽기

파일이 없거나 오류 시 기본값 반환. 설정 파일 로드 등에 유용.

```lisp
(file-read-or "config.json" "{}")
(file-read-or "/tmp/cache.txt" "")
```

**반환값**: 파일 내용 문자열 | default 값

---

### `(shell-exec-stdout cmd)` — shell stdout 직접 반환

shell 명령 실행 후 stdout 문자열만 직접 반환 (trim 포함).

```lisp
(shell-exec-stdout "git log --oneline -3")
(shell-exec-stdout "ls -la")
```

**반환값**: stdout 문자열 | 오류 시 nil

---

### `(empty? val)` — nil/빈 값 안전 검사

nil, 빈 문자열, 빈 배열 모두 true 반환.

```lisp
(empty? nil)   ; → true
(empty? "")    ; → true
(empty? [])    ; → true
(empty? "hi")  ; → false
(empty? [1])   ; → false
```

### `(array-empty? arr)` — 배열 전용 empty 검사

```lisp
(array-empty? [])   ; → true
(array-empty? [1])  ; → false
```

---

### `(str-contains-in s pattern)` — 문자열 포함 alias

`str-contains`의 인자 순서 alias. (s pattern) 순서로 호출.

```lisp
(str-contains-in "hello world" "world")  ; → true
```

### `(str-replace-in s old new)` — 문자열 치환 alias

`str-replace`의 인자 순서 alias. (s old new) 순서로 호출.

```lisp
(str-replace-in "hello" "ell" "ELL")  ; → "hELLo"
```

### `(cache-set-ttl key val ttl)` — 캐시 저장 alias

`cache-set`의 인자 순서 alias. (key value ttl) 순서로 호출.

```lisp
(cache-set-ttl "user:1" user-data 3600)  ; 1시간 캐시
```

---

### try/catch 완전 구현 (v11.6.21)

error object 구조:
```lisp
{
  "type"    "RuntimeError"   ; 에러 타입 (정규화됨)
  "message" "원본 메시지"     ; 파싱된 원본 메시지
  "line"    N                ; 발생 라인
  "stack"   "..."            ; JS 스택 트레이스
}
```

```lisp
(try
  (error "something went wrong")
  (catch $e
    (get $e "message")))  ; → "something went wrong"

(try
  (try (error "inner") (catch $e "caught-inner"))
  (catch $e "caught-outer"))  ; → "caught-inner"
```

---

## v11.6.x 신규 / 확인된 기능 (2026-05-08)

### `(-> x f1 f2 f3)` — 스레딩 (Thread-first)

함수 중첩 대신 왼쪽→오른쪽으로 읽히는 파이프라인.

```lisp
; 기존 중첩 표현
(str-upper (str-trim (str-replace $s " " "_")))

; -> 스레딩
(-> $s
    (str-replace " " "_")
    str-trim
    str-upper)

; 인자가 있는 함수는 첫 번째 인자 위치에 삽입됨
(-> 5 (+ 1) (* 2) (- 3))  ; → ((5+1)*2)-3 = 9
```

`->>` (thread-last)도 지원 — 마지막 인자 위치에 삽입.

---

### `(if-let [$x expr] then else)` — 평탄형 (v11.6.6+)

nil 체크와 바인딩을 한 번에. 기존 이중 괄호 `[[x expr]]`도 유지.

```lisp
; ✅ v11.6.6 평탄형 (권장)
(if-let [$user (db-query-one DB "SELECT * FROM users WHERE id=?" [$id])]
  (server-json $user)
  (server-json {:error "not found"} 404))

; 구버전 이중 괄호 (하위 호환)
(if-let [[user (db-query-one DB "..." [$id])]]
  (server-json user)
  (server-json {:error "not found"} 404))
```

**반환값**: `then` 결과 (truthy) 또는 `else` 결과 (nil/false)

---

### `(some? x)` / `(not-nil? x)` — nil 아님 확인 (v11.6.6+)

```lisp
; 기존
(if (not (nil? $user)) ...)

; v11.6.6
(if (some? $user) ...)
(if (not-nil? $user) ...)

; filter와 함께
(filter some? $list)  ; nil 제거
```

**반환값**: boolean

---

### `(assoc m key val)` / `(dissoc m key)` — 맵 키 추가/삭제

불변 — 원본 수정 없이 새 맵 반환.

```lisp
(define m {:name "Alice" :age 25})

(assoc m :email "alice@example.com")
; → {:name "Alice" :age 25 :email "alice@example.com"}

(dissoc m :age)
; → {:name "Alice"}

; 체이닝
(-> m
    (assoc :email "alice@example.com")
    (dissoc :age))
```

---

### `(defn f [$a [$b default]])` — 기본값 인자 (v11.6.6+)

미전달 인자에 기본값 자동 적용. 정의 시점 평가 (Python 스타일).

```lisp
(defn paginate [$sql [$page 1] [$limit 20]]
  (str $sql " LIMIT " $limit " OFFSET " (* (- $page 1) $limit)))

(paginate "SELECT * FROM users")       ; page=1, limit=20
(paginate "SELECT * FROM users" 2)     ; page=2, limit=20
(paginate "SELECT * FROM users" 3 50)  ; page=3, limit=50

; 표현식도 가능
(defn with-ts [$data [$ts (now-ms)]]
  (assoc $data :created_at $ts))
```

**규칙**: 기본값 인자는 반드시 오른쪽에 몰아서 선언.

---

### `(return expr)` — 함수 내 early exit (v11.6.5+)

try/catch 블록을 통과해 함수 경계까지 전파.

```lisp
(defn find-user [$id]
  (when (= $id 0) (return nil))
  (when (< $id 0) (return {:error "invalid id"}))
  (db-query-one DB "SELECT * FROM users WHERE id=?" [$id]))

; try 안에서도 작동
(defn safe-parse [$json]
  (try
    (when (nil? $json) (return nil))
    (json-parse $json)
    (catch $e nil)))
```

---

### `(mariadb-transaction db stmts)` — 원자적 다중 실행

여러 SQL을 BEGIN/COMMIT으로 묶어 원자적 실행. 실패 시 ROLLBACK.

```lisp
; CLI 모드
(define result
  (mariadb-transaction DB
    [{:sql "INSERT INTO orders (user_id, total) VALUES (?, ?)"
      :params [$user_id $total]}
     {:sql "UPDATE inventory SET stock = stock - ? WHERE item_id = ?"
      :params [$qty $item_id]}]))

(if (get result :ok)
  (server-json {:success true})
  (server-json {:error (get result :error)} 500))
```

**반환값**: `{:ok true :count N}` 또는 `{:ok false :error "..."}`

---

### `(mariadb-pool-transaction pool-id stmts)` — 풀 트랜잭션

```lisp
(define POOL (mariadb-pool-create "localhost" "mydb" "user" "pass"))

(mariadb-pool-transaction POOL
  [{:sql "UPDATE accounts SET balance = balance - ? WHERE id = ?"
    :params [$amount $from_id]}
   {:sql "UPDATE accounts SET balance = balance + ? WHERE id = ?"
    :params [$amount $to_id]}])
```

---

### 상호 재귀 (Mutual Recursion) — declare 불필요

FreeLang은 함수 본체를 **호출 시점**에 평가합니다. 두 함수가 서로 참조해도 **호출 전에 둘 다 정의**되면 정상 작동합니다.

```lisp
; 정의 순서 무관 — 호출 전에 둘 다 정의되면 됨
(defn my-even? [$n]
  (if (= $n 0) true (my-odd? (- $n 1))))

(defn my-odd? [$n]
  (if (= $n 0) false (my-even? (- $n 1))))

(my-even? 10)  ; → true
(my-odd? 7)    ; → true
```

**주의**: `my-even?` 정의 시점에 `my-odd?`는 없어도 됨. 실제 호출 시 조회.

---

### `(http-get-data url [headers])` / `(http-post-data url body [headers])` — JSON 직접 반환 (v11.6.3+)

`{:status :data}` 이중구조 없이 파싱된 JSON 바로 반환.

```lisp
; 기존 (이중구조)
(define resp (http-get-json "https://api.example.com/user/1"))
(define user (get resp :data))

; v11.6.3+
(define user (http-get-data "https://api.example.com/user/1"))
(define name (get user "name"))

; POST
(define result (http-post-data
  "https://api.example.com/items"
  (json-stringify {:name "Widget"})))
```

**반환값**: 파싱된 map/array, 또는 `nil` (에러/파싱 실패)

---

## "내가 쓴다면?" 개선 Batch 1-7 (2026-05-10)

### 문자열 신규/수정

#### `(str-blank? s)` → boolean
nil, 빈 문자열, 공백만 있는 문자열 모두 `true` 반환.
```lisp
(str-blank? nil)    ; → true
(str-blank? "")     ; → true
(str-blank? "  ")   ; → true
(str-blank? "hi")   ; → false
```

#### `(str-split s sep [limit])` — limit 지원 수정
`limit` 인자를 주면 최대 `limit`개로 분할 (기존: 무시됨).
```lisp
(str-split "a,b,c,d" "," 2)  ; → ["a" "b,c,d"]
(str-split "a,b,c,d" "," 3)  ; → ["a" "b" "c,d"]
```

---

### 맵/객체 신규

#### `(hash-map k1 v1 k2 v2 ...)` → map
```lisp
(hash-map "x" 1 "y" 2)           ; → {"x": 1, "y": 2}
(hash-map :name "Alice" :age 30)  ; → {"name": "Alice", "age": 30}
```

---

### 타입 시스템

#### `(type-of v)` → string (FL-friendly)
JS `typeof` 대신 FreeLang 관점의 타입명.
```lisp
(type-of nil)     ; → "nil"    (JS: "object")
(type-of [1 2])   ; → "array"  (JS: "object")
(type-of {"a" 1}) ; → "map"    (JS: "object")
(type-of 42)      ; → "number"
(type-of "hi")    ; → "string"
(type-of true)    ; → "boolean"
(type-of println) ; → "function"
```

#### `(integer? v)` / `(float? v)` → boolean
```lisp
(integer? 42)    ; → true    (float? 42 → false)
(float? 3.14)    ; → true    (integer? 3.14 → false)
```

#### `(vector? v)` / `(array? v)` → boolean
```lisp
(vector? [1 2 3])  ; → true
(vector? {"a" 1})  ; → false
```

---

### 수학 신규

#### `(quot a b)` / `(rem a b)` / `(int v)`
```lisp
(quot -17 5)   ; → -3   (0 방향 truncate, floor는 -4)
(rem -17 5)    ; → -2   (피제수 부호 따름, % 는 양수)
(int -3.7)     ; → -3   (truncate, floor는 -4)
```

---

### 컬렉션 신규

#### `(sorted? coll)` / `(conj coll ...)` / `(flatten-1 coll)` / `(partition-by fn coll)`
```lisp
(sorted? [1 2 3])                               ; → true
(conj [1 2] 3 4)                                ; → [1 2 3 4]
(flatten-1 [[1 [2]] [3]])                       ; → [1 [2] 3]
(partition-by even? [1 1 2 2 3])                ; → [[1 1] [2 2] [3]]
```

#### `(reduce fn coll)` — 2-arg form / `(dissoc m k1 k2 ...)` — 다중 키
```lisp
(reduce + [1 2 3 4 5])                           ; → 15
(dissoc {"a" 1 "b" 2 "c" 3} "a" "b")            ; → {"c": 3}
```

---

### 난수

#### `(rand)` / `(rand-int n)` / `(rand-int min max)`
```lisp
(rand)          ; → 0.0~1.0
(rand-int 10)   ; → 0~9
(rand-int 5 15) ; → 5~14
```

---

### 제어 흐름 신규: `when-not` / `dotimes` / `case` / `for`
```lisp
(when-not (empty? errors) (println "실패"))

(dotimes [i 3] (println i))   ; 0 1 2

(case status
  "active" "활성"
  "비활성")   ; default

(for [x [1 2 3 4 5 6] :when (= (% x 2) 0)] (* x x))
; → [4 16 36]
```

---

## 참고

- **All functions are deterministic** — 같은 입력은 항상 같은 출력
- **Immutable by default** — 컬렉션은 불변 (새 복사본 반환)
- **Type coercion** — 자동 타입 변환 지원 (필요시 명시적 타입 체크 권장)
- **Error handling** — try-catch로 모든 에러 처리 가능


---

## stdlib 확장 모듈 (load 필요)

### validate.fl — 데이터 검증

```lisp
(load "stdlib/validate.fl")

(validate-email "a@b.com")         ; → true
(validate-url "https://x.com")     ; → true
(validate-min-length "hi" 5)       ; → false
(validate-max-length "hi" 10)      ; → true
(validate-range 3 1 10)            ; → true
(validate-integer 5)               ; → true
(validate-positive 1)              ; → true
(validate-non-negative 0)          ; → true

;; 빈 필드 검출
(validate-required {:name "" :age nil} ["name" "age"])  ; → ["name" "age"]

;; 스키마 검증
(validate-schema
  {:name "Kim" :email "bad" :age 200}
  {:name  {:required true :min-length 2}
   :email {:required true :email true}
   :age   {:type "number" :max 150}})
; → {:ok false :errors [{:field "email" :message "email must be a valid email"}
;                       {:field "age"   :message "age must be <= 150"}]}
```

### cache.fl — LRU+TTL 캐시

```lisp
(load "stdlib/cache.fl")

;; 핸들 기반
(define ch (cache-create 100))
(cache-set ch "key" value)           ; 영구 저장
(cache-set ch "key" value 60000)     ; TTL 60초(ms)
(cache-get ch "key")                 ; → value or nil
(cache-has ch "key")                 ; → bool
(cache-del ch "key")
(cache-clear ch)
(cache-stats ch)   ; → {:size N :hits N :misses N :hit-rate N}

;; get-or-set 헬퍼
(cache-get-or-set ch "key" (fn [] (fetch-data)))    ; 미스 시 fn 호출
(cache-get-or-set-ttl ch "key" 30000 (fn [] data))  ; TTL 30초

;; 글로벌 모드 (핸들 없이 싱글톤)
(cache-set "key" value 60)   ; TTL 60초(초 단위)
(cache-get "key")
(cache-del "key")
```

### log.fl — 구조화 로그

```lisp
(load "stdlib/log.fl")

(log-info  "user.login"  {:userId 1 :ip "1.2.3.4"})
(log-warn  "rate.limit"  {:current 90 :limit 100})
(log-error "db.fail"     {:err "timeout"})
(log-debug "cache.miss"  {:key "x"})   ; FL_DEBUG=1 시만 출력

;; 파일 기록
(log-to-file! "app.log")   ; 이후 모든 로그가 파일에도 기록됨

;; 출력 형식 (JSON 1줄)
; {"ts":1234567890,"level":"INFO","event":"user.login","ctx":{"userId":1}}
```

---

## TCP 빌트인 (S41.5, v11.7.x)

Raw TCP 소켓 레벨 서버/클라이언트. HTTP 프록시, 게이트웨이, 커스텀 프로토콜 구현에 사용.

### tcp-server-raw

```lisp
; (tcp-server-raw port "handler-name") → "ok"
; handler 이름으로 등록된 함수가 이벤트 맵을 받음:
;   ("connect" conn-id "")   — 클라이언트 연결
;   ("data"    conn-id chunk) — 데이터 수신 (바이너리 가능)
;   ("close"   conn-id "")   — 연결 종료

(defn on-client [event conn-id data]
  (cond
    [(= event "connect") (println (str "연결: " conn-id))]
    [(= event "data")    (tcp-write conn-id (str "echo: " data))]
    [(= event "close")   (println (str "종료: " conn-id))]))

(tcp-server-raw 9000 "on-client")
```

### tcp-outbound

```lisp
; (tcp-outbound host port "handler-name") → upstream-id (즉시 반환, 연결 비동기)
; handler가 받는 이벤트: "connect" / "data" / "close" / "error"

(define up-id (tcp-outbound "api.example.com" 80 "on-upstream"))

(defn on-upstream [event conn-id data]
  (cond
    [(= event "connect") (tcp-write conn-id "GET / HTTP/1.0\r\n\r\n")]
    [(= event "data")    (println data)]
    [(= event "close")   (println "upstream closed")]))
```

### tcp-write

```lisp
; (tcp-write conn-id data) → "ok" | "error" | "not-found"
; 인바운드(tcp-server-raw)와 아웃바운드(tcp-outbound) 공용

(tcp-write conn-id "HTTP/1.1 200 OK\r\n\r\nHello")
(tcp-write up-id   (str "GET " path " HTTP/1.0\r\n\r\n"))
```

### tcp-drop

```lisp
; (tcp-drop conn-id) → "ok" | "not-found"
; 연결 강제 종료 (인바운드/아웃바운드 공용)

(tcp-drop conn-id)
```

### 주의사항

- `tcp-server-raw`는 HTTP 라인 단위가 아닌 raw chunk를 그대로 전달
- `tcp-server-start` (기존 HTTP 내장 서버)와 혼용 가능
- `tcp-outbound`는 즉시 ID를 반환하고 연결은 이벤트 큐를 통해 비동기 처리
- 핸들러 이름은 문자열로 전달 (글로벌 함수명)
```
