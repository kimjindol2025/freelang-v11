// FreeLang v9: Phase 61 — Trampoline 기반 TCO 검증
// 100만 재귀를 스택 오버플로 없이 실행

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { callUserFunctionTCO } from "./eval-call-function";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL ${name}: ${String(e.message ?? e).slice(0, 200)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runInterp(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

console.log("[Phase 61] Trampoline TCO 검증\n");

// ── TC-1: 100만 재귀 카운트다운 — 스택 오버플로 없음 ────────────────
console.log("[TC-1] 100만 재귀 카운트다운 (callUserFunctionTCO)");

test("callUserFunctionTCO로 100만 카운트다운 — 스택 오버플로 없음", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    [FUNC count-down :params [$n]
      :body (if (= $n 0) "done"
                (count-down (- $n 1)))]
  `)));

  const result = callUserFunctionTCO(interp as any, "count-down", [1_000_000]);
  if (result !== "done") throw new Error(`Expected "done", got ${result}`);
});

// ── TC-2: 꼬리 재귀 피보나치 (50번째) ──────────────────────────────
console.log("[TC-2] 꼬리 재귀 피보나치 fib-tail(50)");

test("fib-tail TCO — 50번째 피보나치 수", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    [FUNC fib-tail :params [$n $a $b]
      :body (if (= $n 0) $a
                (fib-tail (- $n 1) $b (+ $a $b)))]
  `)));

  const result = callUserFunctionTCO(interp as any, "fib-tail", [50, 0, 1]);
  // 50번째 피보나치: 12586269025
  if (result !== 12586269025) throw new Error(`Expected 12586269025, got ${result}`);
});

// ── TC-3: callUserFunction (기존 방식)으로 작은 재귀 동작 확인 ───────
console.log("[TC-3] 기존 callUserFunction — 작은 재귀 정상 동작");

test("기존 callUserFunction — 100번 카운트다운 정상", () => {
  const result = run(`
    [FUNC countdown :params [$n]
      :body (if (= $n 0) "done"
                (countdown (- $n 1)))]
    (countdown 100)
  `);
  if (result !== "done") throw new Error(`Expected "done", got ${result}`);
});

// ── TC-4: loop/recur 여전히 동작 ────────────────────────────────────
console.log("[TC-4] loop/recur 여전히 동작");

test("loop/recur 기본 — 0부터 100까지", () => {
  const result = run(`
    (loop [i 0]
      (if (>= $i 100) $i
          (recur (+ $i 1))))
  `);
  if (result !== 100) throw new Error(`Expected 100, got ${result}`);
});

test("loop/recur 합산 — 1+2+...+100 = 5050", () => {
  const result = run(`
    (loop [i 1 acc 0]
      (if (> $i 100) $acc
          (recur (+ $i 1) (+ $acc $i))))
  `);
  if (result !== 5050) throw new Error(`Expected 5050, got ${result}`);
});

// ── TC-5: 상호 재귀 — my-even?/my-odd? (작은 수로 검증) ─────────────
console.log("[TC-5] 상호 재귀 (my-even?/my-odd?) 작은 수");

test("my-even?(10) → true", () => {
  const result = run(`
    [FUNC my-even? :params [$n]
      :body (if (= $n 0) true (my-odd? (- $n 1)))]
    [FUNC my-odd? :params [$n]
      :body (if (= $n 0) false (my-even? (- $n 1)))]
    (my-even? 10)
  `);
  if (result !== true) throw new Error(`Expected true, got ${result}`);
});

test("my-odd?(7) → true", () => {
  const result = run(`
    [FUNC my-even? :params [$n]
      :body (if (= $n 0) true (my-odd? (- $n 1)))]
    [FUNC my-odd? :params [$n]
      :body (if (= $n 0) false (my-even? (- $n 1)))]
    (my-odd? 7)
  `);
  if (result !== true) throw new Error(`Expected true, got ${result}`);
});

// ── TC-6: callUserFunctionTCO로 상호 재귀 큰 수 ─────────────────────
console.log("[TC-6] callUserFunctionTCO 상호 재귀 큰 수 (10000)");

test("callUserFunctionTCO my-even?(10000) → true", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    [FUNC my-even? :params [$n]
      :body (if (= $n 0) true (my-odd? (- $n 1)))]
    [FUNC my-odd? :params [$n]
      :body (if (= $n 0) false (my-even? (- $n 1)))]
  `)));
  const result = callUserFunctionTCO(interp as any, "my-even?", [10_000]);
  if (result !== true) throw new Error(`Expected true, got ${result}`);
});

// ── TC-7: TCO 기본 산술 함수 검증 ────────────────────────────────────
console.log("[TC-7] TCO sum 1~1000");

test("callUserFunctionTCO sum(1000, 0) → 500500", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    [FUNC sum-tail :params [$n $acc]
      :body (if (= $n 0) $acc
                (sum-tail (- $n 1) (+ $acc $n)))]
  `)));
  const result = callUserFunctionTCO(interp as any, "sum-tail", [1000, 0]);
  if (result !== 500500) throw new Error(`Expected 500500, got ${result}`);
});

// ── TC-8: Phase 56 regression — 렉시컬 스코프 ────────────────────────
console.log("[TC-8] Phase 56 regression — 렉시컬 스코프 기본");

test("함수 내 define이 전역 오염 안 함", () => {
  const interp = runInterp(`(define x 10)`);
  interp.interpret(parse(lex(`
    [FUNC isolate :params [] :body (define y 99)]
    (isolate)
  `)));
  const globalX = (interp as any).context.variables.get("$x");
  if (globalX !== 10) throw new Error(`Expected $x=10, got ${globalX}`);
});

test("클로저 캡처 정상", () => {
  const result = run(`
    [FUNC make-adder :params [$n]
      :body (fn [$x] (+ $x $n))]
    (define add5 (make-adder 5))
    (add5 3)
  `);
  if (result !== 8) throw new Error(`Expected 8, got ${result}`);
});

test("재귀 함수 — 팩토리얼(10) = 3628800", () => {
  const result = run(`
    [FUNC fact :params [$n]
      :body (if (<= $n 1) 1 (* $n (fact (- $n 1))))]
    (fact 10)
  `);
  if (result !== 3628800) throw new Error(`Expected 3628800, got ${result}`);
});

// ── TC-9: 대용량 TCO — 50만 반복 ────────────────────────────────────
console.log("[TC-9] callUserFunctionTCO 50만 반복");

test("callUserFunctionTCO count-down(500000) → 0", () => {
  const interp = new Interpreter();
  interp.interpret(parse(lex(`
    [FUNC count-to-zero :params [$n]
      :body (if (= $n 0) 0
                (count-to-zero (- $n 1)))]
  `)));
  const result = callUserFunctionTCO(interp as any, "count-to-zero", [500_000]);
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

// ─────────────────────────────────────────────────────────────────────
console.log(`\n[Phase 61] 결과: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
  console.log("FAILED");
  process.exit(1);
} else {
  console.log("ALL PASS");
}
