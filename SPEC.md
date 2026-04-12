# FreeLang v9 Language Specification v1.0

**버전**: 1.0.0
**기반**: FreeLang v9 (Phase 1–89 누적)
**작성일**: 2026-04-12
**상태**: 공식 릴리스

---

## 목차

1. [소개](#1-소개)
2. [문법 (Grammar)](#2-문법-grammar)
   - 2.1 리터럴
   - 2.2 변수
   - 2.3 특수 폼 목록 (22개)
   - 2.4 내장 함수 목록 (94개+)
   - 2.5 블록 구조 (FUNC, MODULE, TypeClass 등)
3. [타입 시스템](#3-타입-시스템)
   - 3.1 기본 타입
   - 3.2 strict 모드
4. [모듈 시스템](#4-모듈-시스템)
5. [표준 라이브러리](#5-표준-라이브러리)
6. [AI 블록](#6-ai-블록)
7. [매크로 시스템](#7-매크로-시스템)
8. [프로토콜 & 구조체](#8-프로토콜--구조체)
9. [동시성](#9-동시성)
10. [파이프라인 연산자](#10-파이프라인-연산자)
11. [레이지 시퀀스](#11-레이지-시퀀스)
12. [이뮤터블 데이터 구조](#12-이뮤터블-데이터-구조)
13. [에러 처리](#13-에러-처리)
14. [패턴 매칭](#14-패턴-매칭)
15. [비동기 처리](#15-비동기-처리)
16. [런타임 특성](#16-런타임-특성)

---

## 1. 소개

FreeLang v9는 **AI(Claude Code) 전용 프로그래밍 언어**다.

> "이 언어는 인간을 위한 언어가 아니다. 제작자: Claude Code, 사용자: Claude Code."

### 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **S-expression 기반** | AI가 파싱/생성하기 가장 쉬운 형태 |
| **AI 추론 최적화** | `search`, `learn`, `reason`, `decide`, `act` 네이티브 블록 |
| **블록 구조** | FUNC, MODULE, TypeClass 등 논리 단위 명시 |
| **렉시컬 스코프** | ScopeStack 기반 클로저 지원 (Phase 56) |
| **점진적 타입** | 선택적 타입 어노테이션, strict 모드 |
| **TCO** | Tail Call Optimization — 100만 재귀 스택오버플로 없음 |

### 빠른 시작

```lisp
; 기본 함수 정의
(define (greet name)
  (str "Hello, " name "!"))

(println (greet "World"))  ; Hello, World!

; 재귀 팩토리얼
(define (factorial n)
  (if (<= n 1)
      1
      (* n (factorial (- n 1)))))

(println (factorial 10))  ; 3628800

; 클로저 make-adder
(define (make-adder n)
  (fn [x] (+ n x)))

(define add5 (make-adder 5))
(println (add5 10))  ; 15
```

---

## 2. 문법 (Grammar)

FreeLang v9는 S-expression (S식) 기반 언어다. 모든 표현식은 `(연산자 인자...)` 형태다.

### 2.1 리터럴

| 유형 | 예시 | 설명 |
|------|------|------|
| **정수** | `42`, `-7`, `0` | 64비트 정수 |
| **부동소수점** | `3.14`, `-0.5`, `1.0e10` | 64비트 부동소수점 |
| **문자열** | `"hello"`, `"한국어"` | UTF-8 문자열 |
| **부울** | `true`, `false` | 논리값 |
| **null** | `null` | 없음 |
| **키워드** | `:name`, `:type`, `:ok` | 자기 평가 심볼 |
| **변수** | `$x`, `$name`, `$count` | `$` 접두사 변수 참조 |
| **리스트** | `[1 2 3]`, `["a" "b"]` | 벡터/배열 리터럴 |
| **맵** | `{:key "value"}` | 키-값 맵 리터럴 |

### 2.2 변수

```lisp
; define — 전역/지역 바인딩
(define x 42)
(define name "FreeLang")

; let — 로컬 바인딩 (렉시컬 스코프)
(let [$a 10
      $b 20]
  (+ $a $b))   ; 30

; set! — 가변 변수 업데이트
(define counter 0)
(set! counter (+ counter 1))
```

### 2.3 특수 폼 목록 (22개)

FreeLang v9 인터프리터가 특별히 처리하는 폼들:

| # | 폼 | 설명 | 예시 |
|---|-----|------|------|
| 1 | `define` | 변수/함수 정의 | `(define x 42)` |
| 2 | `fn` | 익명 함수 | `(fn [x] (* x x))` |
| 3 | `let` | 로컬 바인딩 | `(let [$a 1] $a)` |
| 4 | `if` | 조건 분기 | `(if cond then else)` |
| 5 | `cond` | 다중 조건 | `(cond [test1 val1] ...)` |
| 6 | `do` / `begin` / `progn` | 순서 실행 | `(do expr1 expr2)` |
| 7 | `loop` / `recur` | TCO 루프 | `(loop [$i 0] ...)` |
| 8 | `while` | 명령형 루프 | `(while cond body)` |
| 9 | `set!` | 가변 바인딩 | `(set! $x 10)` |
| 10 | `and` | 논리 AND (단축) | `(and true false)` |
| 11 | `or` | 논리 OR (단축) | `(or false true)` |
| 12 | `match` | 패턴 매칭 | `(match val [1 "one"] ...)` |
| 13 | `try` / `catch` | 에러 처리 | `(try expr (catch e ...))` |
| 14 | `async` | 비동기 함수 | `(async (fn [] ...))` |
| 15 | `await` | 비동기 대기 | `(await promise)` |
| 16 | `->` | 스레딩 (앞 삽입) | `(-> x f g)` |
| 17 | `->>` | 스레딩 (뒤 삽입) | `(->> xs map filter)` |
| 18 | `\|>` | 파이프 연산자 | `(\|> x f)` |
| 19 | `defmacro` | 매크로 정의 | `(defmacro when ...)` |
| 20 | `defstruct` | 구조체 정의 | `(defstruct Point [x y])` |
| 21 | `defprotocol` | 프로토콜 정의 | `(defprotocol Printable ...)` |
| 22 | `parallel` / `race` | 동시 실행 | `(parallel task1 task2)` |

### 2.4 내장 함수 목록 (94개+)

#### 산술 연산

| 함수 | 설명 | 예시 |
|------|------|------|
| `+` | 덧셈 | `(+ 1 2)` → `3` |
| `-` | 뺄셈 | `(- 10 3)` → `7` |
| `*` | 곱셈 | `(* 4 5)` → `20` |
| `/` | 나눗셈 | `(/ 10 2)` → `5` |
| `%` | 나머지 | `(% 10 3)` → `1` |
| `abs` | 절댓값 | `(abs -5)` → `5` |
| `floor` | 내림 | `(floor 3.7)` → `3` |
| `ceil` | 올림 | `(ceil 3.2)` → `4` |
| `round` | 반올림 | `(round 3.5)` → `4` |
| `sqrt` | 제곱근 | `(sqrt 9)` → `3` |
| `pow` | 거듭제곱 | `(pow 2 10)` → `1024` |
| `min` | 최솟값 | `(min 3 1 4)` → `1` |
| `max` | 최댓값 | `(max 3 1 4)` → `4` |

#### 비교 연산

| 함수 | 설명 |
|------|------|
| `=` `==` | 동등 비교 |
| `!=` | 불일치 |
| `<` `<=` `>` `>=` | 대소 비교 |

#### 문자열 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `str` | 문자열 변환/결합 | `(str "a" "b")` → `"ab"` |
| `concat` | 문자열 결합 | `(concat "x" "y")` |
| `length` | 길이 | `(length "hello")` → `5` |
| `upper` | 대문자 | `(upper "abc")` → `"ABC"` |
| `lower` | 소문자 | `(lower "ABC")` → `"abc"` |
| `substring` | 부분 문자열 | `(substring "hello" 0 3)` → `"hel"` |
| `split` | 분리 | `(split "a,b,c" ",")` |
| `trim` | 공백 제거 | `(trim "  hi  ")` → `"hi"` |
| `starts-with?` | 접두사 확인 | `(starts-with? "hello" "he")` |
| `ends-with?` | 접미사 확인 | `(ends-with? "hello" "lo")` |
| `contains?` | 포함 확인 | `(contains? "hello" "ell")` |
| `replace` | 치환 | `(replace "abc" "b" "B")` |
| `char-at` | 인덱스 문자 | `(char-at "abc" 1)` → `"b"` |
| `char-code` | 문자 코드 | `(char-code "A")` → `65` |
| `is-digit?` | 숫자 판별 | `(is-digit? "5")` |
| `is-whitespace?` | 공백 판별 | `(is-whitespace? " ")` |

#### 리스트/배열 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `list` | 리스트 생성 | `(list 1 2 3)` |
| `first` | 첫 번째 | `(first [1 2 3])` → `1` |
| `rest` | 나머지 | `(rest [1 2 3])` → `[2 3]` |
| `append` | 뒤에 추가 | `(append [1 2] 3)` |
| `reverse` | 역순 | `(reverse [1 2 3])` |
| `map` | 변환 | `(map [1 2 3] (fn [x] (* x 2)))` |
| `filter` | 필터 | `(filter [1 2 3] (fn [x] (> x 1)))` |
| `reduce` | 축약 | `(reduce [1 2 3] + 0)` |
| `length` | 길이 | `(length [1 2 3])` → `3` |
| `nth` | n번째 요소 | `(nth [1 2 3] 1)` → `2` |
| `flatten` | 평탄화 | `(flatten [[1 2] [3 4]])` |
| `zip` | 병렬 결합 | `(zip [1 2] [3 4])` |
| `sort` | 정렬 | `(sort [3 1 2])` |
| `take` | 앞 n개 | `(take 3 [1 2 3 4 5])` |
| `drop` | 앞 n개 제거 | `(drop 2 [1 2 3 4])` |
| `count` | 요소 수 | `(count [1 2 3])` → `3` |
| `empty?` | 비어있나 | `(empty? [])` → `true` |
| `includes?` | 포함 여부 | `(includes? [1 2 3] 2)` |

#### 맵 함수

| 함수 | 설명 |
|------|------|
| `get` | 키 조회 |
| `set` | 키 설정 |
| `keys` | 키 목록 |
| `values` | 값 목록 |
| `entries` | 엔트리 목록 |
| `merge` | 맵 병합 |
| `has?` | 키 존재 확인 |
| `dissoc` | 키 제거 |

#### 타입 확인

| 함수 | 설명 |
|------|------|
| `null?` | null 확인 |
| `zero?` | 0 확인 |
| `pos?` | 양수 확인 |
| `neg?` | 음수 확인 |
| `string?` | 문자열 확인 |
| `number?` | 숫자 확인 |
| `list?` | 리스트 확인 |
| `map?` | 맵 확인 |
| `fn?` | 함수 확인 |
| `bool?` | 부울 확인 |

#### I/O 및 기타

| 함수 | 설명 |
|------|------|
| `print` | 출력 (개행 없음) |
| `println` / `echo` | 출력 (개행) |
| `print-err` | stderr 출력 |
| `now` | 현재 타임스탬프 |
| `sleep` | 비동기 대기 |
| `random` | 난수 생성 |
| `uuid` | UUID 생성 |
| `repr` | 값 표현 문자열 |
| `inspect` | 상세 내부 표현 |

### 2.5 블록 구조

FreeLang v9는 최상위 레벨에서 여러 종류의 블록을 지원한다.

#### FUNC 블록

```lisp
(FUNC greet
  [:params [name :string]]
  [:returns :string]
  [:body
    (str "Hello, " name "!")])
```

#### MODULE 블록

```lisp
(MODULE math
  [:exports [add subtract multiply]]
  [:body
    (define (add a b) (+ a b))
    (define (subtract a b) (- a b))
    (define (multiply a b) (* a b))])
```

#### TypeClass 블록

```lisp
(defprotocol Printable
  (print-self [self]))

(defstruct Point [x y])

(impl Printable Point
  (define (print-self [self])
    (str "Point(" self.x ", " self.y ")")))
```

---

## 3. 타입 시스템

### 3.1 기본 타입

| 타입 키워드 | 설명 | 예시 값 |
|------------|------|---------|
| `:int` | 정수 | `42`, `-7` |
| `:float` | 부동소수점 | `3.14`, `1.0` |
| `:string` | 문자열 | `"hello"` |
| `:bool` | 부울 | `true`, `false` |
| `:null` | null 값 | `null` |
| `:list` | 리스트/배열 | `[1 2 3]` |
| `:map` | 키-값 맵 | `{:a 1}` |
| `:fn` | 함수 | `(fn [x] x)` |
| `:any` | 동적 타입 | 모든 값 |
| `:void` | 반환값 없음 | — |

타입 어노테이션 예시:

```lisp
; 함수 시그니처: [인자타입... -> 반환타입]
(define add-tax [:int :float -> :float]
  [$price $rate]
  (* $price (+ 1.0 $rate)))
```

### 3.2 strict 모드

환경 변수 `FREELANG_STRICT=1`로 활성화:

```bash
FREELANG_STRICT=1 npx ts-node src/cli.ts myfile.fl
```

strict 모드 동작:
- 타입 어노테이션 있는 함수는 인자 타입 실시간 검증
- `(+ "hello" 42)` → 타입 에러 발생
- 타입 불일치 시 실행 중단 (경고 대신 에러)
- 제네릭 기본 추론 활성화

---

## 4. 모듈 시스템

### import 블록

```lisp
(import :from "./math-lib"
  :select [add subtract multiply])

; 전체 import
(import :from "./utils"
  :as utils)

; 사용
(add 1 2)
(utils.format "hello")
```

### open 블록

```lisp
(open :module "string"
  :select [upper lower trim])

; open된 함수 직접 사용
(upper "hello")
```

### 표준 라이브러리 모듈 (19개)

| 모듈 | 설명 |
|------|------|
| `string` | 문자열 처리 |
| `array` | 배열/리스트 |
| `map` | 맵/딕셔너리 |
| `math` | 수학 함수 |
| `json` | JSON 파싱/직렬화 |
| `io` | 파일 I/O |
| `http` | HTTP 클라이언트/서버 |
| `async` | 비동기 유틸리티 |
| `time` | 날짜/시간 |
| `regex` | 정규표현식 |
| `logging` | 로깅 |
| `result` | Result/Option 모나드 |
| `memory` | 메모리 관리 |
| `types` | 타입 유틸리티 |
| `validate` | 유효성 검증 |
| `security` | 보안 유틸리티 |
| `testing` | 테스트 프레임워크 |
| `data` | 데이터 처리 |
| `ai` | AI 통합 |

---

## 5. 표준 라이브러리

### string 모듈

```lisp
(import :from "string" :select [format pad-left pad-right repeat])

(format "Hello, {}!" ["World"])   ; "Hello, World!"
(pad-left "42" 5 "0")             ; "00042"
(repeat "FL" 3)                   ; "FLFLFL"
```

### math 모듈

```lisp
(import :from "math" :select [sum avg median std-dev])

(sum [1 2 3 4 5])                 ; 15
(avg [1 2 3 4 5])                 ; 3
(median [1 2 3 4 5])              ; 3
```

### result 모듈 (Result/Option 모나드)

```lisp
(import :from "result" :select [ok err map-result unwrap])

(define result (ok 42))
(map-result result (fn [x] (* x 2)))  ; ok(84)

(define err-result (err "not found"))
(unwrap err-result 0)                  ; 0 (기본값)
```

### time 모듈

```lisp
(import :from "time" :select [now format-date diff-days])

(define ts (now))
(format-date ts "YYYY-MM-DD")
(diff-days "2026-01-01" "2026-04-12")
```

---

## 6. AI 블록

FreeLang v9의 핵심 차별점. AI 추론 패턴을 언어 수준에서 지원.

### search 블록

```lisp
(search
  :query "FreeLang 최신 기능"
  :limit 5
  :on-result (fn [results]
    (map results (fn [r] r.title))))
```

### learn 블록

```lisp
(learn
  :fact "FreeLang v9는 AI 전용 언어다"
  :category "metadata"
  :persist true)

; 학습된 사실 조회
(learn :query "FreeLang" :limit 10)
```

### reason 블록

```lisp
(reason
  :premise "x는 짝수다"
  :premise "x > 10이다"
  :conclusion "x는 양의 짝수다"
  :steps [
    "x가 짝수이므로 2로 나누어 떨어진다"
    "x > 10이므로 양수다"
    "따라서 양의 짝수다"
  ])
```

### observe / analyze / decide / act / verify 블록

```lisp
; AI 에이전트 패턴
(observe :input data :context ctx)
(analyze :data observed :strategy "pattern-match")
(decide :options opts :criteria criteria)
(act :plan decision :execute true)
(verify :result acted :expected expected)
```

### ai-call 블록 (Phase 71)

```lisp
(ai-call
  :model "claude-3"
  :prompt "다음 코드를 리뷰해줘: ..."
  :max-tokens 1000
  :on-response (fn [resp] resp.content))
```

### embed / rag-search 블록 (Phase 71)

```lisp
; 텍스트 임베딩 생성
(embed :text "FreeLang is an AI language" :on-result store-fn)

; RAG 검색
(rag-search
  :query "AI 언어의 특징"
  :top-k 5
  :on-result (fn [docs] (map docs (fn [d] d.content))))
```

---

## 7. 매크로 시스템

Phase 63에서 도입된 위생적(Hygienic) 매크로 시스템.

```lisp
; when 매크로
(defmacro when [cond body]
  `(if ~cond ~body null))

; unless 매크로
(defmacro unless [cond body]
  `(if (not ~cond) ~body null))

; with-logging 매크로
(defmacro with-logging [name & body]
  `(do
    (println (str "START: " ~name))
    ~@body
    (println (str "END: " ~name))))

; 사용
(when (> x 0)
  (println "양수입니다"))

(with-logging "operation"
  (compute x)
  (store result))
```

매크로 확장 확인:
```lisp
(macroexpand '(when true (println "hi")))
; → (if true (println "hi") null)
```

---

## 8. 프로토콜 & 구조체

### defprotocol (Phase 64)

```lisp
(defprotocol Drawable
  (draw [self])
  (area [self]))

(defprotocol Comparable
  (compare-to [self other])
  (less-than? [self other]))
```

### defstruct (Phase 66)

```lisp
(defstruct Point
  [:fields [x :float y :float]]
  [:methods
    (define (distance-to [self other]
      (sqrt (+ (pow (- other.x self.x) 2)
               (pow (- other.y self.y) 2)))))])

; 구조체 생성
(define p1 (Point :x 0.0 :y 0.0))
(define p2 (Point :x 3.0 :y 4.0))
(p1.distance-to p2)  ; 5.0
```

### impl — 프로토콜 구현

```lisp
(impl Drawable Point
  (define (draw [self])
    (println (str "Point at (" self.x ", " self.y ")")))
  (define (area [self])
    0.0))
```

### 향상된 패턴 매칭 (Phase 65)

```lisp
; guard 조건
(match x
  [$n (guard (> $n 0)) (str "양수: " $n)]
  [$n (guard (< $n 0)) (str "음수: " $n)]
  [_ "0"])

; 구조체 패턴
(match shape
  [(Point :x $x :y $y) (str "점 (" $x ", " $y ")")]
  [(Circle :r $r) (str "원 반지름=" $r)])

; 범위 패턴
(match score
  [(range 90 100) "A"]
  [(range 80 89) "B"]
  [(range 70 79) "C"]
  [_ "F"])

; as 바인딩
(match [1 2 3]
  [(as $full [$head & $rest]) (str "전체: " $full)])
```

---

## 9. 동시성

Phase 67에서 도입된 채널, 액터, 병렬 실행.

### 채널

```lisp
(define ch (channel :buffer 10))

; 송신 (비동기)
(async (fn []
  (ch-send ch "message1")
  (ch-send ch "message2")
  (ch-close ch)))

; 수신
(define msg (await (ch-recv ch)))
```

### 액터

```lisp
(define counter-actor
  (actor (fn [state msg]
    (cond
      [(= msg.type "increment") (+ state 1)]
      [(= msg.type "decrement") (- state 1)]
      [true state]))))

(actor-send counter-actor {:type "increment"})
(actor-send counter-actor {:type "increment"})
(define count (await (actor-ask counter-actor {:type "get"})))
```

### parallel / race

```lisp
; 모두 완료 대기
(parallel
  (fetch-user-data user-id)
  (fetch-permissions user-id)
  (fetch-preferences user-id))

; 먼저 완료되는 것 사용
(race
  (timeout-after 5000 "timeout")
  (fetch-data url))
```

---

## 10. 파이프라인 연산자

Phase 68에서 도입된 세 가지 파이프라인 연산자.

### `->` (앞에 삽입)

```lisp
; (-> x f g h) = (h (g (f x)))
(-> "hello"
    upper
    (substring 0 3))
; = (substring (upper "hello") 0 3) = "HEL"
```

### `->>` (뒤에 삽입)

```lisp
; (->> xs f g h) = (h (g (f xs)))
(->> [1 2 3 4 5]
     (filter (fn [x] (> x 2)))
     (map (fn [x] (* x x)))
     (reduce + 0))
; = 9 + 16 + 25 = 50
```

### `|>` (Elixir 스타일)

```lisp
(|> data
    parse-json
    validate
    transform
    serialize)
```

---

## 11. 레이지 시퀀스

Phase 69에서 도입된 무한/지연 시퀀스.

```lisp
; 무한 시퀀스
(define natural-numbers
  (iterate 1 (fn [n] (+ n 1))))

; 앞 10개만 취득
(take 10 natural-numbers)  ; [1 2 3 4 5 6 7 8 9 10]

; 레이지 map/filter
(define evens
  (filter-lazy natural-numbers (fn [n] (= (% n 2) 0))))

(take 5 evens)  ; [2 4 6 8 10]

; range (레이지)
(define big-range (range 0 1000000))
(take 5 big-range)  ; [0 1 2 3 4]
```

---

## 12. 이뮤터블 데이터 구조

Phase 70에서 도입된 영속 이뮤터블 자료구조.

```lisp
; 이뮤터블 맵
(define m (imm-map :name "FreeLang" :version "1.0"))
(define m2 (imm-assoc m :author "Claude"))
; m은 변경되지 않음, m2는 새 맵

; 이뮤터블 벡터
(define v (imm-vec 1 2 3))
(define v2 (imm-conj v 4))
; v는 [1 2 3], v2는 [1 2 3 4]

; 구조적 공유로 메모리 효율적
```

---

## 13. 에러 처리

### try/catch/finally

```lisp
(try
  (risky-operation data)
  (catch e
    (println (str "에러: " e.message))
    null)
  (finally
    (cleanup)))
```

### 에러 포맷 (Phase 59)

에러는 파일:줄:컬럼 + 소스 강조 + 힌트 포함:

```
실행 오류  agent.fl:42:12
  40 │  (define result
  41 │    (let [[$x 100]]
  42 │      (compute-tax $x)))
            ^^^^^^^^^^^
  함수 'compute-tax'를 찾을 수 없습니다.
  힌트: (define compute-tax [$x] ...) 로 정의하거나 import 했는지 확인하세요.
```

Levenshtein 유사 함수 제안:
```
'compute-tak'를 찾을 수 없습니다. 혹시 'compute-tax'를 말하셨나요?
```

### throw

```lisp
(throw {:type "CustomError"
        :message "유효하지 않은 입력"
        :code 400})
```

---

## 14. 패턴 매칭

```lisp
; 기본 패턴
(match value
  [1 "one"]
  [2 "two"]
  [$n (str "other: " $n)])

; 리스트 패턴
(match lst
  [[] "empty"]
  [[$head & $rest] (str "head=" $head)])

; 중첩 패턴
(match {:name $n :age $a}
  [{:name "Admin" :age $age} (str "Admin, age " $age)]
  [{:name $name} (str "User: " $name)])
```

---

## 15. 비동기 처리

```lisp
; async 함수 정의
(define fetch-user
  (async (fn [user-id]
    (define resp (await (http-get (str "/users/" user-id))))
    (await (json-parse resp.body)))))

; await 사용
(define user (await (fetch-user 42)))
(println user.name)

; Promise 체이닝
(define result
  (-> (fetch-data url)
      (then parse-json)
      (then validate)
      (catch handle-error)))
```

---

## 16. 런타임 특성

### 실행 모델

| 특성 | 설명 |
|------|------|
| **인터프리터** | Tree-walking AST 인터프리터 (Node.js/TypeScript) |
| **바이트코드** | BytecodeCompiler + VM (Phase 83) |
| **JS 코드생성** | JSCodegen — FreeLang → JavaScript (Phase 85) |
| **자체 호스팅** | FL→FL→JS 22/22 PASS (Phase 88) |
| **TCO** | 꼬리 호출 최적화, 100만 재귀 가능 |

### 성능 벤치마크 (Phase 89)

| 작업 | ops/sec | avg ms |
|------|---------|--------|
| 단순 산술 `(+ (* 2 3) (- 10 4))` | 953 | 1.05ms |
| `factorial(10)` 재귀 | 817 | 1.22ms |
| `fibonacci(15)` | 45 | 22.1ms |
| 리스트 길이 (100개) | 1150 | 0.87ms |
| 문자열 concat | 1191 | 0.84ms |

### 툴체인

| 도구 | 클래스/함수 | 설명 |
|------|------------|------|
| **Formatter** | `FLFormatter`, `formatFL()` | AST 기반 자동 포매터 |
| **Linter** | `FLLinter` | 정적 분석, 플러그인 기반 |
| **REPL** | `FreeLangReplCore` | 히스토리, `:cmd` 명령어 |
| **TestRunner** | `FLTestRunner` | 내장 테스트 프레임워크 |
| **DocGen** | `extractDocs()` | 주석 기반 문서 생성 |
| **Debugger** | `DebugSession` | 중단점, 스택 추적 |
| **CI** | `CIPipeline` | 타입체크+린트+테스트 자동화 |
| **Profiler** | `Profiler` | CPU/메모리 프로파일링 |
| **VM** | `VM`, `BytecodeCompiler` | 바이트코드 실행 |
| **JSCodegen** | `JSCodegen` | JS 코드 생성 |
| **LSP** | `FLLanguageServer` | Language Server Protocol |
| **VPM** | `PackageRegistry` | 패키지 매니저 |

### 패키지 (packages/)

| 패키지 | 설명 |
|--------|------|
| `fl-http-client` | HTTP 클라이언트 라이브러리 |
| `fl-json-schema` | JSON Schema 검증 |
| `fl-math` | 수학 함수 확장 |

---

*FreeLang v9 Language Specification v1.0 — 2026-04-12*
*작성: Claude Code | AI 전용 언어, AI가 쓰고 AI가 읽는다*
