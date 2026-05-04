# FreeLang v11 — 학습 자료 (정상 동작)

> 다른 언어와 다른 동작이지만 **FreeLang에서 정상**. 25개.
> 실수가 아닌 *학습 사항*. JS/Python 출신이 헷갈리는 패턴.

관련 문서:
- `MISTAKES.md` — 진짜 실수
- `LANGUAGE-FAULTS.md` — 언어 결함 (다음 메이저에서 수정)

---

## 📚 Lisp/함수형 표준 동작

### #22 — v11 let 정상 문법

```lisp
;; #22 — v11 let 정상 문법
(let [[$x 1] [$y 2]] (+ $x $y))    ;; ✅
```

### #24 — let body 마지막 식 반환

```lisp
;; #24 — let body는 마지막 식이 반환값
(let [[$x 1]]
  (println "debug")
  (+ $x 1))                        ;; ✅ — (+ $x 1) 반환
```

### #25 — let 안에서 이전 바인딩 참조

```lisp
;; #25 — let 안에서 이전 바인딩 참조
(let [[$x 1] [$y (+ $x 1)]] $y)   ;; ✅ — 순서대로 평가됨
```

### #27 — v11 defn 표준

```lisp
;; #27 — v11 defn 표준
(defn add [$a $b] (+ $a $b))       ;; ✅
```

### #30 — 재귀: 함수명 직접 호출

```lisp
;; #30 — 재귀: 함수명으로 직접 호출
(defn fact [$n]
  (if (<= $n 1) 1 (* $n (fact (- $n 1)))))  ;; ✅
```

### #58 — (= x true) — 권장 안 함

```lisp
;; #58 — 불린 값
(= x true) (= x false)              ;; ✅ 일반적으로 OK
(not x)                              ;; ✅ nil/false 이외 모두 truthy
```

### #59 — 0/"" truthy (Lisp 표준)

```lisp
;; #59 — 0과 빈 문자열은 truthy (Lisp 표준)
(if 0 "yes" "no")   ;; → "yes" (JS와 다름!)
(if "" "yes" "no")  ;; → "yes"
(if nil "yes" "no") ;; → "no"
(if false "yes" "no") ;; → "no"
```

### #60 — 0-based 인덱스

```lisp
;; #60 — 배열 인덱스: 0-based
(get arr 1)   ;; 두 번째 요소 (첫 번째 아님)
(get arr 0)   ;; ✅ 첫 번째 요소
```

### #61 — if 단일 식만

```lisp
;; #61 — if는 단일 식만
(if cond
  (do-a)
  (do-b))      ;; ❌ — else 없이 두 식 나열
(if cond (do-a) (do-b))  ;; ✅
```

### #62 — 다중 분기 cond 권장

```lisp
;; #62 — 다중 분기: cond 사용
(if (= x 1) "하나"
  (if (= x 2) "둘" "기타"))        ;; △ 중첩 if (가독성 낮음)
(cond
  [(= x 1) "하나"]
  [(= x 2) "둘"]
  [true "기타"])                    ;; ✅
```

### #64 — and/or 마지막 truthy 반환

```lisp
;; #64 — and/or 반환값
(and true "hello")  ;; → "hello" (마지막 truthy 값 반환)
(or  nil  "default") ;; → "default"
(or  nil  0)         ;; → 0 (0은 truthy!)
```

### #65 — if + do 블록

```lisp
;; #65 — 중첩 조건에서 do 블록
(if cond
  (stmt-a)
  (stmt-b)
  (stmt-c))                         ;; ❌ — if는 then/else 2개만
(if cond
  (do (stmt-a) (stmt-b))
  (stmt-c))                         ;; ✅
```

### #73 — file_mkdir 재귀 생성

```lisp
;; #73 — file_mkdir: 중간 디렉토리 자동 생성
(file_mkdir "a/b/c")              ;; ✅ — recursive 생성
```

### #76 — str 임의 타입 변환

```lisp
;; #76 — str은 임의 타입 이어붙임
(str "hello" 42 true)             ;; ✅ → "hello42true"
```

### #83 — append 불변

```lisp
;; #83 — append는 불변 (새 배열 반환)
(append arr x)                    ;; ✅ — 원본 불변, 새 배열 반환
(do (append arr x) arr)           ;; ❌ — 결과를 버림
(define arr2 (append arr x))      ;; ✅
```

### #85 — slice end 미포함

```lisp
;; #85 — slice: start, end (end 미포함)
(slice arr 0 3)                   ;; → 인덱스 0,1,2 (3 미포함)
```

### #86 — flatten 동작

```lisp
;; #86 — flatten: 중첩 배열 평탄화
(flatten [[1 2] [3 4]])           ;; → [1 2 3 4] ✅
```

### #87 — zip 동작

```lisp
;; #87 — zip: 두 배열 짝 맞추기
(zip [1 2 3] ["a" "b" "c"])       ;; → [[1 "a"] [2 "b"] [3 "c"]]
```

### #88 — range end 미포함

```lisp
;; #88 — range: 끝 미포함
(range 0 5)                       ;; → [0 1 2 3 4] (5 미포함) ✅
```

### #92 — workflow on_error 동작

```lisp
;; #92 — workflow 에러: on_error 반환값이 context에 반영
(workflow_step "s" fn {:on_error (fn [$e] {:fallback true})})
;; fallback true가 context에 병합됨
```

### #93 — load 경로

```lisp
;; #93 — load 경로: 실행 위치 기준
(load "src/express.fl")           ;; bootstrap.js 위치 기준 ✅
```

### #95 — do 마지막 식 반환

```lisp
;; #95 — do 블록의 반환값
(do (+ 1 2) (+ 3 4))             ;; → 7 (마지막 식)
```

### #96 — 심볼 vs 문자열

```lisp
;; #96 — 심볼 vs 문자열
(define name "kim")
(println name)                    ;; → "kim" ✅
(println "name")                  ;; → "name" (변수 접근 아님)
```

### #98 — 재귀 깊이 제한

```lisp
;; #98 — 재귀 깊이: 스택 오버플로우 주의
;; 큰 데이터는 reduce/loop 사용, 재귀 깊이 100 이하 권장
```

### #100 — (or nil 0) → 0 (Lisp 표준)

```lisp
;; #100 — (or nil 0)은 0 반환 (0이 falsy 아님)
(or nil 0)    ;; → 0  (nil만 falsy)
(or nil false) ;; → false
(or nil nil)  ;; → nil
;; JS와 다름: JS에서 (0 || "default") → "default"
;; FL에서 (or 0 "default") → 0
```

---

## 📝 문서 오류 (3개)

MISTAKES-100에서 *틀린 코드*라고 표시했지만 **실제로는 작동**하는 경우.
문서가 outdated. 정정 예정.

### #36 — json_keys ALIAS, 실제로 작동도 함

```lisp
;; #36 — 맵 키 목록
(json_keys m) / (object_keys m)     ;; ❌
(keys m)                             ;; ✅
```

**Fix**: 문서 정정

### #70 — KimDB URL 형식

```lisp
;; #70 — KimDB URL 형식
(http_get "http://localhost:40000/api/v1/collections/col/docs")  ;; ❌
(http_get "http://localhost:40000/api/c/col")                     ;; ✅
```

**Fix**: 문서 명시

### #77 — length는 string에도 작동 (문서 거짓)

```lisp
;; #77 — str-length vs length
(length "hello")                  ;; ❌ — 배열 전용
(str-length "hello")              ;; ✅ → 5
```

**Fix**: 문서 정정
