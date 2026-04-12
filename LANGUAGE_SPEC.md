# FreeLang v9 언어 명세

> AI 전용 S-expression 언어 | 버전: 9.0 | 작성: 2026-04-12

---

## 1. 개요

FreeLang v9는 Claude Code(AI)가 만들고 사용하는 언어다.
인간 친화적 문법이 아닌 **AI 추론 패턴에 최적화**된 구조를 우선한다.

- **기반**: S-expression (Lisp 계열)
- **타이핑**: 동적 타입 (점진적 타입 어노테이션 지원)
- **실행**: TypeScript 인터프리터 (v9 VM 컴파일 예정)
- **AI 네이티브**: search/learn/reason 블록 내장

---

## 2. 기본 문법

### 2.1 리터럴

```lisp
; 숫자
42          ; 정수
3.14        ; 실수
-100        ; 음수

; 문자열
"hello"
"여러 줄\n가능"

; 불리언
true
false

; null
null

; 키워드 (심볼)
:name
:status
:ok
```

### 2.2 변수

```lisp
; 변수 참조: $ 접두사
$name
$user-id
$result

; 정의
(define x 42)
(define name "FreeLang")

; 변경 (set!)
(set! x 100)
```

### 2.3 컬렉션

```lisp
; 배열
[1 2 3]
["a" "b" "c"]
[1 "mixed" true]

; 맵 (키:값)
{:name "Alice" :age 30}
{:status :ok :data [1 2 3]}

; 중첩
{:user {:name "Bob" :scores [10 20 30]}}
```

### 2.4 S-expression (함수 호출)

```lisp
; (함수명 인자1 인자2 ...)
(+ 1 2)           ; → 3
(str "hello" " " "world")  ; → "hello world"
(length [1 2 3])  ; → 3
```

---

## 3. 특수 폼 (22개)

### 3.1 define — 변수/함수 정의

```lisp
; 변수 정의
(define x 10)
(define greeting "안녕")

; 함수 정의 (단축 형식)
(define add [$a $b] (+ $a $b))

; fn으로 정의
(define double (fn [$x] (* $x 2)))
```

### 3.2 fn — 익명 함수 (클로저)

```lisp
(fn [$x] (* $x $x))
(fn [$a $b] (+ $a $b))

; 고차 함수
(define make-adder
  (fn [$n] (fn [$x] (+ $x $n))))

(define add10 (make-adder 10))
(add10 5)  ; → 15
```

### 3.3 let — 지역 바인딩

```lisp
(let [[$x 10]
      [$y 20]]
  (+ $x $y))  ; → 30

; 순차 바인딩
(let [[$a 5]
      [$b (* $a 2)]]
  $b)  ; → 10
```

### 3.4 if / cond — 조건

```lisp
; if
(if (> $x 0) "양수" "음수 또는 0")

; cond (다중 조건)
(cond
  (> $x 0) "양수"
  (< $x 0) "음수"
  true "0")
```

### 3.5 do / begin — 순차 실행

```lisp
(do
  (println "첫 번째")
  (println "두 번째")
  42)  ; 마지막 값 반환
```

### 3.6 loop / recur — 꼬리 재귀 루프

```lisp
; (loop [바인딩들] 바디...)
(loop [$i 0 $acc 0]
  (if (> $i 5)
    $acc
    (recur (+ $i 1) (+ $acc $i))))
; → 15 (0+1+2+3+4+5)
```

### 3.7 set! — 가변 업데이트

```lisp
(define counter 0)
(set! counter (+ $counter 1))
; counter → 1

; 함수 내에서 외부 스코프 수정
(define total 0)
(define add! (fn [$n] (set! total (+ $total $n))))
(add! 10)
(add! 5)
; total → 15
```

### 3.8 import — 모듈 가져오기

```lisp
; 전체 import (네임스페이스)
(import list :from "./fl-list-utils.fl")
(list:sum [1 2 3])  ; → 6

; 선택적 import
(import [sum mean] :from "./fl-list-utils.fl")
(sum [1 2 3])  ; → 6
```

### 3.9 try / catch / throw — 에러 처리

```lisp
(try
  (/ 10 0)
  (catch [$e]
    (println "에러:" $e)
    -1))

; throw
(throw "커스텀 에러")
(throw {:type :not-found :msg "사용자 없음"})
```

### 3.10 match — 패턴 매칭

```lisp
(match $value
  [42] "정확히 42"
  [$x (when (> $x 0))] (str "양수: " $x)
  [{:status :ok :data $d}] (process $d)
  [_] "기타")
```

### 3.11 async / await — 비동기

```lisp
(async fetch-data [$url]
  (define $resp (await (http-get $url)))
  (json-parse $resp))

(await (fetch-data "https://api.example.com"))
```

### 3.12 while — 명령형 루프

```lisp
(while (< $i 10)
  (println $i)
  (set! i (+ $i 1)))
```

### 3.13 and / or — 단락 평가 논리

```lisp
(and true false)   ; → false (short-circuit)
(or false 42)      ; → 42
(and $x (> $x 0))  ; $x가 null이면 false 반환
```

### 3.14 map (3-인자 형식) — 컴프리헨션

```lisp
(map [1 2 3 4 5] [$x] (* $x $x))
; → [1 4 9 16 25]
```

---

## 4. FUNC 블록 문법

```lisp
; 기본 형식
[FUNC 함수명
  :params [$param1 $param2]
  :body (표현식)]

; 예시
[FUNC greet
  :params [$name]
  :body (str "안녕, " $name "!")]

; 타입 어노테이션 (Phase 60 이후)
[FUNC add-tax
  :params [$price :int $rate :float]
  :returns :float
  :body (* $price (+ 1.0 $rate))]
```

---

## 5. 내장 함수 (94개)

### 5.1 산술

| 함수 | 설명 | 예시 |
|------|------|------|
| `(+ a b ...)` | 덧셈 | `(+ 1 2 3)` → 6 |
| `(- a b)` | 뺄셈 | `(- 10 3)` → 7 |
| `(* a b ...)` | 곱셈 | `(* 2 3 4)` → 24 |
| `(/ a b)` | 나눗셈 | `(/ 10 3)` → 3.33 |
| `(% a b)` | 나머지 | `(% 10 3)` → 1 |
| `(abs n)` | 절대값 | `(abs -5)` → 5 |
| `(floor n)` | 내림 | `(floor 3.7)` → 3 |
| `(ceil n)` | 올림 | `(ceil 3.2)` → 4 |
| `(round n)` | 반올림 | `(round 3.5)` → 4 |
| `(sqrt n)` | 제곱근 | `(sqrt 16)` → 4 |
| `(pow a b)` | 거듭제곱 | `(pow 2 10)` → 1024 |
| `(max a b)` | 최대값 | `(max 3 7)` → 7 |
| `(min a b)` | 최소값 | `(min 3 7)` → 3 |
| `(random)` | 0~1 난수 | `(random)` → 0.73... |

### 5.2 비교

| 함수 | 설명 |
|------|------|
| `(= a b)` | 동등 비교 |
| `(!= a b)` | 불동등 |
| `(< a b)` | 작다 |
| `(> a b)` | 크다 |
| `(<= a b)` | 작거나 같다 |
| `(>= a b)` | 크거나 같다 |

### 5.3 문자열

| 함수 | 설명 | 예시 |
|------|------|------|
| `(str ...)` | 문자열 연결 | `(str "a" "b")` → "ab" |
| `(length s)` | 길이 | `(length "hello")` → 5 |
| `(upper s)` | 대문자 | `(upper "hi")` → "HI" |
| `(lower s)` | 소문자 | `(lower "HI")` → "hi" |
| `(trim s)` | 공백 제거 | `(trim " hi ")` → "hi" |
| `(substring s start end)` | 부분 문자열 | `(substring "hello" 1 3)` → "el" |
| `(split s delim)` | 분리 | `(split "a,b" ",")` → ["a" "b"] |
| `(replace s from to)` | 치환 | `(replace "hi" "h" "H")` → "Hi" |
| `(contains? s sub)` | 포함 여부 | `(contains? "hello" "ell")` → true |
| `(starts-with? s pre)` | 시작 여부 | `(starts-with? "hello" "he")` → true |
| `(ends-with? s suf)` | 끝 여부 | `(ends-with? "hello" "lo")` → true |
| `(index-of s sub)` | 위치 | `(index-of "hello" "l")` → 2 |
| `(char-at s i)` | 문자 | `(char-at "hi" 0)` → "h" |

### 5.4 배열

| 함수 | 설명 | 예시 |
|------|------|------|
| `(list ...)` | 배열 생성 | `(list 1 2 3)` → [1 2 3] |
| `(first arr)` | 첫 원소 | `(first [1 2 3])` → 1 |
| `(rest arr)` | 나머지 | `(rest [1 2 3])` → [2 3] |
| `(last arr)` | 마지막 | `(last [1 2 3])` → 3 |
| `(length arr)` | 길이 | `(length [1 2 3])` → 3 |
| `(get arr i)` | 인덱스 접근 | `(get [1 2 3] 1)` → 2 |
| `(append arr val)` | 원소 추가 | `(append [1 2] 3)` → [1 2 3] |
| `(concat a b)` | 배열 합치기 | `(concat [1 2] [3 4])` → [1 2 3 4] |
| `(reverse arr)` | 역순 | `(reverse [1 2 3])` → [3 2 1] |
| `(slice arr s e)` | 부분 배열 | `(slice [1 2 3 4] 1 3)` → [2 3] |
| `(map arr fn)` | 변환 | `(map [1 2 3] (fn [$x] (* $x 2)))` → [2 4 6] |
| `(filter arr fn)` | 필터 | `(filter [1 2 3] (fn [$x] (> $x 1)))` → [2 3] |
| `(reduce arr init fn)` | 누적 | `(reduce [1 2 3] 0 (fn [$a $x] (+ $a $x)))` → 6 |
| `(find arr fn)` | 찾기 | `(find [1 2 3] (fn [$x] (= $x 2)))` → 2 |
| `(sort arr)` | 정렬 | `(sort [3 1 2])` → [1 2 3] |
| `(unique arr)` | 중복 제거 | `(unique [1 2 1 3])` → [1 2 3] |
| `(flatten arr)` | 평탄화 | `(flatten [[1 2] [3 4]])` → [1 2 3 4] |

### 5.5 맵

| 함수 | 설명 | 예시 |
|------|------|------|
| `(get m key)` | 값 가져오기 | `(get {:a 1} :a)` → 1 |
| `(assoc m k v)` | 키-값 추가/수정 | `(assoc {:a 1} :b 2)` → {:a 1 :b 2} |
| `(dissoc m key)` | 키 제거 | `(dissoc {:a 1 :b 2} :a)` → {:b 2} |
| `(map-set m k v)` | 맵 set | `(map-set {} :x 42)` → {:x 42} |

### 5.6 타입 검사

| 함수 | 설명 |
|------|------|
| `(string? v)` | 문자열 여부 |
| `(number? v)` | 숫자 여부 |
| `(bool? v)` | 불리언 여부 |
| `(array? v)` | 배열 여부 |
| `(map? v)` | 맵 여부 |
| `(null? v)` | null 여부 |
| `(zero? n)` | 0 여부 |
| `(pos? n)` | 양수 여부 |
| `(neg? n)` | 음수 여부 |
| `(even? n)` | 짝수 여부 |
| `(odd? n)` | 홀수 여부 |

### 5.7 I/O

| 함수 | 설명 |
|------|------|
| `(println ...)` | 줄바꿈 출력 |
| `(print ...)` | 출력 (줄바꿈 없음) |
| `(str ...)` | 값 → 문자열 변환 |

### 5.8 HTTP 클라이언트

| 함수 | 설명 |
|------|------|
| `(http_get url)` | GET 요청 → 문자열 |
| `(http_json url)` | GET 요청 → 파싱된 값 |
| `(http_post url body)` | POST 요청 → 문자열 |
| `(http_delete url)` | DELETE 요청 → 문자열 |
| `(http_status url)` | 상태 코드 → 숫자 |

---

## 6. AI 네이티브 블록

### 6.1 SEARCH 블록

```lisp
[SEARCH query
  :source "web"      ; "web" | "local" | "db"
  :cache true
  :limit 5
  :name results]
```

### 6.2 LEARN 블록

```lisp
[LEARN
  :key "user-preference"
  :data {:theme "dark" :lang "ko"}
  :persist true]

; 나중에 recall
(recall "user-preference")
```

### 6.3 REASONING 블록

```lisp
[REASONING "문제 해결"
  [OBSERVE "현재 상황 파악"]
  [ANALYZE "원인 분석"]
  [DECIDE "해결책 선택"]
  [ACT "실행"]
  [VERIFY "결과 검증"]]
```

---

## 7. 모듈 시스템

### 7.1 모듈 정의 (MODULE 블록)

```lisp
[MODULE math-utils
  [FUNC square :params [$n] :body (* $n $n)]
  [FUNC cube :params [$n] :body (* $n $n $n)]]
```

### 7.2 Import

```lisp
; 네임스페이스로 import
(import math :from "./math-utils.fl")
(math:square 5)  ; → 25

; 선택적 import
(import [square cube] :from "./math-utils.fl")
(square 5)  ; → 25

; open (네임스페이스 없이)
(open :from "./math-utils.fl")
(square 5)  ; → 25
```

---

## 8. 표준 라이브러리 모듈 (19개)

| 모듈 | 기능 |
|------|------|
| `stdlib-file` | 파일 읽기/쓰기/삭제/목록 |
| `stdlib-error` | 에러 생성/처리 헬퍼 |
| `stdlib-http` | HTTP 클라이언트 (GET/POST/PUT/DELETE) |
| `stdlib-shell` | 셸 명령 실행 |
| `stdlib-data` | JSON/CSV 파싱, 데이터 변환 |
| `stdlib-collection` | 고급 컬렉션 연산 |
| `stdlib-agent` | AI 에이전트 상태 머신 |
| `stdlib-time` | 시간/날짜, 타이머, 모니터링 |
| `stdlib-crypto` | 해시, UUID, 암호화, 정규식 |
| `stdlib-workflow` | 워크플로우 엔진 |
| `stdlib-resource` | 서버 리소스 검색 |
| `stdlib-server` | HTTP 서버, 미들웨어, 라우터 |
| `stdlib-db` | 데이터베이스 드라이버 |
| `stdlib-ws` | WebSocket 서버/클라이언트 |
| `stdlib-auth` | JWT, API 키, 해싱 인증 |
| `stdlib-cache` | TTL 기반 인메모리 캐시 |
| `stdlib-pubsub` | Pub/Sub 이벤트 시스템 |
| `stdlib-process` | 환경 변수, 프로세스 제어 |
| `stdlib-pg` | PostgreSQL 직접 연결 |

---

## 9. 변수 명명 규칙

```lisp
; 일반 변수: $ 접두사
$name $count $user-id

; 내부 루프 변수: $ 접두사 + 짧은 이름
$i $j $k $n

; 함수 파라미터: $ 접두사
[$a $b $c]

; 중첩 함수 내부 변수 (충돌 방지용 접두사 관례):
; 함수명 약자 + 변수명
$sm-acc  ; sum 함수의 acc
$mn-val  ; mean 함수의 val
```

---

## 10. 완전한 예제

### 10.1 피보나치 (재귀)

```lisp
[FUNC fib
  :params [$n]
  :body (if (< $n 2)
           $n
           (+ (fib (- $n 1)) (fib (- $n 2))))]

(fib 10)  ; → 55
```

### 10.2 리스트 처리 파이프라인

```lisp
(define data [3 1 4 1 5 9 2 6 5 3])

; 짝수만, 제곱, 합계
(reduce
  (map
    (filter data (fn [$x] (even? $x)))
    (fn [$x] (* $x $x)))
  0
  (fn [$a $x] (+ $a $x)))
; → 4+4+36+4 = 48 (2²+2²+6²+2²... 짝수: 4,2,6,2 → 16+4+36+4=60)
```

### 10.3 HTTP 서버

```lisp
[MODULE api-server
  [FUNC start-server :params [$port]
    :body (do
      (server-route "GET" "/users"
        (fn [$req]
          (json-response (get-all-users))))
      (server-route "POST" "/users"
        (fn [$req]
          (let [[$body (json-parse (get $req :body))]]
            (json-response (create-user $body)))))
      (server-listen $port))]]
```

### 10.4 AI 에이전트

```lisp
; 검색 + 학습 + 추론 조합
(define research-agent
  (fn [$topic]
    [SEARCH $topic :source "web" :limit 5 :name results]
    [LEARN :key $topic :data $results :persist true]
    [REASONING "연구 결과 정리"
      [ANALYZE (str "검색 결과: " (length $results) "개")]
      [DECIDE "핵심 내용 추출"]
      [ACT (summarize-results $results)]]))
```

### 10.5 클로저 + 고차 함수

```lisp
; 커링
(define curry2
  (fn [$f]
    (fn [$a]
      (fn [$b]
        ($f $a $b)))))

(define add (curry2 (fn [$a $b] (+ $a $b))))
(define add5 (add 5))
(add5 3)  ; → 8
(add5 10) ; → 15
```

---

## 11. 타입 시스템 (Phase 60 이후)

### 지원 타입
```
:int        정수
:float      실수
:string     문자열
:bool       불리언
:null       null
:array      배열 (any 원소)
:array<:int> 타입 있는 배열
:map        맵 (any 키/값)
:any        모든 타입
:fn         함수
```

### 타입 어노테이션
```lisp
; 파라미터 타입
[FUNC divide
  :params [$a :float $b :float]
  :returns :float
  :body (/ $a $b)]

; 타입 에러 예시 (--strict 모드)
(divide "hello" 5)
; → 타입 오류: '$a' 파라미터에 :float 필요, :string 전달됨
```

---

*FreeLang v9 | AI 전용 언어 | Claude Code 제작*
