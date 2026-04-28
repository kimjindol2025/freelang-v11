# FreeLang v11 표준 라이브러리 완전 참조

**대상**: AI 에이전트 & 개발자  
**최종 업데이트**: 2026-04-25

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
- [HTTP & 네트워킹 (HTTP & Network)](#http--네트워킹)
- [데이터베이스 (Database)](#데이터베이스)
- [날짜/시간 (Date & Time)](#날짜시간)
- [에러 처리 (Error Handling)](#에러-처리)

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

### `(let [[symbol value ...] ...] body)`
로컬 바인딩 (변수 정의).

**파라미터**:
- `bindings` ([[symbol value] ...]) — 이름-값 쌍 배열
- `body` (expr) — 바인딩 내에서 실행

**반환값**: `body`의 결과

**예제**:
```lisp
(let [[x 5] [y 10]]
  (+ x y))
;; → 15

(let [[name "Alice"]
      [greeting (+ "Hello, " name)]]
  (println greeting))
;; 출력: Hello, Alice
```

**규칙**:
- 바인딩은 순서대로 평가됨 (후속 바인딩에서 이전 값 참조 가능)
- 스코프는 `let` 블록 내부로 제한

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

## 문자열

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

## 날짜/시간

### `(now-ms)`
현재 시간 (밀리초).

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

## 참고

- **All functions are deterministic** — 같은 입력은 항상 같은 출력
- **Immutable by default** — 컬렉션은 불변 (새 복사본 반환)
- **Type coercion** — 자동 타입 변환 지원 (필요시 명시적 타입 체크 권장)
- **Error handling** — try-catch로 모든 에러 처리 가능
