# Closure Gap Audit

**상태**: P2-Extended 미해결 항목  
**영향도**: High (고차 함수 패턴 차단)  
**추정 노력**: M (1~2 sprint)

---

## 현상

### 테스트 코드 (closure.fl)

```lisp
(defn make-adder [n]
  (fn [x] (+ n x)))

(define add5 (make-adder 5))
(println (add5 3))  ;; 기대: 8
```

### 실패 모드

```bash
$ node bootstrap.js compile examples/closure.fl --target c
/tmp/closure.c: In function '__fl_anon_2':
closure.c:29:19: error: 'n' undeclared (first use in this function)
```

---

## 근본 원인 분석

### 1. Parser 층 (✅ 정상)

```
(fn [x] (+ n x))
→ 파싱됨: SEX { op: "fn", params: [x], body: (+ n x) }
```

Parser는 n을 식별자로 정확히 파싱. 문제 없음.

### 2. Lowering 층 (⚠️ 문제)

FL 코드 → 중간 코드 단계:

```lisp
; 이상적:
(fn [x] (+ n x))
→ Lambda {
    params: [x],
    body: (+ n x),
    captures: [n]  ;; ← 캡처 리스트 필수
  }

; 현재 구현:
(fn [x] (+ n x))
→ Lambda {
    params: [x],
    body: (+ n x)
    ;; captures 필드 없음!
  }
```

**확인**: cgc-main.fl에서 `captures` 필드를 추출하는 로직이 없음.

### 3. Code Generation 층 (✅ 부분 준비)

cgc-main.fl에는 lambda 처리 로직이 있지만, 환경 캡처 미구현.

### 4. Runtime 층 (⏳ 구현 부재)

C ABI에서 클로저 표현:

```c
/* 현재: 함수 포인터만 */
typedef FLValue (*FLCallable)(FLClosure*, int, FLValue*);

/* 필요: 환경 캡처 구조체 */
typedef struct {
  FLCallable fn;
  FLValue*   env;      /* 캡처된 변수들 */
  uint32_t   env_len;
} FLClosure;
```

---

## 기술 부채 맵

```
Parser
  ✅ (fn [x] ...) 파싱 완료

         ↓

Lowering
  ❌ captures 필드 추출 부재
     └─ 필요: scope analysis + free variable detection

         ↓

Code Generation
  ⚠️ lambda forward decl 있음
  ❌ 환경 구조체 생성 미구현

         ↓

Runtime
  ⚠️ FLClosure 타입 존재 (불완전)
  ❌ 클로저 호출 ABI 미구현

         ↓

Output (C Code)
  ❌ 생성되지 않음
```

---

## 해결책 로드맵

### Phase 1: Lowering (scope analysis)

cgc-main.fl에 free-variable extraction 추가.

### Phase 2: Code Generation

Lambda_N_Env 구조체로 환경 표현.

### Phase 3: Runtime ABI

fl_closure_call 함수 구현.

---

## 검증 체크리스트

- [ ] free-var extraction (cgc-main.fl)
- [ ] captures 필드 적용
- [ ] Lambda_N_Env 구조체 생성
- [ ] closure.fl → C 컴파일
- [ ] parity-test 통과

---

**다음**: recur-gap.md
