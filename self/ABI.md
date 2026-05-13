# FreeLang C Backend ABI 헌법

작성일: 2026-05-13  
적용 범위: Stage 2 ~ 이후 모든 C backend

이 문서는 한 번 결정되면 바꾸지 않는다.
바꾸면 optimizer/runtime/FFI 전부 재작업이다.

---

## 1. 값 표현 (Value Representation)

### 결정: Tagged Union + Heap Object 분리

```c
typedef enum {
    FL_INT,
    FL_FLOAT,
    FL_BOOL,
    FL_NIL,
    FL_STRING,
    FL_VECTOR,
    FL_MAP,
    FL_FN
} FLTag;

typedef struct FLValue FLValue;

struct FLValue {
    FLTag tag;
    union {
        int64_t  i;   /* FL_INT */
        double   f;   /* FL_FLOAT */
        bool     b;   /* FL_BOOL */
        struct FLObject* obj; /* FL_STRING, FL_VECTOR, FL_MAP, FL_FN */
    };
};
```

Heap 객체 기반:

```c
typedef struct FLObject {
    FLTag    type;
    uint32_t rc;
} FLObject;
```

문자열/벡터/맵/함수는 전부 FLObject 계열.

### 계층 구조

```
FLValue (pass-by-value, 2 words, register-friendly)
    ├── primitive: int/float/bool/nil → stack/register
    └── object*:  string/vector/map/fn → heap
```

### 금지

- **NaN boxing** — 디버깅 지옥, UB 가능성, sanitizer 비친화
- **boxed everything** — alloc 폭발, scalar 연산 치명적으로 느림

### 이유

- bootstrap 단계: 성능보다 추적 가능성이 우선
- 타입 확장 가능 (symbol/keyword/lazy/channel/future/ffi)
- FFI ABI 단순: `FLValue fl_add(FLValue a, FLValue b)`

---

## 2. 클로저 정책 (Closure Policy)

### 결정: Flat Closure (Lua 초기형), immutable capture only

```c
typedef struct {
    FLObject  base;
    FLNativeFn fn;
    int        captured_count;
    FLValue    captured[];   /* captured by value (immutable) */
} FLClosure;
```

### S2 허용

```lisp
(defn make-adder [x]
  (fn [y] (+ x y)))   ; x를 값으로 캡처 — OK
```

### S2 금지

```lisp
(set! x ...)          ; mutable capture — 금지
```

mutable capture 허용 시 box lifting / alias tracking / heap env sync 전부 필요.

### 금지

- linked-list environment (`env -> parent -> parent`)
- mutable upvalue chain
- full continuation
- nested escaping environment 최적화

### 이유

- lookup 빠름, GC 단순, escape 분석 불필요
- 나중에 closure lifting / inline / const capture 쉬움
- FreeLang 함수형 스타일과 잘 맞음

---

## 3. 메모리 전략 (Memory Strategy)

### 결정: Arena → Partial RC → (나중에) GC

#### Phase A — Arena only (S2)

```c
/* 컴파일 단위 / eval 단위로 arena 할당 후 일괄 해제 */
arena_alloc() → run → arena_free_all()
```

- 구현 단순
- leak 없음
- sanitizer 친화
- 디버깅 쉬움

#### Phase B — RC 추가 (S3)

필요한 객체만 RC:

```c
retain(obj);
release(obj);
```

대상: string / vector / closure

#### Phase C — Tracing GC (S4+, self-host 안정화 이후)

GC 도입 조건:
- self-host 안정화 완료
- optimizer 안정화 완료
- IR 고정 완료

### 금지 (지금)

- 지금 단계에서 full GC — root scanning/stack map/cycle handling 전부 backend 안정화 전에 터짐

---

## 최종 아키텍처 (S2)

```
Frontend AST
    ↓
Typed IR
    ↓
C Codegen (codegen-c.fl)
    ↓
FLValue ABI
    ↓
Runtime (runtime.c)
```

```
FLValue
  ├── primitive (int/float/bool/nil)
  └── object* → FLObject
        ├── FLString
        ├── FLVector
        ├── FLMap
        └── FLClosure
```

---

## 원칙

지금 단계에서 가장 위험한 선택: "처음부터 완벽한 VM 만들기"

우선순위:
1. 단순한 ABI
2. 추적 가능한 runtime
3. sanitizer 친화성
4. deterministic behavior
5. 성능 (나중에)
