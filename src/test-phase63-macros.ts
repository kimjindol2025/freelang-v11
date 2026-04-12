// Phase 63: 위생적 매크로 시스템 테스트
// defmacro + when/unless + macroexpand

import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || "assertEqual"}: expected ${e}, got ${a}`);
  }
}

// ─── TC-1: defmacro 기본 — (when true (+ 1 1)) → 2 ─────────────────
test("TC-1: when true → 2", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (when true (+ 1 1))
  `);
  assertEqual(ctx.lastValue, 2, "when true");
});

// ─── TC-2: when false → nil ──────────────────────────────────────────
test("TC-2: when false → null", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (when false (+ 1 1))
  `);
  assert(ctx.lastValue === null || ctx.lastValue === undefined, `expected null/nil, got ${ctx.lastValue}`);
});

// ─── TC-3: unless — (unless false "yes") → "yes" ─────────────────────
test("TC-3: unless false → 'yes'", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (unless false "yes")
  `);
  assertEqual(ctx.lastValue, "yes", "unless false");
});

// ─── TC-3b: unless true → nil ─────────────────────────────────────────
test("TC-3b: unless true → null", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (unless true "yes")
  `);
  assert(ctx.lastValue === null || ctx.lastValue === undefined, `expected null/nil, got ${ctx.lastValue}`);
});

// ─── TC-4: 사용자 정의 defmacro ─────────────────────────────────────
test("TC-4: 사용자 defmacro — (my-when)", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (defmacro my-when [$c $b] (if $c $b nil))
    (my-when true 42)
  `);
  assertEqual(ctx.lastValue, 42, "my-when true");
});

// ─── TC-4b: defmacro — 변수 조건 사용 ─────────────────────────────────
test("TC-4b: defmacro — 변수 조건", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (define x 10)
    (when (> x 5) "big")
  `);
  assertEqual(ctx.lastValue, "big", "when with variable");
});

// ─── TC-5: 중첩 매크로 확장 ──────────────────────────────────────────
test("TC-5: 중첩 매크로 — (when (unless false true) 99)", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (when (unless false true) 99)
  `);
  assertEqual(ctx.lastValue, 99, "nested macros");
});

// ─── TC-5b: and2 매크로 ──────────────────────────────────────────────
test("TC-5b: and2 true true → true", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (and2 true true)
  `);
  assertEqual(ctx.lastValue, true, "and2 true true");
});

test("TC-5c: and2 true false → false", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (and2 true false)
  `);
  assertEqual(ctx.lastValue, false, "and2 true false");
});

test("TC-5d: and2 false anything → false", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (and2 false 99)
  `);
  assertEqual(ctx.lastValue, false, "and2 false anything");
});

// ─── TC-6: macroexpand 확인 ──────────────────────────────────────────
test("TC-6: macroexpand 결과에 'if' 포함", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (macroexpand (when true 1))
  `);
  const result = String(ctx.lastValue);
  assert(result.includes("if"), `macroexpand should contain 'if', got: ${result}`);
});

// ─── TC-7: macroExpander.has() 확인 ──────────────────────────────────
test("TC-7: macroExpander.has() — 표준 매크로 등록 확인", () => {
  const interp = new Interpreter();
  assert(interp.context.macroExpander.has("when"), "when not registered");
  assert(interp.context.macroExpander.has("unless"), "unless not registered");
  assert(interp.context.macroExpander.has("and2"), "and2 not registered");
});

// ─── TC-7b: 사용자 defmacro 등록 후 has() 확인 ───────────────────────
test("TC-7b: 사용자 defmacro 등록 후 has()", () => {
  const interp = new Interpreter();
  interp.run(`(defmacro my-macro [$x] $x)`);
  assert(interp.context.macroExpander.has("my-macro"), "my-macro not registered");
});

// ─── TC-8: when + set! (부작용 포함) ────────────────────────────────
test("TC-8: when + 복합 표현식", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (when true (set! x 42))
    (+ x 0)
  `);
  // (when true ...) → x = 42, (+ x 0) → 42
  assertEqual(ctx.lastValue, 42, "when + set! sets x=42");
});

// ─── TC-9: 여러 defmacro 정의 ─────────────────────────────────────────
test("TC-9: 여러 defmacro", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (defmacro inc1 [$n] (+ $n 1))
    (defmacro dec1 [$n] (- $n 1))
    (inc1 (dec1 10))
  `);
  assertEqual(ctx.lastValue, 10, "inc1(dec1(10)) = 10");
});

// ─── TC-10 (Phase 56 regression): lexical scope 기본 ─────────────────
test("TC-10: Phase 56 regression — lexical scope", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`
    (define x 100)
    (define get-x (fn [] x))
    (let [$x 999] (get-x))
  `);
  // lexical scope: get-x는 x=100을 캡처, let의 $x=999는 영향 없음
  // 하지만 get-x가 $x가 아닌 x를 참조하므로 100
  assertEqual(ctx.lastValue, 100, "lexical closure captures outer x");
});

// ─── 결과 요약 ────────────────────────────────────────────────────────
console.log("");
console.log("==========================================");
console.log(`Phase 63 매크로 시스템: ${passed}/${passed + failed} PASS`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
