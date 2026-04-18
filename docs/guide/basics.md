# FreeLang v9 기초

## 문법 개요

FreeLang v9는 S-expression 기반의 Lisp 문법을 사용합니다.

### 기본 구조
```lisp
(함수명 인수1 인수2 ...)
```

### 예제
```lisp
(+ 1 2 3)        ; → 6
(* 4 5)          ; → 20
(str "안" "녕")   ; → "안녕"
```

---

## 데이터 타입

### 기본 타입
```lisp
42                  ; 정수
3.14               ; 부동소수점
"hello"            ; 문자열
:keyword           ; 키워드 (식별자)
true / false       ; 불린
nil                ; 널
```

### 컬렉션
```lisp
[1 2 3]            ; 벡터 (배열)
{:name "Kim" :age 30}  ; 맵 (객체)
(1 2 3)            ; 리스트
```

---

## 함수 정의

### defn으로 함수 정의
```lisp
(defn add [a b]
  (+ a b))

(add 5 3)          ; → 8
```

### 여러 인수
```lisp
(defn greet [name age]
  (str "이름: " name ", 나이: " age))

(greet "Kim" 25)   ; → "이름: Kim, 나이: 25"
```

### 기본값 인수
```lisp
(defn sayHello [name :default "World"]
  (str "Hello, " name "!"))

(sayHello "Alice")     ; → "Hello, Alice!"
(sayHello)             ; → "Hello, World!"
```

---

## 제어 흐름

### if-else
```lisp
(if (> x 10)
  (print "x가 10보다 크다")
  (print "x가 10 이하다"))
```

### when / unless
```lisp
(when (> x 0)
  (print "양수다"))

(unless (< x 0)
  (print "음수가 아니다"))
```

### cond (switch 같은 역할)
```lisp
(cond
  [(= x 1) "일"]
  [(= x 2) "이"]
  [(= x 3) "삼"]
  :else "기타")
```

---

## 루프와 반복

### loop (for 루프)
```lisp
(loop [i 0] (< i 5)
  (do
    (print i)
    (inc i)))
```

### map (요소 변환)
```lisp
(map (fn [x] (* x 2)) [1 2 3 4])
; → [2 4 6 8]
```

### filter (조건에 맞는 요소만)
```lisp
(filter (fn [x] (> x 5)) [3 6 2 8 1])
; → [6 8]
```

### reduce (누적)
```lisp
(reduce + 0 [1 2 3 4 5])
; → 15
```

---

## 파이프라인

파이프라인 연산자 `->`로 데이터를 함수 연쇄에 넘깁니다:

```lisp
(-> [1 2 3 4 5]
    (map (fn [x] (* x 2)))
    (filter (fn [x] (> x 5)))
    (reduce + 0))
; → 30
```

---

## 불확실성 (Maybe 타입)

AI가 확신도를 표현할 수 있습니다:

```lisp
; 95% 확신도로 값 표현
(maybe 0.95 "likely result")

; maybe 값을 다루기
(-> (maybe 0.9 42)
    (maybe-map (fn [x] (* x 2))))
```

---

## 에러 처리

### try-catch
```lisp
(try
  (/ 10 0)
  :catch (fn [err]
    (print "에러:" err)))
```

### Result 타입
```lisp
(ok 42)                    ; 성공값
(err "NOT_FOUND" "없음")   ; 에러
(ok? result)               ; 성공 여부 확인
(unwrap-or result 0)       ; 실패 시 기본값
```

---

## 변수와 바인딩

### let 바인딩
```lisp
(let [x 10
      y 20]
  (+ x y))
; → 30
```

### 패턴 매칭
```lisp
(let [[a b] [1 2]]
  (+ a b))
; → 3
```

---

## 고급: 거대 함수 정의 (defn 확장)

키워드 인수와 옵션을 지원합니다:

```lisp
(defn complex-fn
  [required-arg
   :optional "default-value"
   :key-arg "key-default"]
  (str required-arg optional key-arg))

(complex-fn "value1" :optional "opt" :key-arg "key")
```

---

## 모듈과 import

### 모듈 정의
```lisp
(defmodule math-utils
  (defn square [x] (* x x))
  (defn cube [x] (* x x x)))
```

### 모듈 import
```lisp
(import math-utils)
(math-utils/square 5)   ; → 25
```

---

## 다음 단계

- [AI 블록](./ai-blocks.md) — 추론, 반성, 자기 개선
- [프레임워크](./frameworks.md) — 웹 개발, 데이터 분석
- [API 레퍼런스](../api/stdlib.md) — 표준 라이브러리
