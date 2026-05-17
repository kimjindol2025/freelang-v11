# S9 제어 흐름 특수 형식 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** C 시드 컴파일러(`freelang.c`)에 `when`, `when-not`, `case`, `doseq`, `try/catch` 특수 형식을 추가한다.

**Architecture:** 모두 `emit_node()` 내 특수 분기 추가. `try/catch`는 `runtime.c`에 setjmp/longjmp 인프라 추가 필요.

**Tech Stack:** C (freelang.c, runtime/runtime.c, runtime/runtime.h), gcc

---

## 현황 분석

| 특수 형식 | 상태 | 비고 |
|-----------|------|------|
| `when` / `when-not` | ❌ | `if` 확장으로 구현 가능 |
| `case` | ❌ | if-else 체인 + `fl_eq` 비교 |
| `doseq` | ❌ | 벡터 순회 for 루프 |
| `try/catch` | ❌ | setjmp/longjmp 런타임 인프라 필요 |

**기존 패턴 참고:**
- `if` → ternary 표현식
- `do` → `__extension__({ ... })` GNU 블록
- `loop` → `__extension__` + goto 라벨

---

## 파일 변경 목록

| 파일 | Task |
|------|------|
| `freelang.c` | Task 1, 2, 3, 4 |
| `runtime/runtime.c` | Task 3 (try 인프라) |
| `runtime/runtime.h` | Task 3 (try 선언) |

---

## Task 1: `when` / `when-not` 구현

**Files:** `freelang.c` — `emit_node()` 내 `if` 분기 바로 뒤 추가

### 삽입 위치

`freelang.c` 의 `if (sym(op,"if"))` 블록 끝 (line ~357) 바로 뒤:

```c
    if (sym(op,"when")) {
        E("(fl_truthy("); emit_node(a[0]); E(") ? ((__extension__({\n");
        for (int i = 1; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 1) { E("        "); emit_node(a[na-1]); E(";\n    }))) : fl_nil())"); }
        else        { E("    fl_nil();\n    }))) : fl_nil())"); }
        return;
    }
    if (sym(op,"when-not")) {
        E("(!fl_truthy("); emit_node(a[0]); E(") ? ((__extension__({\n");
        for (int i = 1; i < na-1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (na > 1) { E("        "); emit_node(a[na-1]); E(";\n    }))) : fl_nil())"); }
        else        { E("    fl_nil();\n    }))) : fl_nil())"); }
        return;
    }
```

### 검증

```lisp
(define x 5)
(when (> x 3) (println "big"))          ;; → big
(when-not (> x 10) (println "small"))   ;; → small
(when false (println "nope"))            ;; → (출력 없음)
```

---

## Task 2: `case` 구현

**Files:** `freelang.c` — `if (sym(op,"cond"))` 바로 뒤

### FL 문법

```lisp
(case val
  v1 result1
  v2 result2
  default-result)    ;; 마지막 홀수 항목 = 기본값
```

### 삽입 코드

```c
    if (sym(op,"case")) {
        /* (case val v1 r1 v2 r2 ... [default])
         * a[0]=val, a[1]=k1, a[2]=r1, ..., a[na-1]=default(홀수 개면) */
        E("((__extension__({\n");
        E("    FLValue _cv = "); emit_node(a[0]); E(";\n");
        E("    FLValue _cr = fl_nil();\n");
        int has_default = (na % 2 == 0);  /* 짝수=기본값 있음 (val+pairs+default) */
        int pairs_end = has_default ? na - 1 : na;
        for (int i = 1; i+1 < pairs_end; i += 2) {
            if (i == 1) E("    if");
            else        E("    } else if");
            E(" (fl_truthy(fl_eq(_cv, "); emit_node(a[i]); E("))) { _cr = ");
            emit_node(a[i+1]); E(";\n");
        }
        if (pairs_end > 1) E("    } else { _cr = ");
        else               E("    _cr = ");
        if (has_default) emit_node(a[na-1]);
        else             E("fl_nil()");
        E(";\n");
        if (pairs_end > 1) E("    }\n");
        E("    _cr;\n})))");
        return;
    }
```

### 검증

```lisp
(println (case 2  1 "one"  2 "two"  "other"))   ;; → two
(println (case 5  1 "one"  2 "two"  "other"))   ;; → other
(println (case "a"  "a" 1  "b" 2))              ;; → 1
```

---

## Task 3: `try/catch` 런타임 인프라 추가

**Files:** `runtime/runtime.h`, `runtime/runtime.c`

### runtime.h 추가 (맨 위 include 영역 뒤)

```c
/* ── try/catch 인프라 ── */
#include <setjmp.h>
#define FL_TRY_MAX 64
typedef struct { jmp_buf buf; FLValue err; int active; } FLTryFrame;
extern FLTryFrame fl_try_stack[FL_TRY_MAX];
extern int fl_try_top;
void fl_throw(FLValue err);
FLValue fl_make_error(const char* type, const char* msg);
```

### runtime.c 추가 (파일 끝)

```c
/* ── try/catch 런타임 ── */
FLTryFrame fl_try_stack[FL_TRY_MAX];
int fl_try_top = 0;

void fl_throw(FLValue err) {
    if (fl_try_top <= 0) {
        /* 잡히지 않은 예외 — stderr 출력 후 종료 */
        if (err.tag == FL_STRING)
            fprintf(stderr, "Uncaught error: %s\n", err.str->data);
        else
            fprintf(stderr, "Uncaught error\n");
        exit(1);
    }
    fl_try_stack[fl_try_top - 1].err = err;
    longjmp(fl_try_stack[fl_try_top - 1].buf, 1);
}

FLValue fl_make_error(const char* type, const char* msg) {
    FLValue m = fl_map_new();
    m = fl_map_set(m, fl_str_val("type"),    fl_str_val(type));
    m = fl_map_set(m, fl_str_val("message"), fl_str_val(msg));
    return m;
}
```

### 검증

```bash
gcc -O2 -o a.out freelang.c runtime/runtime.c -lm
echo '(println "ok")' | ./a.out /dev/stdin
# → ok (빌드만 검증)
```

---

## Task 4: `try/catch` codegen 구현

**Files:** `freelang.c` — `emit_node()` 내 `do` 분기 뒤

### FL 문법

```lisp
(try
  body-expr...
  (catch e
    handler-expr...))
```

### AST 구조

```
NL[try,
  body1, body2, ...,
  NL[catch, e, handler...]]
```

### 삽입 코드

```c
    if (sym(op,"try")) {
        /* catch 절 위치 탐색 */
        int ci = -1;
        for (int i = 0; i < na; i++)
            if (a[i]->k == NL && a[i]->nc >= 1 && sym(a[i]->c[0], "catch"))
                { ci = i; break; }
        int body_end = (ci >= 0) ? ci : na;

        E("((__extension__({\n");
        E("    FLValue _tr = fl_nil();\n");
        E("    fl_try_top++;\n");
        E("    if (setjmp(fl_try_stack[fl_try_top-1].buf) == 0) {\n");
        for (int i = 0; i < body_end - 1; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        if (body_end > 0) { E("        _tr = "); emit_node(a[body_end-1]); E(";\n"); }
        E("        fl_try_top--;\n");
        E("    } else {\n");
        E("        FLValue _te = fl_try_stack[fl_try_top-1].err; fl_try_top--;\n");
        if (ci >= 0 && a[ci]->nc >= 2) {
            char eb[512]; cname(a[ci]->c[1]->v, eb, sizeof(eb));
            E("        FLValue %s = _te;\n", eb);
            int hn = a[ci]->nc;
            for (int i = 2; i < hn - 1; i++) { E("        "); emit_node(a[ci]->c[i]); E(";\n"); }
            if (hn > 2) { E("        _tr = "); emit_node(a[ci]->c[hn-1]); E(";\n"); }
        }
        E("    }\n    _tr;\n})))");
        return;
    }
```

### 검증

```lisp
;; 에러 잡기
(try
  (/ 1 0)
  (catch e (println (get e "message"))))   ;; → Division by zero

;; 정상 실행
(try
  (+ 1 2)
  (catch e (println "error")))             ;; → (catch 실행 안 됨, 값은 3)

;; 중첩 try
(try
  (try
    (/ 10 0)
    (catch e "inner-caught"))
  (catch e "outer-caught"))                ;; → inner-caught
```

---

## Task 5: `doseq` 구현

**Files:** `freelang.c` — `loop` 분기 바로 앞

### FL 문법

```lisp
(doseq [x coll] body...)
```

### AST 구조

```
NL[doseq, NV[x, coll], body1, body2, ...]
```

### 삽입 코드

```c
    if (sym(op,"doseq")) {
        /* a[0] = binding vector [varname coll], a[1..] = body */
        N* bv = a[0];
        /* bv->c[0] = 변수명, bv->c[1] = 컬렉션 */
        char bname[512]; cname(bv->c[0]->v, bname, sizeof(bname));
        int lid = loop_counter++;
        E("((__extension__({\n");
        E("    FLValue _dsv%d = ", lid); emit_node(bv->c[1]); E(";\n");
        E("    int64_t _dsn%d = fl_vec_len(_dsv%d).i;\n", lid, lid);
        E("    for (int64_t _dsi%d = 0; _dsi%d < _dsn%d; _dsi%d++) {\n", lid,lid,lid,lid);
        E("        FLValue %s = fl_vec_get(_dsv%d, fl_int(_dsi%d));\n", bname, lid, lid);
        for (int i = 1; i < na; i++) { E("        "); emit_node(a[i]); E(";\n"); }
        E("    }\n    fl_nil();\n})))");
        return;
    }
```

### 검증

```lisp
(doseq [x [1 2 3 4 5]] (println (* x x)))
;; → 1\n4\n9\n16\n25

(doseq [name ["Alice" "Bob"]] (println (str "Hello " name)))
;; → Hello Alice\nHello Bob
```

---

## 통합 검증 (전 Task 완료 후)

```lisp
;; 전체 기능 통합 테스트
(when true (println "when OK"))
(when-not false (println "when-not OK"))
(println (case 3  1 "one"  2 "two"  3 "three"  "other"))
(doseq [x [10 20 30]] (println x))
(try
  (/ 5 0)
  (catch e (println (str "caught: " (get e "message")))))
```

기대 출력:
```
when OK
when-not OK
three
10
20
30
caught: Division by zero
```

---

## 구현 순서 & 예상 시간

| Task | 작업 | 예상 |
|------|------|------|
| T1 | when/when-not | 20분 |
| T2 | case | 30분 |
| T3 | try/catch 런타임 | 30분 |
| T4 | try/catch codegen | 40분 |
| T5 | doseq | 20분 |
| | **합계** | **~2.5시간** |
