# Closure Capture Gap Analysis (cgc-main.fl)

**상태**: P2-Core 완성, P2-Extended 미완료  
**범위**: cgc-main.fl에서 발견된 클로저 캡처 누락 사항  
**영향도**: HIGH — 코드 생성기 핵심 로직

---

## 발견 내용

### 1. Closure Capture Avoidance Pattern

**현재 코드** (line 966-975):
```lisp
;; 캡처 후보 필터 (closure 대신 loop — self-host 캡처 분석 회피)
(defn cgc-fn-caps-filter [$all-vars $param-names $outer $i $acc]
  (if (>= $i (length $all-vars))
    $acc
    (let [[$v (get $all-vars $i)]]
      (cgc-fn-caps-filter $all-vars $param-names $outer (+ $i 1)
        (if (and (not (includes-item $param-names $v))
                 (includes-item $outer $v))
          (push $acc $v)
          $acc)))))
```

**문제**: 
- 주석이 명시적으로 "closure 대신 loop — self-host 캡처 분석 회피" (avoids closure capture analysis)
- 이는 현재 Native Backend가 closure capture를 제대로 지원하지 않는다는 증거
- 함수가 `$all-vars`, `$param-names`, `$outer` 3개 변수를 계속 넘김 → 번거로운 패턴

### 2. Closure Capture in Lambda

**현재 코드** (line 374):
```lisp
(defn keys-no-line [m]
  (filter (fn [k] (not (= k "line"))) (json_keys m)))
```

**문제**:
- `fn [k] ...`는 pure function (외부 변수 캡처 없음)
- 하지만 더 복잡한 경우 바깥 함수의 변수를 캡처해야 함
- 예: `(defn wrap [$x] (fn [$y] (+ $x $y)))` — $x를 캡처해야 함

### 3. Variable Capture in Let Bindings

**현재 코드** (line 1072-1078):
```lisp
(defn cgc-let-1d [$it $i $acc]
  (if (>= $i (length $it)) $acc
  (let [[$n (cgc-extract-name (get $it $i))]
        [$v (cgc (get $it (+ $i 1)))]]
    (swap! known-fncall-targets-atom push $n)
    (swap! outer-params-atom push $n)
    (cgc-let-1d $it (+ $i 2) (str $acc "    FLValue " $n " = " $v ";\n")))))
```

**문제**:
- let 블록 안에서 `$n` 변수를 atom에 저장 → side effect 기반
- 다음 재귀 호출에서 이전 상태 참조 → implicit closure capture
- Native code gen에서 이를 제대로 처리하는가?

---

## 필요한 P2-Extended 구현

### 1. Closure Capture Semantics

**요구사항**:
```lisp
;; Case 1: 단순 캡처
(defn make-adder [$x]
  (fn [$y] (+ $x $y)))

(define add5 (make-adder 5))
(add5 3)  ;; → 8

;; Case 2: 중첩 캡처
(defn make-multiplier [$x]
  (fn [$y]
    (fn [$z] (* $x $y $z))))

;; Case 3: 재귀 함수가 자신을 캡처
(defn factorial-maker []
  (fn [$n]
    (if (< $n 2) 1
      (* $n ((factorial-maker) (- $n 1))))))
```

**검증 기준**:
- [ ] C codegen이 captured variable 배열 생성
- [ ] Lambda 함수가 captured variables을 `env` 배열에 저장
- [ ] 호출 시 captured values 정확히 복원
- [ ] JS ↔ C 출력 일치 (parity)

### 2. Closure in Map/Filter

**요구사항**:
```lisp
;; 외부 변수 $threshold를 캡처하는 filter
(defn filter-threshold [$threshold $items]
  (filter (fn [$x] (> $x $threshold)) $items))

(filter-threshold 5 [1 3 5 7 9])  ;; → [7 9]
```

**검증**:
- [ ] fn [k] ...에서 $threshold 캡처
- [ ] filter 콜백이 captured variable 접근 가능

### 3. Closure Recursion

**요구사항**:
```lisp
;; 클로저가 자신을 재귀 호출
(defn counter-maker []
  (fn [$n]
    (if (<= $n 0) "done"
      (do
        (println $n)
        ((counter-maker) (- $n 1))))))
```

---

## 현재 제약사항 (P1-5 Level)

| 기능 | 지원 | 비고 |
|------|------|------|
| Simple fn (no capture) | ✅ | `(fn [x] (+ x 1))` |
| Captured scalar | ❓ | `(fn [y] (+ $x y))` |
| Captured collection | ❓ | `(fn [item] (get $arr item))` |
| Multiple captures | ❓ | `(fn [z] (+ $x $y z))` |
| Nested captures | ❌ | `(fn [] (fn [] $x))` |
| Capture in recur | ❌ | `(loop [x $captured] ...)` |

---

## 해결 경로 (Phase B)

### Step 1: Capture Analysis (100줄)
```
- 함수 body 스캔 → 외부 변수 감지
- $param과 captured variables 구분
- Captured variable list 생성
```

### Step 2: C Codegen (150줄)
```
- FLValue env[] 배열 생성 코드
- 함수 호출 시 env 초기화
- 함수 내부에서 env[i] 복원
```

### Step 3: Runtime Support
```
- fl_fn_new() 함수 signature 확장
- captured values 저장소 관리
```

### Step 4: Test Suite (80줄)
```
- 6가지 closure 패턴 검증
- JS/C parity 비교
```

---

## 승인 기준

- [ ] P1-5 Level 코드 변경 없음 (backward compatible)
- [ ] cgc-main.fl이 closure capture 없이 compile 가능
- [ ] 새 코드는 closure를 활용해 더 간단해짐
- [ ] JS ↔ C 출력 100% 일치

---

**다음**: RECUR-GAP.md (재귀 함수 최적화 검증)

