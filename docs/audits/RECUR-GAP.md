# Recur Termination Gap Analysis (cgc-main.fl)

**상태**: P2-Core 완성, P2-Extended 미완료  
**범위**: cgc-main.fl의 116개 loop/recur 패턴 검증  
**영향도**: CRITICAL — 컴파일러 코어 로직 (lexer, parser, codegen)

---

## 발견 내용

### 1. Loop/Recur Usage in cgc-main.fl

**통계**:
- 총 loop 사용: 116 occurrences
- 함수 개수: ~50개 함수가 loop/recur 사용
- 패턴: 대부분 accumulator 기반 tail-recursion

**예시들**:

#### Pattern A: String 파싱 (lexer)
```lisp
(defn skip-ws-loop [$_cur]
  (loop [$cur $_cur]
    (if (at-end? $cur) $cur
      (let [[$c (peek $cur)]]
        (cond
          [(is-space? $c) (recur (advance $cur))]
          [(= $c ";")     (recur (skip-comment $cur))]
          [true           $cur])))))
```
**특징**: 
- 상태 구조 `$cur` 계속 전달
- 3개 분기 (space, comment, stop)
- Termination: `at-end?` 또는 조건 만족

#### Pattern B: Number 파싱 (lexer)
```lisp
(defn read-number-iter [$_cur $_res_acc $_dot $line $col]
  (loop [$cur $_cur $res_acc $_res_acc $dot $_dot]
    (if (at-end? $cur) (emit $cur "Number" $res_acc $line $col)
      (let [[$c (peek $cur)]]
        (cond
          [(is-digit? $c)
           (recur (advance $cur) (str $res_acc $c) $dot)]
          [(and (= $c ".") (not $dot))
           (recur (advance $cur) (str $res_acc $c) true)]
          [true (emit $cur "Number" $res_acc $line $col)])))))
```
**특징**:
- 3개 변수 accumulate ($cur, $res_acc, $dot)
- Termination: `at-end?` 또는 non-matching char

#### Pattern C: List 순회 (parser/codegen)
```lisp
(defn cgc-let-1d [$it $i $acc]
  (if (>= $i (length $it)) $acc
  (let [[$n (cgc-extract-name (get $it $i))]
        [$v (cgc (get $it (+ $i 1)))]]
    (swap! known-fncall-targets-atom push $n)
    (swap! outer-params-atom push $n)
    (cgc-let-1d $it (+ $i 2) (str $acc "    FLValue " $n " = " $v ";\n")))))
```
**특징**:
- Index accumulation ($i += 2)
- Accumulator ($acc 문자열 빌더)
- Side effects (swap! atom push)
- Termination: `>= $i (length $it)`

#### Pattern D: Tree 순회 (AST)
```lisp
(defn cgc-collect-vars-loop [$_args $_i $_acc]
  (loop [$i $_i $acc $_acc]
    (if (or (null? $_args) (>= $i (length $_args))) $acc
    (recur (+ $i 1) (cgc-collect-vars (get $_args $i) $acc)))))
```
**특징**:
- 중첩 함수 호출 (cgc-collect-vars)
- Accumulator 병합
- Null check + length check

---

## 문제점 분석

### 1. Multiple Arguments in Recur

**문제**: recur가 2-4개 인자를 전달
```lisp
;; 2 arguments
(recur (advance $cur) (+ $i 1))

;; 3 arguments
(recur (advance $cur) (str $res_acc $c) $dot)

;; 4 arguments (없음, 대신 nested loop)
```

**현재 Native Backend 검증 필요**:
- [ ] 단일 변수 recur: `(recur value)`
- [ ] 2개 변수 recur: `(recur v1 v2)`
- [ ] 3개 변수 recur: `(recur v1 v2 v3)`
- [ ] 4개 변수 recur: (드물음)

### 2. Complex Termination Conditions

**Example 1: 여러 종료 조건**
```lisp
(if (or (null? $args) (>= $i (length $args))) $acc
  (recur (+ $i 1) ...))
```
문제: `or` 조건 2개 → Native code gen이 맞는가?

**Example 2: 중첩 조건**
```lisp
(cond
  [(is-digit? $c) (recur ...)]
  [(and (= $c ".") (not $dot)) (recur ...)]
  [true (emit ...)])  ;; termination
```
문제: 3개 분기 중 2개만 recur → tail call이 아님?

### 3. State Mutation with Recur

**문제**: swap! + recur 조합
```lisp
(swap! known-fncall-targets-atom push $n)
(cgc-let-1d $it (+ $i 2) ...)
```
- atom이 recur 도중 변경됨
- C code로 변환할 때 순서 보장이 되는가?

### 4. Nested Loop Calls

**문제**: loop 함수가 다른 loop 함수를 호출
```lisp
(defn cgc-collect-vars-loop [$_args $_i $_acc]
  (loop ...
    (recur ... (cgc-collect-vars ...))))
```
여기서 `cgc-collect-vars`도 내부적으로 loop 호출 → 스택 깊이 증가

---

## 검증 필요 사항

### 1. Tail Call Optimization (TCO)

**현재 Native Backend TCO 지원?**

```lisp
;; Simple tail recursion
(defn sum-to [$n $acc]
  (if (= $n 0) $acc
    (sum-to (- $n 1) (+ $acc $n))))

(sum-to 1000000 0)  ;; Stack overflow 없어야 함
```

**검증**:
- [ ] Fibonacci: `(fib 40)` → 102334155 (무한 시간 아님)
- [ ] Sum: `(sum-to 100000 0)` → 스택 오버플로우 없음
- [ ] String build: `(build-str 10000)` → O(n) 시간, O(1) 스택

### 2. Multiple Variable Recur

```lisp
(defn loop3 [$x $y $z]
  (if (> $x 100) [$x $y $z]
    (recur (+ $x 1) (+ $y 2) (+ $z 3))))

(loop3 0 0 0)  ;; → [100 200 300]
```

**검증**:
- [ ] 3개 변수 모두 정확히 업데이트
- [ ] C code: `x += 1; y += 2; z += 3;` 형태로 최적화?

### 3. Recur in Cond Branches

```lisp
(defn classify [$n]
  (loop [$i 0]
    (cond
      [(= $i 3) "three"]
      [(even? $i) (recur (+ $i 1))]
      [true (recur (+ $i 2))])))
```

**검증**:
- [ ] cond 내 여러 recur 분기 모두 동일 loop로 매핑
- [ ] termination (return) 분기와 recur 분기 혼합

---

## 예상 Native Code Gen

### Before (JS)
```lisp
(defn cgc-let-1d [$it $i $acc]
  (if (>= $i (length $it)) $acc
    (let [...]
      (swap! known-fncall-targets-atom push ...)
      (cgc-let-1d $it (+ $i 2) ...))))
```

### After (C - Expected)
```c
FLValue cgc_let_1d(FLValue it, int i, FLValue acc) {
loop_start:
  if (i >= fl_length(it)) return acc;
  
  FLValue n = ...;
  FLValue v = ...;
  
  // Side effect
  fl_vec_push(known_fncall_targets, n);
  
  // Tail call optimization
  i += 2;
  acc = fl_str_cat(acc, ...);
  goto loop_start;  // TCO
}
```

---

## 해결 경로 (Phase B)

### Step 1: Recur Analysis (120줄)
- loop 변수 개수 분석
- recur 인자 개수 검증
- TCO 가능성 판단

### Step 2: C Code Gen (200줄)
- goto label 기반 TCO
- 변수 할당 최적화
- Side effect 순서 보장

### Step 3: Validation Suite (100줄)
- 6가지 recur 패턴
- Stack depth 측정
- JS ↔ C 시간 비교

---

## 승인 기준

- [ ] cgc-main.fl의 116개 loop/recur 모두 작동
- [ ] Stack overflow 없음 (1M 반복 가능)
- [ ] JS ↔ C 출력 동일
- [ ] C code가 tail call 최적화됨

---

**다음**: [HOF-GAP.md](./HOF-GAP.md) (고차 함수 호환성)
