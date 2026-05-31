# Recur Gap Audit

**상태**: P2-Extended 미해결 항목  
**영향도**: Medium (tail call 최적화 차단)  
**추정 노력**: S (소규모)

---

## 현상

recur.fl 파일이 examples/ 디렉토리에 없음.

하지만 loop.fl에서 recur를 사용하고 있으며, C로 컴파일 시:

```bash
$ node bootstrap.js compile examples/loop.fl --target c
→ 성공 (recur이 C로 정상 변환)
```

**의문**: recur가 이미 동작하는데 왜 gap인가?

---

## 분석

### recur의 현재 상태

#### FL 코드
```lisp
(loop [i 0 sum 0]
  (if (< i 10)
    (recur (inc i) (+ sum i))
    sum))
```

#### 생성 C 코드
```c
while (true) {
  if (__condition) {
    i = __new_i;
    sum = __new_sum;
    continue;  /* ← recur = continue */
  } else {
    return sum;
  }
}
```

**✅ Loop + Recur**: 동작함. C의 continue로 충분.

### recur의 제약

#### 1. Mutual Recursion 미지원

```lisp
(defn is-even [n]
  (if (= n 0) true (is-odd (dec n))))

(defn is-odd [n]
  (if (= n 0) false (is-even (dec n))))
```

C로 컴파일 시:
```c
/* forward declaration 필요하지만 recur는 loop 내부에만 가능 */
/* is-even → is-odd 호출 → 오류 */
```

**상태**: ❌ 미지원

#### 2. Named Recur 미지원

```lisp
(defn fibonacci [n]
  (letfn [[fib [n acc]
           (if (<= n 1) acc (recur (dec n) (+ acc n)))]]
    (fib n 1)))
```

C로 컴파일 시:
```c
/* recur이 어느 함수로 돌아갈지 불명확 */
```

**상태**: ⚠️ 부분 지원 (명시적 fn-name 필요)

#### 3. Recur in Higher-Order Context

```lisp
(define fib-lazy
  (fn [n]
    (loop [i 0 a 0 b 1]
      (if (< i n)
        (recur (inc i) b (+ a b))
        a))))
```

**상태**: ✅ 이미 동작 (closure 제약이 있을 뿐)

---

## 기술 부채 맵

```
Loop + Recur (core case)
  ✅ 동작

Named Functions + Mutual Recursion
  ❌ 미지원
     └─ 이유: 함수 호출이 loop 문맥 밖
     └─ 해결: explicit trampolining / CPS

Letfn + Named Recur
  ⚠️ 부분 지원
     └─ 이유: 함수 스코프 불명확
     └─ 해결: scope analysis

Higher-Order + Recur
  ⚠️ 부분 지원
     └─ 이유: closure 환경에서 recur 의미 불명확
     └─ 해결: closure-gap 해결 후 자동 해결
```

---

## 우선순위 평가

### Tier 1: 긴급 (이미 동작)
- Loop + Recur ✅

### Tier 2: 중요 (실용적 필요)
- Mutual Recursion (CPS 변환)
- Named Let-Recur

### Tier 3: 고급 (미래)
- Trampolining optimization
- Tail call stack overflow 감지

---

## recur 제약 정리

### 현재 지원
```lisp
(loop [x y z] (if cond (recur ...) result))
```

### 미지원
```lisp
; 1. Mutual recursion
(defn even [n] (if (= n 0) true (odd (dec n))))
(defn odd [n] (if (= n 0) false (even (dec n))))

; 2. Named let-recur with ambiguous scope
(letfn [[fib [n] (if (<= n 1) n (recur (dec n)))]])  ; 어느 arity?

; 3. Recur outside loop context
(defn factorial [n]
  (if (= n 0) 1 (recur (dec n))))  ; ← recur는 loop 내부용
```

---

## 해결책

### Option A: 현 상태 유지

loop+recur만 지원하고, 다른 경우는 명시적 재귀 함수 사용.

**Pro**: 구현 단순  
**Con**: 교육용 언어로 불완전

### Option B: CPS 변환

mutual recursion → trampolining via explicit return value

```lisp
(defn even [n]
  (fn [] (if (= n 0) true ((odd (dec n))))))
```

**Pro**: 완전한 패턴 지원  
**Con**: 성능 오버헤드, 문법 복잡

### Option C: Tail Call Analysis

compiler가 tail position 감지 → 자동 trampolining

```lisp
(defn even [n]
  (if (= n 0) true (even (dec n))))  ; ← tail call 감지 → optimize
```

**Pro**: 투명함  
**Con**: 복잡한 분석, 디버깅 어려움

---

## 권장

**현 상태 유지** + **문서화**

- loop+recur는 최적화된 형태로 지원
- mutual recursion이 필요하면 explicit fn parameter로 우회 가능
- P3 단계에서 CPS/trampolining 재평가

---

## 검증 체크리스트

- [x] loop+recur 동작 확인 (이미 완료)
- [ ] recur 제약 문서화 (STDLIB_REFERENCE.md)
- [ ] 교육 예제에 우회 패턴 추가
- [ ] 향후 optimization 설계 (P3)

---

**다음**: verify-full 정리 + P3 설계 문서
