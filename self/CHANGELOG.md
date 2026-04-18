# `self/` 셀프호스팅 CHANGELOG

100 단계 기획: `.claude/plans/steady-stirring-zephyr.md` 참고.

## 규약

매 단계 종료 시 한 줄 기록:
```
phase=NN stage=MM status=done diff=ok bench_hello_ms=X bench_fib30_ms=Y bench_json1mb_ms=Z note=<brief>
```

주장 금지. 수치만. 실측 불가능하면 `status=wip`.

---

## Baseline (TS v11.11, 2026-04-18)

```
phase=00 stage=baseline
  bootstrap_sha256=9eff8d3bd9a38585bd81d6cb19365201f316a5fa1873345ce62d9ccee9fa2cc1
  bootstrap_bytes=1123091
  build_ms=82
  test_total=583 test_pass=583
  bench_hello_ms=184 bench_fib30_ms=185 bench_json1mb_ms=201
  coverage_lines=24
  stdlib_modules=41 stdlib_functions=265
```

---

## Phase 00 — 인프라 복구

```
phase=00 stage=01 status=done target=src_stdlib_scripts_restore git_ls_restored=405
phase=00 stage=02 status=done target=npm_install packages=206
phase=00 stage=03 status=done target=build bootstrap_bytes=1123091 build_ms=82
phase=00 stage=04 status=done target=tests pass=583 fail=0 suites=17
phase=00 stage=05 status=done target=self_skeleton dirs=5
phase=00 stage=06 status=done target=snapshot_v0 sha256=9eff8d3b... bytes=1123091
phase=00 stage=07 status=done target=self_diff_sh mode=dry_run total=0
phase=00 stage=08 status=done target=bench_sh mode=ts hello=184 fib30=185 json1mb=201
phase=00 stage=09 status=done target=changelog format=key_value
phase=00 stage=10 status=done target=fixtures lex=40 parse=40 eval=40 total=120
```

---

## Phase 01 — Self Lexer

```
phase=01 stage=11 status=done target=token.fl exports=6 test=make-token_verified
phase=01 stage=12 status=done target=char-class.fl predicates=7 test=10/10_pass
phase=01 stage=13 status=done target=lexer.fl_core partial=true reason=defn_forward_ref
phase=01 stage=14..19 status=wip reason=defn_forward_ref_blocker
phase=01 stage=20 status=blocked reason=defn_forward_ref_blocker
```

### 🔴 발견된 블로커 (2026-04-18): `defn` 상호재귀 미지원

실측:
```lisp
(defn foo [n] (if (= n 0) "done" (bar n)))
(defn bar [n] (str "bar-" n))
(foo 5)
; → Function not found: bar
```

`[FUNC]` 블록은 정상 동작:
```lisp
[FUNC foo :params [$n] :body (if (= $n 0) "done" (bar $n))]
[FUNC bar :params [$n] :body (str "bar-" $n)]
(foo 5)  ; → "bar-5" ✓
```

**결론**: `defn` 은 1-pass (순차 등록), `[FUNC]` 블록은 2-pass (전체 스캔 후 등록).

### 📋 선결 과제 (백엔드 AI 인계)

v11 `defn` 을 forward-ref 지원하도록 고쳐야 Phase 01~10 진행 가능:

**옵션 A (권장)**: `defn` 의 등록 시점을 "파일 파싱 완료 후" 로 이동 (hoisting).  
**옵션 B**: Phase 01~10 을 전부 `[FUNC]` 블록 문법으로 작성 (분량 30% 증가).

현재 Phase 01 은 **1/10 stage 완료 + 2/10 부분 완료** 로 정체.
선결 과제 해결 전 Phase 02+ 진행 무의미.

## Phase 02 — AST 타입

(미진행)

## Phase 03 — Self Parser

(미진행)

## Phase 04 — Scope

(미진행)

## Phase 05 — Interpreter Core

(미진행)

## Phase 06 — 특수폼 31

(미진행)

## Phase 07 — Builtins 342

(미진행)

## Phase 08 — Stdlib 47

(미진행)

## Phase 09 — Self Bootstrap

(미진행)

## Phase 10 — bootstrap.js 대체

(미진행)
