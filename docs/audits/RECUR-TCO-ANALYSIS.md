# Recur TCO 분석 및 구현 계획

**목표**: cgc-main.fl의 116개 loop/recur를 Native Backend에서 정확히 작동

---

## 현재 구현 (codegen-c.fl, line 662-693)

### While-Loop 기반 구현

```c
// codegen-c.fl cgc-loop function
FLValue result;
int _fl_looping = 1;
while (_fl_looping) {
  _fl_looping = 0;
  
  // Loop body execution
  result = body_code_here;
  
  // If recur called:
  // 1. Evaluate recur arguments → temps
  // 2. Assign temps to loop vars
  // 3. Set _fl_looping = 1
  // (then loop continues)
}
return result;
```

### 현재 코드의 문제점

1. **Stack Safety는 보장하지만 비효율**
   - While 루프는 각 반복마다 함수 스택 프레임 누적 가능
   - 특히 recur 내부에서 다른 함수 호출 시 스택 깊이 증가

2. **변수 임시 할당의 오버헤드**
   ```c
   FLValue _fl_t0 = /* arg0 */;
   FLValue _fl_t1 = /* arg1 */;
   FLValue _fl_t2 = /* arg2 */;
   var0 = _fl_t0;
   var1 = _fl_t1;
   var2 = _fl_t2;
   ```
   3개 변수마다 6줄 코드 생성

3. **복합 표현식 평가 순서**
   ```lisp
   (recur (advance $cur) (str $res_acc $c) $dot)
   ```
   이 3개 인자가 모두 평가되어야 하는데, 임시변수에 저장하는 과정에서 side effects 가능

---

## 개선 방안: True TCO with Goto Labels

### 개선된 코드 구조

```c
FLValue loop_label_1() {
  FLValue var0, var1, var2;
  var0 = init0; var1 = init1; var2 = init2;
  
loop_continue_1:
  {
    FLValue result = /* body */;
    
    // If recur encountered:
    var0 = new_val0;
    var1 = new_val1;
    var2 = new_val2;
    goto loop_continue_1;  // True TCO!
  }
  
  return result;
}
```

**장점**:
- True tail call (goto를 통한 즉시 점프)
- 임시변수 할당 최소화
- 스택 깊이 1유지 (loop 함수 자체만)

---

## 구현 단계

### Step 1: Loop Variable Analysis (40줄)

**목표**: loop 선언에서 변수 정보 추출

```lisp
(defn loop-analyze [$items]
  "
  Input: (loop [$x init-x $y init-y] ...)
  Output: {:vars [\"x\" \"y\"]
           :inits [init-x init-y]
           :count 2}
  ")
```

**코드위치**: codegen-c.fl 이후 추가

### Step 2: Recur Arguments Validation (50줄)

**목표**: recur 인자 개수와 루프 변수 개수 일치 확인

```lisp
(defn recur-validate [$recur-node $loop-vars]
  "
  Check:
  - recur 인자 개수 = loop 변수 개수
  - 인자가 모두 평가 가능한 표현식
  - Side effects 없는 인자들 (pure expressions)
  ")
```

### Step 3: Label-Based Code Generation (120줄)

**목표**: goto label 기반 C 코드 생성

```lisp
(defn cgc-loop-with-labels [$items $body $vars]
  "
  1. Loop label 생성: _fl_loop_123
  2. 변수 선언: FLValue var0, var1, var2
  3. 초기값 할당: var0 = init0; ...
  4. Label 생성: _fl_loop_123:
  5. Body 실행: result = body;
  6. Recur 처리: goto _fl_loop_123
  7. 반환: return result;
  ")
```

### Step 4: Validation Suite (100줄)

**목표**: 6가지 recur 패턴 검증

```lisp
;; Pattern 1: Simple increment
(defn count-to [$n $acc]
  (loop [$i 0]
    (if (>= $i $n) $acc
      (recur (+ $i 1)))))

;; Pattern 2: Multiple variables
(defn sum-to [$n $acc]
  (loop [$i 0 $sum 0]
    (if (>= $i $n) $sum
      (recur (+ $i 1) (+ $sum $i)))))

;; Pattern 3: String accumulation (like cgc-main.fl)
(defn build-str [$n]
  (loop [$i 0 $acc ""]
    (if (>= $i $n) $acc
      (recur (+ $i 1) (str $acc (str $i))))))

;; Pattern 4: State mutation (cgc-let-1d style)
(defn process-list [$items]
  (loop [$i 0 $result []]
    (if (>= $i (length $items)) $result
      (recur (+ $i 1) (push $result (get $items $i))))))

;; Pattern 5: Nested termination (cond with recur)
(defn classify [$n]
  (loop [$i 0]
    (cond
      [(= $i 3) "done"]
      [(even? $i) (recur (+ $i 1))]
      [true (recur (+ $i 2))])))

;; Pattern 6: Complex expressions
(defn filter-sum [$items $threshold]
  (loop [$i 0 $sum 0]
    (if (>= $i (length $items)) $sum
      (let [[$val (get $items $i)]]
        (recur (+ $i 1) (if (> $val $threshold) (+ $sum $val) $sum))))))
```

---

## 성능 목표

### Before (While-loop)
- Stack depth: 증가 가능 (nested calls)
- Code size: 각 recur당 6-10줄
- Execution: Flag 체크 오버헤드

### After (Goto-based)
- Stack depth: 상수 (loop function 자체)
- Code size: 각 recur당 3-5줄
- Execution: 직접 점프 (faster)

### 벤치마크 기준
```
(sum-to 100000 0) 
  - Before: ~10ms (if no stack issues)
  - After: ~5ms (2x faster)
  
(build-str 10000)
  - Before: ~50ms (string concat overhead)
  - After: ~25ms (no temp variable overhead)
```

---

## 코드 수정 위치

### 파일: `/home/kimjin/freelang-v11/self/codegen-c.fl`

**교체할 함수들**:

1. `cgc-loop` (line 662-673) → 새 구현
2. `cgc-recur-stmt` (line 688-693) → 새 구현
3. `cgc-recur-temps` (line 676-679) → 제거 또는 단순화
4. `cgc-recur-assigns` (line 682-685) → 단순화

**추가할 함수들**:

1. `cgc-loop-label-id` — label 생성
2. `cgc-loop-var-inits` — 변수 초기화 코드
3. `cgc-recur-with-goto` — goto 기반 recur

---

## 다음 단계

### 즉시 (2-3시간)
1. Step 1-2: 분석 함수 작성 (90줄)
2. Step 3: Label 기반 코드젠 (120줄)
3. Step 4: 6가지 패턴 검증 (100줄)

### 검증 (1-2시간)
1. cgc-main.fl의 116개 loop/recur 모두 작동 확인
2. JS ↔ C 출력 동일 검증
3. 성능 비교

### 최종 (30분)
1. 메모리 업데이트
2. Commit & Push
3. Phase B-2 준비 (Closure Capture)

---

**Status**: Phase B-1 준비 완료, 개발 시작

