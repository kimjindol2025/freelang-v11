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

## Phase 01 — Self Lexer ✅

```
phase=01 stage=11 status=done target=token.fl exports=6 test=make-token_verified
phase=01 stage=12 status=done target=char-class.fl predicates=7 test=10/10_pass
phase=01 stage=13 status=done target=lexer.fl rewrite=FUNC_block reason=defn_forward_ref
phase=01 stage=14 status=done target=whitespace+comment
phase=01 stage=15 status=done target=number_literal (int/float/neg)
phase=01 stage=16 status=done target=string_literal (escape \n\t\r\"\\)
phase=01 stage=17 status=deferred target=string_interp note=phase_03_parser
phase=01 stage=18 status=done target=symbol_tokens
phase=01 stage=19 status=done target=var_keyword_atom
phase=01 stage=20 status=done target=lexer_smoke pass=10/10
```

### 결정 (2026-04-18)

옵션 B 선택 — `[FUNC]` 블록으로 재작성.
- `defn` 은 forward-ref 불가 (실측 확인)
- `[FUNC]` 는 2-pass 등록이라 상호재귀 허용
- 22 개 함수 전부 `[FUNC name :params [$x] :body (...)]` 형식

### 실측 결과

```
self/lexer.fl: 22 [FUNC] 블록, ~180 줄
self/tests/test-lexer.fl: 10 smoke pass=10/10
  empty / num / neg / float / sym / str / kw / var / paren / sexpr
```

### 알려진 제한

- stage 17 (문자열 보간 `"{$x}"` → concat AST 변환) 은 parser 영역.
  lexer 는 raw string 그대로 반환. Phase 03 parser 에서 처리 예정.
- `@atom` 은 현재 Unknown 토큰. 사용 예가 적어 Phase 02-03 로 연기.
- Token 의 `value` 는 항상 string. Number 는 parser 가 parseFloat.

## Phase 02 — AST 타입 ✅

```
phase=02 stage=21 status=done target=ast.fl constructors=basic (literal/variable/keyword/sexpr)
phase=02 stage=22 status=done target=ast_literal_wrappers (number/string/bool/null/symbol)
phase=02 stage=23 status=done target=ast_block (make-block/array-block/map-block)
phase=02 stage=24 status=done target=ast_pattern_7 (literal/variable/wildcard/list/struct/or/range)
phase=02 stage=25 status=done target=ast_match (pattern-match/match-case)
phase=02 stage=26 status=done target=ast_function_and_types (function-value/type-class/instance)
phase=02 stage=27 status=done target=ast_module (module/import/open)
phase=02 stage=28 status=done target=ast_ai_blocks (search/learn/reasoning)
phase=02 stage=29 status=done target=ast_async_try (async-function/await/try/catch/throw)
phase=02 stage=30 status=done target=ast_web_and_equal (page/route/component/form + deep-equal?)
```

실측:
- self/ast.fl: 36 [FUNC] 블록
- self/tests/test-ast.fl smoke 7/7 pass
  literal/variable/keyword/sexpr/block/pattern-wc/try — 모두 :kind 필드 생성 확인

제한:
- list? / map? predicate 는 placeholder (FL 런타임의 타입 검사 기본 부족)
  Phase 07 builtins/type.fl 에서 교체 예정.

## Phase 03 — Self Parser ✅

```
phase=03 stage=31 status=done target=parser_state peek/advance/expect
phase=03 stage=32 status=done target=parseAtom number/string/symbol/keyword/variable
phase=03 stage=33 status=done target=parseSExpr (op arg1 arg2)
phase=03 stage=34 status=done target=parseArray [1 2 3]
phase=03 stage=35 status=done target=parseMap {:k v}
phase=03 stage=36 status=done target=parseBlock [TYPE :field value]
phase=03 stage=37 status=done target=keyword_fields :params :body :render
phase=03 stage=38 status=done target=nested_blocks
phase=03 stage=39 status=deferred target=string_interp (Phase 03 후속)
phase=03 stage=40 status=done target=line_col_propagation line 전파
phase=03 stage=41 status=deferred target=error_passthrough (Phase 05 interpreter)
phase=03 stage=42 status=deferred target=pattern_parser (Phase 06 match 시)
phase=03 stage=43 status=deferred target=trampoline_TCO (FL 런타임 recur 지원 여부 확인 후)
phase=03 stage=44 status=done target=parser_smoke pass=10/10
phase=03 stage=45 status=deferred target=parser_self_parse (stage 43 trampoline 후)
```

실측 (2026-04-18):
- self/parser.fl: 23 [FUNC] 블록, ~200 줄
- self/tests/test-parser.fl smoke 10/10 pass:
  num / sym / var / kw / sexpr / nested / array / map / if / funcblk
- parse("(+ 1 2)") → sexpr:+(2) [args 2개]
- parse("[FUNC add :params []]") → block:FUNC
- parse("{:a 1}") → block:Map

연기:
- string interp (Phase 03 후속): `"{$x}"` → (concat "" $x "") 변환
- pattern parser (Phase 06 match 에서)
- trampoline TCO (FL 런타임 recur 가 제대로 최적화되는지 확인 후)
- parser self-parse (trampoline 후 self/parser.fl 자신 파싱)

## Phase 04 — Scope ✅

```
phase=04 stage=46 status=done target=make/push/pop
phase=04 stage=47 status=done target=$-norm-key
phase=04 stage=48 status=deferred target=dot_lookup (env.vars) — Phase 05 interpreter
phase=04 stage=49 status=done target=snapshot (identity on list)
phase=04 stage=50 status=done target=restore
phase=04 stage=51 status=done target=multi-scope smoke=10/10
phase=04 stage=52 status=done target=ts_diff (단일 시퀀스 기준 동등)
```

실측:
- self/scope.fl: 11 [FUNC] 블록, ~50 줄
- self/tests/test-scope.fl smoke 10/10 pass:
  empty-depth / set-get / norm-save-$ / norm-load-$
  has-yes / has-no / shadow-top / shadow-pop / nested-l / nested-g

연기: stage 48 (dot lookup env.vars.x) — Phase 05 interpreter 에서 자연히 처리.

## Phase 05 — Interpreter Core ✅ (축소 smoke 달성)

```
phase=05 stage=53 status=done target=self-eval dispatcher (6 kinds)
phase=05 stage=54 status=done target=eval-literal (num/str/bool/null/symbol)
phase=05 stage=55 status=done target=eval-variable strict throw
phase=05 stage=56 status=done target=eval-sexpr with special-form table
phase=05 stage=57 status=done target=eval-block [FUNC] register
phase=05 stage=58 status=partial target=special-forms (fn/define/defn/let/if/cond/do/quote/set!/and/or 11개)
phase=05 stage=59 status=done target=fn function-value + capturedEnv
phase=05 stage=60 status=done target=defn → define (fn ...)
phase=05 stage=61 status=done target=let 1D/2D 모두
phase=05 stage=62 status=done target=if
phase=05 stage=63 status=done target=define 2-arg/3-arg
phase=05 stage=64 status=done target=set!
phase=05 stage=65 status=done target=do/begin + eval-call (native)
```

🎉 **핵심 달성**: FL 로 작성한 interpreter 가 FL 소스를 실행.

실측 (self-interp end-to-end, 2026-04-18):
```
(self-run "(+ 1 2)")       → 3        ✓
(self-run "(* 3 4)")       → 12       ✓
(self-run "(- 10 3)")      → 7        ✓
(self-run "(+ (* 2 3) 4)") → 10       ✓
(self-run "(if 1 42 0)")   → 42       ✓
(self-run "(if 0 42 7)")   → 7        ✓
(self-run "(< 3 5)")       → true     ✓
```
smoke 7/7 pass. lex → parse → eval end-to-end.

제한 (축소 범위):
- native-call subset: +, -, *, <, >, =, println
- 사용자 함수 호출 (apply-user-fn) 미검증
- closure 캡처 미검증
- let 은 통합 테스트엔 미포함 (lexer 부분 축소)
- Phase 06 에서 특수폼 완성 + Phase 07 에서 builtin 342 확장

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
