// FreeLang v9: Phase 56 — 렉시컬 스코프 검증
// ScopeStack 도입 후 스코프 격리, 클로저, set! 동작 검증

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runMulti(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

function evalIn(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function getVar(interp: Interpreter, name: string): any {
  return (interp as any).context.variables.get("$" + name);
}

console.log("[Phase 56] 렉시컬 스코프 검증\n");

// ── TC-1: 함수 내 define이 전역 오염 안 함 ───────────────────────────
console.log("[TC-1] 함수 내 define 격리]");

test("함수 내 define이 전역 $x를 오염 안 함", () => {
  const interp = runMulti(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
  const x = getVar(interp, "x");
  if (x !== 10) throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});

test("함수 내 define 변수는 함수 실행 후 사라짐", () => {
  const interp = runMulti(`
    [FUNC make-local :params [] :body (define inner 42)]
    (make-local)
  `);
  const inner = getVar(interp, "inner");
  if (inner !== undefined && inner !== null) throw new Error(`$inner가 외부에 보임: ${inner}`);
});

// ── TC-2: 재귀 함수 스코프 격리 ────────────────────────────────────
console.log("\n[TC-2] 재귀 함수]");

test("재귀 팩토리얼 — 스코프 간섭 없음", () => {
  const res = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
  if (res !== 720) throw new Error(`got ${res}`);
});

test("재귀 피보나치 — 중첩 호출 격리", () => {
  const res = run(`
    [FUNC fib :params [$n]
      :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
    (fib 10)
  `);
  if (res !== 55) throw new Error(`got ${res}`);
});

// ── TC-3: 클로저 캡처 ────────────────────────────────────────────────
console.log("\n[TC-3] 클로저]");

test("fn 클로저가 정의 시점 환경을 캡처", () => {
  const res = run(`
    (define base 100)
    (define add-base (fn [$x] (+ $x $base)))
    (add-base 5)
  `);
  if (res !== 105) throw new Error(`got ${res}`);
});

test("고차 함수 — 클로저 반환", () => {
  const res = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
  if (res !== 17) throw new Error(`got ${res}`);
});

// ── TC-4: set! 상위 스코프 수정 ──────────────────────────────────────
console.log("\n[TC-4] set! 동작]");

test("set!이 전역 $counter를 누적 수정", () => {
  const interp = runMulti(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `);
  const counter = getVar(interp, "counter");
  if (counter !== 3) throw new Error(`got ${counter}`);
});

// ── TC-5: loop/recur 스코프 격리 ────────────────────────────────────
console.log("\n[TC-5] loop/recur 격리]");

test("loop 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runMulti(`
    (define i 999)
    (loop [i 0]
      (if (>= $i 3) $i (recur (+ $i 1))))
  `);
  const i = getVar(interp, "i");
  if (i !== 999) throw new Error(`전역 $i가 ${i}로 변경됨 (999여야 함)`);
});

test("loop/recur 결과값 정상", () => {
  const res = run(`
    (loop [acc 0 n 5]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  if (res !== 15) throw new Error(`got ${res}`);
});

// ── TC-6: let 스코프 격리 ────────────────────────────────────────────
console.log("\n[TC-6] let 격리]");

test("let 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runMulti(`
    (define y 77)
    (let [[$y 42]] $y)
  `);
  const y = getVar(interp, "y");
  if (y !== 77) throw new Error(`전역 $y가 ${y}로 변경됨 (77이어야 함)`);
});

// ── TC-7: import 함수 내부 스코프 격리 ───────────────────────────────
console.log("\n[TC-7] import 함수 스코프]");

test("fl-list-utils.fl: sum 내부 $acc가 전역 오염 안 함", () => {
  const path = require("path");
  const fs = require("fs");
  const srcDir = __dirname;
  const src = fs.readFileSync(path.join(srcDir, "fl-list-utils.fl"), "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = path.join(srcDir, "fl-list-utils.fl");
  interp.interpret(parse(lex(src)));

  // sum 호출 전에 acc 정의
  evalIn(interp, "(define acc 777)");
  evalIn(interp, "(sum [1.0 2.0 3.0])");
  const acc = evalIn(interp, "$acc");
  if (acc !== 777) throw new Error(`$acc가 ${acc}로 변경됨 (777이어야 함)`);
});

// ── TC-8: 중첩 함수 define 격리 ──────────────────────────────────────
console.log("\n[TC-8] 중첩 함수 define]");

test("중첩 호출 각 스코프의 define이 격리됨", () => {
  const interp = runMulti(`
    (define result 0)
    [FUNC inner :params [$v] :body (define result (* $v 2))]
    [FUNC outer :params [$v] :body (do (inner $v) (define result (* $v 3)))]
    (outer 5)
  `);
  const result = evalIn(interp, "$result");
  if (result !== 0) throw new Error(`전역 $result가 ${result}로 변경됨 (0이어야 함)`);
});

// ── TC-9: 기존 fl-app-demo.fl regression ────────────────────────────
console.log("\n[TC-9] fl-app-demo.fl regression]");

test("fl-app-demo.fl 정상 실행", () => {
  const path = require("path");
  const fs = require("fs");
  const srcDir = __dirname;
  const src = fs.readFileSync(path.join(srcDir, "fl-app-demo.fl"), "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = path.join(srcDir, "fl-app-demo.fl");
  interp.interpret(parse(lex(src)));
  const fns = (interp as any).context.functions as Map<string, any>;
  if (!fns.has("list:sum")) throw new Error("list:sum 없음");
  if (!fns.has("stru:repeat-str")) throw new Error("stru:repeat-str 없음");
});

// ── TC-10: gpt-mini 학습 루프 regression ────────────────────────────
console.log("\n[TC-10] gpt-mini 학습 루프 regression]");

test("mini neural net 학습 10step — 결과 수렴", () => {
  const res = run(`
    (define W 0.5)
    (define lr 0.01)
    (loop [step 0 loss 999.0]
      (if (>= $step 10)
        $loss
        (do
          (define pred (* $W 2.0))
          (define err (- $pred 1.0))
          (define new-loss (* $err $err))
          (set! W (- $W (* $lr (* 2.0 (* $err 2.0)))))
          (recur (+ $step 1) $new-loss))))
  `);
  if (typeof res !== "number" || isNaN(res) || res < 0) throw new Error(`got ${res}`);
});

// ── 결과 ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 56 렉시컬 스코프: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
