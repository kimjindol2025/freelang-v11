"use strict";
// FreeLang v9: Phase 68 — 파이프라인 연산자 검증
// ->, ->>, |> 연산자 추가
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function eq(a, b) {
    const as = JSON.stringify(a);
    const bs = JSON.stringify(b);
    if (as !== bs)
        throw new Error(`Expected ${bs}, got ${as}`);
}
// ─────────────────────────────────────────────────────────────────
console.log("\n=== Phase 68: 파이프라인 연산자 ===\n");
// TC-1: -> 기본 (단순 심볼 체인)
test("TC-1: -> 단순 함수 체인", () => {
    const result = run(`
    (define double (fn [$x] (* $x 2)))
    (define inc (fn [$x] (+ $x 1)))
    (-> 5 double inc)
  `);
    // double(5) = 10, inc(10) = 11
    eq(result, 11);
});
// TC-2: -> sexpr 형태 (추가 인자 포함)
test("TC-2: -> sexpr step (첫 번째 인자 삽입)", () => {
    const result = run(`
    (define add (fn [$x $y] (+ $x $y)))
    (define mul (fn [$x $y] (* $x $y)))
    (-> 3
      (add 10)
      (mul 2))
  `);
    // add(3, 10) = 13, mul(13, 2) = 26
    eq(result, 26);
});
// TC-3: -> 혼합 (sexpr + 심볼)
test("TC-3: -> sexpr + symbol 혼합", () => {
    const result = run(`
    (define double (fn [$x] (* $x 2)))
    (define add (fn [$x $y] (+ $x $y)))
    (-> 4
      (add 6)
      double)
  `);
    // add(4, 6) = 10, double(10) = 20
    eq(result, 20);
});
// TC-4: ->> 기본 (마지막 인자 삽입)
test("TC-4: ->> 마지막 인자 삽입", () => {
    const result = run(`
    (define sub (fn [$x $y] (- $x $y)))
    (->> 3
      (sub 10))
  `);
    // sub(10, 3) = 7
    eq(result, 7);
});
// TC-5: ->> 다단계
test("TC-5: ->> 다단계 파이프", () => {
    const result = run(`
    (define double (fn [$x] (* $x 2)))
    (define add (fn [$x $y] (+ $x $y)))
    (->> 5
      double
      (add 1))
  `);
    // double(5) = 10, add(1, 10) = 11
    eq(result, 11);
});
// TC-6: ->> 수치 파이프라인 (arithmetic pipeline)
test("TC-6: ->> 수치 파이프라인", () => {
    const result = run(`
    (->> 5
      (+ 3)
      (* 2)
      (- 1))
  `);
    // +3 → 8, *2 → 16, -1 → last arg: (- 1 16) = -15
    // ->> 는 val을 마지막 인자에 삽입:
    // 5 → (+ 3 5)=8 → (* 2 8)=16 → (- 1 16)=-15
    eq(result, -15);
});
// TC-7: pipe 기존 동작 유지 (regression)
test("TC-7: pipe 기존 동작 유지", () => {
    const result = run(`
    (define inc (fn [$x] (+ $x 1)))
    (define double (fn [$x] (* $x 2)))
    (pipe 3 inc double)
  `);
    // inc(3) = 4, double(4) = 8
    eq(result, 8);
});
// TC-8: |> 단순 파이프 (pipe 별칭)
test("TC-8: |> 단순 파이프", () => {
    const result = run(`
    (define inc (fn [$x] (+ $x 1)))
    (define double (fn [$x] (* $x 2)))
    (|> 5 double inc)
  `);
    // double(5) = 10, inc(10) = 11
    eq(result, 11);
});
// TC-9: -> 단일 step
test("TC-9: -> 단일 step", () => {
    const result = run(`
    (define square (fn [$x] (* $x $x)))
    (-> 7 square)
  `);
    eq(result, 49);
});
// TC-10: ->> 단일 step
test("TC-10: ->> 단일 step", () => {
    const result = run(`
    (define negate (fn [$x] (- 0 $x)))
    (->> 9 negate)
  `);
    eq(result, -9);
});
// TC-11: -> 긴 체인 (5단계)
test("TC-11: -> 긴 체인 (5단계)", () => {
    const result = run(`
    (define inc (fn [$x] (+ $x 1)))
    (define double (fn [$x] (* $x 2)))
    (-> 1
      inc
      double
      inc
      double
      inc)
  `);
    // 1 → inc=2 → double=4 → inc=5 → double=10 → inc=11
    eq(result, 11);
});
// TC-12: -> 에서 sexpr step에 여러 추가 인자
test("TC-12: -> sexpr step 여러 추가 인자", () => {
    const result = run(`
    (define clamp (fn [$x $lo $hi]
      (if (< $x $lo) $lo
        (if (> $x $hi) $hi $x))))
    (-> 15
      (clamp 0 10))
  `);
    // clamp(15, 0, 10) = 10
    eq(result, 10);
});
// TC-13: ->> + -> 혼합 사용
test("TC-13: ->> 다단계 + 추가 인자 혼합", () => {
    const result = run(`
    (define add (fn [$x $y] (+ $x $y)))
    (define mul (fn [$x $y] (* $x $y)))
    (->> 2
      (add 3)
      (mul 4))
  `);
    // add(3, 2) = 5, mul(4, 5) = 20
    eq(result, 20);
});
// TC-14: Phase 56 regression — 렉시컬 스코프
test("TC-14: Phase 56 regression — 클로저 스코프", () => {
    const result = run(`
    (define make-adder (fn [$n]
      (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 10)
  `);
    eq(result, 15);
});
// ─────────────────────────────────────────────────────────────────
console.log(`\n결과: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase68-pipeline.js.map