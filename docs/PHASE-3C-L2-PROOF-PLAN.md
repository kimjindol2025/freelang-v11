# Phase 3-C: L2 증명 — Semantic Preservation 자동화

**목표**: Stage 1 (bootstrap) vs Stage 2 (self-hosted) 의미 동등성(semantic equivalence) 증명  
**기간**: 1주 (계획서 + 자동화 스크립트)  
**산출물**: Jest 테스트 + verify-l2.sh + 12개 핵심 케이스

---

## 📋 테스트 케이스 분류 (12개 범주)

### 1️⃣ 산술 연산 (Arithmetic)
```fl
; 기본 연산: +, -, *, /, %
; 음수, 부동소수점, 오버플로우
(defun test-arithmetic []
  (list
    (+ 5 3)        ; 8
    (- 10 4)       ; 6
    (* 7 2)        ; 14
    (/ 15 3)       ; 5
    (% 17 5)       ; 2
    (- 42)))       ; -42
```

### 2️⃣ 비교 연산 (Comparisons)
```fl
; =, <, >, <=, >=, !=
(defun test-comparisons []
  (list
    (= 5 5)        ; true
    (< 3 7)        ; true
    (> 10 4)       ; true
    (<= 5 5)       ; true
    (>= 6 2)       ; true
    (!= 3 3)))     ; false
```

### 3️⃣ 논리 연산 (Logic)
```fl
; and, or, not
(defun test-logic []
  (list
    (and true true)      ; true
    (and true false)     ; false
    (or false false)     ; false
    (or true false)      ; true
    (not true)           ; false
    (not false)))        ; true
```

### 4️⃣ 제어 흐름 (Control Flow)
```fl
; if, cond, while, loop
(defun test-control []
  (list
    (if true 10 20)      ; 10
    (if false 10 20)     ; 20
    (cond
      [(< 5 3) "a"]
      [(> 5 3) "b"]
      [true "c"])        ; "b"
    (loop [n 0 acc 0]
      (if (>= n 3) acc
        (loop (+ n 1) (+ acc n))))))  ; 0+1+2 = 3
```

### 5️⃣ 함수 정의 (Functions)
```fl
; defun, 클로저, 고차함수
(defun test-functions []
  (let [[add (fn [a b] (+ a b))]
        [apply-twice (fn [f x] (f (f x)))]]
    (list
      (add 3 4)                    ; 7
      ((fn [x] (* x 2)) 5)        ; 10
      (apply-twice (fn [x] (+ x 1)) 5)))) ; 7
```

### 6️⃣ 배열/맵 (Collections)
```fl
; array, map, get, set, append
(defun test-collections []
  (let [[arr [1 2 3]]
        [m {:x 10 :y 20}]]
    (list
      (get arr 0)           ; 1
      (get m :x)            ; 10
      (append arr [4 5])    ; [1 2 3 4 5]
      (length arr)          ; 3
      (map (fn [x] (* x 2)) arr))))  ; [2 4 6]
```

### 7️⃣ 패턴 매칭 (Pattern Matching)
```fl
; pattern-match, 구조 분해
(defun test-patterns []
  (let [[result
         (cond
           [(null? null) "null"]
           [(list? [1 2]) "list"]
           [(map? {:a 1}) "map"]
           [true "other"])]]
    (list result)))
```

### 8️⃣ 비동기/예외 (Async & Exceptions)
```fl
; try/catch, throw (await는 미지원 검증)
(defun test-async-errors []
  (list
    (try
      (throw "test-error")
      (catch e (str "caught: " e)))))  ; "caught: test-error"
```

### 9️⃣ 문자열 (Strings)
```fl
; string ops: str, substring, length, split, join
(defun test-strings []
  (list
    (str "hello" " " "world")          ; "hello world"
    (substring "hello" 1 4)            ; "ell"
    (length "abc")                     ; 3
    (split "a,b,c" ",")               ; ["a" "b" "c"]
    (join ["x" "y" "z"] "-")))        ; "x-y-z"
```

### 🔟 타입 검사 (Type Checks)
```fl
; null?, list?, map?, string?, number?
(defun test-types []
  (list
    (null? null)          ; true
    (list? [1 2 3])       ; true
    (map? {:a 1})         ; true
    (string? "hello")     ; true
    (number? 42)))        ; true
```

### 1️⃣1️⃣ 재귀 (Recursion)
```fl
; 피보나치, 팩토리얼
(defun fib [n]
  (if (<= n 1) n
    (+ (fib (- n 1)) (fib (- n 2)))))

(defun fact [n]
  (if (<= n 1) 1
    (* n (fact (- n 1)))))

(defun test-recursion []
  (list
    (fib 6)    ; 8
    (fact 5))) ; 120
```

### 1️⃣2️⃣ 엣지 케이스 (Edge Cases)
```fl
; null 처리, 빈 배열, 0/1, 음수
(defun test-edges []
  (list
    (+ 0 0)              ; 0
    (* 1 1)              ; 1
    (get [] 0)           ; null
    (get {:} :x)         ; null
    (length [])          ; 0
    (str null)))         ; "null"
```

---

## 🧪 Jest 테스트 구조

### src/__tests__/semantic-preservation.test.ts

```typescript
describe('L2 Proof: Semantic Preservation (Stage1 vs Bootstrap)', () => {
  // 각 케이스별로:
  // 1. bootstrap으로 FL 컴파일 → JS1
  // 2. stage1으로 FL 컴파일 → JS2
  // 3. 실행 후 결과 비교

  it('arithmetic: 결과가 일치해야 함', async () => {
    // expect(bootstrapResult).toEqual(stage1Result)
  });

  it('control-flow: if/cond 분기 일치', async () => {
    // 각 분기 결과 검증
  });

  // ... 12개 테스트 케이스
});
```

---

## 📊 검증 전략

### Level 1: 동작 동등성 (Behavioral Equivalence)
- ✅ 두 구현의 **런타임 결과가 동일**
- 비교 방식: `JSON.stringify(bootstrap_result) === JSON.stringify(stage1_result)`
- 대상: 모든 12개 케이스

### Level 2: 비트 동등성 (Bitwise Equivalence) — 선택적
- AST 구조 동일 여부 검증 (도구: shasum AST)
- 생성된 JS 코드 구조 비교 (도구: AST diffing)
- 대상: 핵심 3개 케이스 (arithmetic, control-flow, functions)

### Level 3: 성능 동등성 — 나중
- 동일 입력에 대한 실행 시간 비교
- 목표: stage1 성능 ≥ bootstrap × 0.8 (20% 성능 패널티)

---

## 🔧 자동화 스크립트 (verify-l2.sh)

**위치**: `scripts/verify-l2-proof.sh`  
**기능**:
1. `tests/l2-proof/` 하위 모든 FL 파일 열거
2. 각 파일을 bootstrap + stage1으로 컴파일
3. 생성된 JS 실행 → 결과 수집
4. 비교 및 리포트 생성

**출력**:
```
L2 Proof: Semantic Preservation Results
========================================

✅ arithmetic.fl: PASS (bootstrap === stage1)
✅ comparisons.fl: PASS
✅ logic.fl: PASS
✅ control-flow.fl: PASS
✅ functions.fl: PASS
✅ collections.fl: PASS
✅ pattern-matching.fl: PASS
✅ async-errors.fl: PASS
✅ strings.fl: PASS
✅ type-checks.fl: PASS
✅ recursion.fl: PASS
✅ edge-cases.fl: PASS

========================================
Summary: 12/12 PASS (100%)
Verified: 2026-04-22 10:30:45 UTC
Fixed-Point: ✅ STABLE
```

---

## 📅 구현 일정

| 항목 | 목표 | 예상 시간 |
|------|------|---------|
| 테스트 계획서 (본 문서) | 완료 | 완료 |
| 12개 FL 케이스 작성 | 2026-04-23 | 4시간 |
| Jest 테스트 구조 + 코드 | 2026-04-23 | 3시간 |
| verify-l2.sh 스크립트 | 2026-04-24 | 2시간 |
| 통합 테스트 및 회귀 | 2026-04-24 | 2시간 |
| **총계** | **2026-04-24** | **11시간** |

---

## ✅ 성공 기준

- [ ] 12개 케이스 모두 작성 및 실행 가능
- [ ] Jest 테스트 통과율 ≥ 95% (11/12 이상)
- [ ] verify-l2.sh 통과 후 CI/CD 통합 가능
- [ ] 기존 테스트 회귀 없음 (639/646 유지 이상)
- [ ] 문서 완성도 ≥ 90%

---

## 🎯 다음 단계 (Phase 3-D~E)

- **Phase 3-D**: AI 라이브러리 (self/stdlib/ai.fl) — L2 증명 완료 후
- **Phase 3-E**: VM opt-in 최적화 — AI lib 완료 후
- **Phase 4**: stage1 자가호스팅 복구 (파라미터 버그 수정)

---

**준비 상태**: 완전 준비 완료 ✅  
**시작 신호 대기 중**: "만들어주세요" 🚀
