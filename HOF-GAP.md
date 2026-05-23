# Higher-Order Function Gap Analysis (cgc-main.fl)

**상태**: P2-Core 완성, P2-Extended 미완료  
**범위**: cgc-main.fl에서 발견된 고차 함수 호환성 문제  
**영향도**: MEDIUM — 함수형 패턴 지원

---

## 발견 내용

### 1. Filter with Callback (line 374)

**현재 코드**:
```lisp
(defn keys-no-line [m]
  (filter (fn [k] (not (= k "line"))) (json_keys m)))
```

**패턴 분석**:
- `filter`: 고차 함수
- `(fn [k] ...)`: Anonymous function (closure)
- Return: List

**문제점**:
- Pure function (캡처 없음)이므로 현재 가능
- 하지만 더 복잡한 경우: `(filter (fn [x] (> $threshold x)) items)` → closure capture 필요

### 2. Map Usage Pattern

**예시** (현재 코드에서는 직접 사용 없음, 하지만 필요):
```lisp
;; stdlib에서 제공
(map (fn [$x] (* $x 2)) [1 2 3])

;; 또는 closure capture 필요
(defn scale [$factor $items]
  (map (fn [$x] (* $factor $x)) $items))
```

### 3. Reduce Pattern

**예시**:
```lisp
(reduce + 0 [1 2 3 4 5])  ;; → 15

;; 또는 custom reducer
(reduce (fn [$acc $x] (+ $acc (* $x $x))) 0 [1 2 3])  ;; → 14
```

---

## 필요한 Stdlib 함수들

### 1. map - Array Transformation

```lisp
(defn map [$fn $arr]
  (let [[$result []]]
    (for-each (fn [$item]
      (push $result ($fn $item)))
    $arr)
    $result))

;; Test cases
(map (fn [$x] (+ $x 1)) [1 2 3])  ;; → [2 3 4]
(map identity [1 2 3])             ;; → [1 2 3]
(map (fn [$x] (length $x)) ["a" "ab" "abc"])  ;; → [1 2 3]
```

### 2. filter - Array Selection

```lisp
(defn filter [$fn $arr]
  (let [[$result []]]
    (for-each (fn [$item]
      (if ($fn $item) (push $result $item)))
    $arr)
    $result))

;; Test cases
(filter (fn [$x] (> $x 2)) [1 2 3 4 5])  ;; → [3 4 5]
(filter (fn [$x] (odd? $x)) [1 2 3 4 5])  ;; → [1 3 5]
(filter (fn [$x] (not (= $x "line"))) ["a" "line" "b"])  ;; → ["a" "b"]
```

### 3. reduce - Array Aggregation

```lisp
(defn reduce [$fn $init $arr]
  (let [[$acc $init]]
    (for-each (fn [$item]
      (set! $acc ($fn $acc $item)))
    $arr)
    $acc))

;; Test cases
(reduce + 0 [1 2 3 4 5])  ;; → 15
(reduce (fn [$acc $x] (* $acc $x)) 1 [2 3 4])  ;; → 24
(reduce (fn [$acc $s] (str $acc "," $s)) "" ["a" "b" "c"])  ;; → ",a,b,c"
```

### 4. for-each - Array Iteration (Side Effects)

```lisp
(defn for-each [$fn $arr]
  (let [[$i 0]]
    (loop [$i 0]
      (if (>= $i (length $arr)) nil
        (do
          ($fn (get $arr $i))
          (recur (+ $i 1)))))))

;; Test
(for-each (fn [$x] (println $x)) [1 2 3])
```

---

## 현재 Native Backend 문제점

### 1. Callback Function Passing

**문제**: C에서 function value (closure object) 전달

**현재 C runtime 지원?**:
```c
// FLValue가 function을 표현하는가?
typedef struct {
  int type;  // FL_FN
  void* fn_ptr;
  FLValue* env;  // captured vars
} FLValue;

// filter 구현
FLValue fl_filter(FLValue fn, FLValue arr) {
  // fn을 callable로 호출?
  FLValue result = fl_vec_new();
  for (int i = 0; i < arr_len; i++) {
    FLValue item = arr[i];
    FLValue ret = fn->fn_ptr(item);  // ← 이게 맞는가?
    if (fl_truthy(ret)) {
      fl_vec_push(result, item);
    }
  }
  return result;
}
```

**필요 검증**:
- [ ] FLValue가 function을 저장 가능
- [ ] function value를 호출 가능 (invoke/call syntax)
- [ ] 여러 arity 지원

### 2. Anonymous Function Creation

**문제**: `(fn [x] ...)` 표현식이 FLValue로 변환되는가?

```lisp
;; How does this compile to C?
(define my-fn (fn [$x] (+ $x 1)))
(my-fn 5)  ;; → 6
```

**예상 C code**:
```c
// Static function
FLValue lambda_123(FLValue x) {
  return fl_add(x, fl_int(1));
}

// Or closure?
FLValue my_fn = {
  .type = FL_FN,
  .fn_ptr = &lambda_123,
  .env = NULL  // no capture
};

FLValue result = fl_invoke(my_fn, fl_int(5));
```

### 3. Callback Invocation in C

**问题**: map/filter/reduce에서 콜백을 어떻게 호출?

```c
// Current C codegen can't do this?
FLValue fl_map(FLValue fn, FLValue arr) {
  FLValue result = fl_vec_new();
  
  // How to call fn?
  // Option A: fn->fn_ptr(item)?
  // Option B: fl_invoke(fn, item)?
  // Option C: fn(item)?
  
  for (int i = 0; i < fl_vec_len(arr); i++) {
    FLValue mapped = ??? call fn ???
    fl_vec_push(result, mapped);
  }
  return result;
}
```

---

## 검증 필요 사항

### 1. Basic HOF Support

```lisp
;; Test 1: Function as value
(define inc (fn [$x] (+ $x 1)))
(inc 5)  ;; → 6

;; Test 2: Pass function to map
(map inc [1 2 3])  ;; → [2 3 4]

;; Test 3: Filter with capture
(defn greater-than [$threshold]
  (fn [$x] (> $x $threshold)))

(define gt3 (greater-than 3))
(filter gt3 [1 2 3 4 5])  ;; → [4 5]
```

### 2. Multiple Arity

```lisp
;; Function accepting 1 argument
(fn [$x] (+ $x 1))

;; Function accepting 2 arguments
(fn [$x $y] (+ $x $y))

;; Partial application?
(define add-5 (fn [$x] (+ 5 $x)))
```

### 3. Nested HOF

```lisp
;; map over map result
(map (fn [$row]
  (map (fn [$x] (* $x 2)) $row))
[
  [1 2 3]
  [4 5 6]
])

;; → [[2 4 6] [8 10 12]]
```

---

## 현재 cgc-main.fl 관점에서의 영향

### 1. keys-no-line 함수

```lisp
(defn keys-no-line [m]
  (filter (fn [k] (not (= k "line"))) (json_keys m)))
```

**컴파일 과정**:
1. `fn [k] ...` → lambda 생성
2. `filter` → stdlib 함수 호출
3. `json_keys m` → 인자 계산
4. Result → 필터된 키 리스트

**C code gen 필요**:
- lambda_N 정적 함수 생성
- filter 호출
- 결과 사용

### 2. Codegen Loop Patterns

cgc-main.fl의 여러 함수가 accumulator pattern을 사용:
```lisp
(defn cgc-collect-vars-loop [$_args $_i $_acc]
  (loop [$i $_i $acc $_acc]
    (if (>= $i (length $_args)) $acc
    (recur (+ $i 1) (cgc-collect-vars ...)))))
```

이를 map/reduce로 다시 쓸 수 있으면:
```lisp
(reduce (fn [$acc $arg] 
  (merge $acc (cgc-collect-vars $arg)))
{} $_args)
```

더 간결해짐.

---

## 해결 경로 (Phase B)

### Step 1: HOF Stdlib Implementation (100줄)
```
- map, filter, reduce, for-each 구현
- 각 3 test cases
- JS ↔ C parity 검증
```

### Step 2: Function Value Representation (80줄)
```
- FLValue에 function 저장
- Closure capture 지원
- Invoke mechanism
```

### Step 3: C Code Gen for HOF (150줄)
```
- Anonymous function → static C function
- HOF call → fl_invoke 또는 direct call
- Callback passing in stdlib
```

### Step 4: Integration Test (60줄)
```
- cgc-main.fl 내 filter 호출 검증
- keys-no-line 함수 동작 확인
- 복합 HOF 패턴 테스트
```

---

## 승인 기준

- [ ] map/filter/reduce/for-each 모두 구현
- [ ] 각 함수 3+ test case 통과
- [ ] cgc-main.fl의 filter 호출 작동
- [ ] JS ↔ C 출력 100% 일치
- [ ] 성능: O(n) 시간, no stack overflow

---

## 우선순위

1. **RECUR-GAP** (CRITICAL) — 자가 컴파일 기반
2. **CLOSURE-GAP** (HIGH) — fn capture 필요
3. **HOF-GAP** (MEDIUM) — map/filter optional

---

**Status**: Phase A Self-host Gap Audit 완료  
**다음**: Phase B P2-Extended 구현 (1-2주)

