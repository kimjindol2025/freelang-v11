# Stage 2 C 코드젠 지원 범위

작성일: 2026-05-13  
기준: ROADMAP.md Stage 2, ABI.md

---

## 지원할 것 (S2)

### AST node kinds

| kind | 설명 | C 변환 |
|------|------|--------|
| `literal` number | 숫자 리터럴 | `fl_int(v)` / `fl_float(v)` |
| `literal` string | 문자열 리터럴 | `fl_str_val("v")` |
| `literal` boolean | true/false | `fl_bool(true/false)` |
| `literal` nil/null | nil | `fl_nil()` |
| `variable` | 변수 참조 | 그대로 C 변수명 |
| `sexpr` → `defn` | 최상위 함수 정의 | `FLValue name(FLValue a, ...)` |
| `sexpr` → `define` | 전역 변수 | `FLValue name = ...;` (파일 스코프) |
| `sexpr` → `let` | 로컬 변수 | `FLValue name = ...;` (블록 스코프) |
| `sexpr` → `if` | 조건 분기 | `(fl_truthy(cond) ? then : else)` |
| `sexpr` → `cond` | 다중 조건 | 중첩 삼항 연산자 |
| `sexpr` → `do` | 블록 | C 복합문 `{ ... }` |
| `sexpr` → `+` | 덧셈 | `fl_add(a, b)` |
| `sexpr` → `-` | 뺄셈/음수 | `fl_sub(a, b)` |
| `sexpr` → `*` | 곱셈 | `fl_mul(a, b)` |
| `sexpr` → `/` | 나눗셈 | `fl_div(a, b)` |
| `sexpr` → `%` | 나머지 | `fl_mod(a, b)` |
| `sexpr` → `=` | 동등 비교 | `fl_eq(a, b)` |
| `sexpr` → `<` | 작다 | `fl_lt(a, b)` |
| `sexpr` → `>` | 크다 | `fl_gt(a, b)` |
| `sexpr` → `<=` | 작거나 같다 | `fl_lte(a, b)` |
| `sexpr` → `>=` | 크거나 같다 | `fl_gte(a, b)` |
| `sexpr` → `!=` | 다름 | `fl_neq(a, b)` |
| `sexpr` → `and` | 논리 AND | `fl_and(a, b)` |
| `sexpr` → `or` | 논리 OR | `fl_or(a, b)` |
| `sexpr` → `not` | 논리 NOT | `fl_not(a)` |
| `sexpr` → `println` | 출력 | `fl_println(v)` |
| `sexpr` → 함수 호출 | 일반 호출 | `name(a, b, ...)` |

---

## 지원 안 할 것 (S2)

| kind / op | 이유 |
|-----------|------|
| `sexpr` → `fn` (클로저) | FLClosure 힙 할당 + immutable capture — S3+ |
| `sexpr` → `loop` / `recur` | C while + state 관리 복잡 — S3+ |
| `template-string` | 문자열 보간 — 단순 str로 대체 가능 |
| `try` / `catch` / `finally` | setjmp/longjmp 필요 — S3+ |
| `throw` | 동일 |
| `await` | async 없음 |
| `pattern-match` | 복잡한 분기 생성 — S3+ |
| `block` Map/Array 리터럴 | 런타임 할당 필요 — S3+ |
| `sexpr` → `map` / `filter` | fn 파라미터 필요 — S3+ |
| `module` / `import` | 링크 전략 미결정 — S4+ |
| `keyword` | S2 테스트에서 불필요 |

---

## runtime.c 제공 함수 목록

### 값 생성

```c
FLValue fl_int(int64_t v);
FLValue fl_float(double v);
FLValue fl_str_val(const char* s);
FLValue fl_bool(bool v);
FLValue fl_nil(void);
```

### 조건 판별

```c
bool fl_truthy(FLValue v);
/* FL_BOOL → .b, FL_NIL → false, FL_INT → i!=0, else → true */
```

### 산술

```c
FLValue fl_add(FLValue a, FLValue b);
FLValue fl_sub(FLValue a, FLValue b);
FLValue fl_mul(FLValue a, FLValue b);
FLValue fl_div(FLValue a, FLValue b);
FLValue fl_mod(FLValue a, FLValue b);
```

### 비교

```c
FLValue fl_eq(FLValue a, FLValue b);
FLValue fl_lt(FLValue a, FLValue b);
FLValue fl_gt(FLValue a, FLValue b);
FLValue fl_lte(FLValue a, FLValue b);
FLValue fl_gte(FLValue a, FLValue b);
FLValue fl_neq(FLValue a, FLValue b);
```

### 논리

```c
FLValue fl_not(FLValue a);
FLValue fl_and(FLValue a, FLValue b);
FLValue fl_or(FLValue a, FLValue b);
```

### I/O

```c
FLValue fl_println(FLValue v);
FLValue fl_print(FLValue v);
```

### 문자열

```c
FLValue fl_str2(FLValue a, FLValue b);   /* str 2인자 */
FLValue fl_str_n(int n, ...);            /* str n인자 */
```

---

## 코드젠 변환 예시

### 입력 (FL)

```lisp
(defn fib [n]
  (if (<= n 1) n (+ (fib (- n 1)) (fib (- n 2)))))
(println (fib 10))
```

### 출력 (C)

```c
#include "runtime.h"

FLValue fib(FLValue n) {
    return fl_truthy(fl_lte(n, fl_int(1)))
        ? n
        : fl_add(fib(fl_sub(n, fl_int(1))), fib(fl_sub(n, fl_int(2))));
}

int main(void) {
    fl_println(fib(fl_int(10)));
    return 0;
}
```

---

## 파일 구조

```
self/
  codegen-c.fl   ← 새로 작성 (S2-B)
  all.fl         ← 기존 JS 코드젠 (건드리지 않음)

runtime/
  runtime.h      ← ABI 헌법 기반 타입 정의
  runtime.c      ← 위 함수 전부 구현 (S3)
```

---

## S2-A 통과 기준

이 문서가 존재하고, 지원/미지원 목록이 명확히 구분됨. ✅
