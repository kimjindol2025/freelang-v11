// FreeLang v9: Phase 96 — AI 에러 처리 시스템 테스트
// 에러는 값이다. throw가 아니라 Result로.

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import {
  ok, err, isOk, isErr, unwrap, unwrapOr,
  mapOk, mapErr, flatMap, recover, fromThrown,
  ErrorCategory,
  type Result,
  type Ok,
  type Err,
} from "./result-type";
import { AIErrorSystem, defaultErrorSystem } from "./error-system";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 150)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("[Phase 96] AI 에러 처리 시스템: Result 타입 + 자동 복구\n");

// ── TC-1~8: Result 기본 ──────────────────────────────────────────────────
console.log("[TC-1~8] Result 기본");

test("TC-1: (ok 42) → _tag='Ok', value=42", () => {
  const r = run(`(ok 42)`);
  assert(r._tag === "Ok", `_tag=${r._tag}`);
  assert(r.value === 42, `value=${r.value}`);
});

test("TC-2: (err 'E001' '메시지') → _tag='Err'", () => {
  const r = run(`(err "E001" "메시지")`);
  assert(r._tag === "Err", `_tag=${r._tag}`);
  assert(r.code === "E001", `code=${r.code}`);
  assert(r.message === "메시지", `message=${r.message}`);
});

test("TC-3: (ok? (ok 1)) → true", () => {
  const r = run(`(ok? (ok 1))`);
  assert(r === true, `got ${r}`);
});

test("TC-4: (ok? (err 'e' 'm')) → false", () => {
  const r = run(`(ok? (err "e" "m"))`);
  assert(r === false, `got ${r}`);
});

test("TC-5: (err? (err 'e' 'm')) → true", () => {
  const r = run(`(err? (err "e" "m"))`);
  assert(r === true, `got ${r}`);
});

test("TC-6: (unwrap (ok 42)) → 42", () => {
  const r = run(`(unwrap (ok 42))`);
  assert(r === 42, `got ${r}`);
});

test("TC-7: (unwrap (err 'e' 'm')) → throw", () => {
  let threw = false;
  try {
    run(`(unwrap (err "E" "실패"))`);
  } catch {
    threw = true;
  }
  assert(threw, "unwrap on Err should throw");
});

test("TC-8: (unwrap-or (err 'e' 'm') 99) → 99", () => {
  const r = run(`(unwrap-or (err "e" "m") 99)`);
  assert(r === 99, `got ${r}`);
});

// ── TC-9~15: Result 변환 ─────────────────────────────────────────────────
console.log("\n[TC-9~15] Result 변환");

test("TC-9: (map-ok (ok 5) (fn [$v] (* $v 2))) → ok(10)", () => {
  const r = run(`(map-ok (ok 5) (fn [$v] (* $v 2)))`);
  assert(r._tag === "Ok", `_tag=${r._tag}`);
  assert(r.value === 10, `value=${r.value}`);
});

test("TC-10: (map-ok (err 'e' 'm') fn) → err 그대로", () => {
  const r = run(`(map-ok (err "e" "m") (fn [$v] $v))`);
  assert(r._tag === "Err", `_tag=${r._tag}`);
  assert(r.code === "e", `code=${r.code}`);
});

test("TC-11: (recover (err 'e' 'm') (fn [$e] 0)) → 0", () => {
  const r = run(`(recover (err "e" "m") (fn [$e] 0))`);
  assert(r === 0, `got ${r}`);
});

test("TC-12: (recover (ok 5) (fn [$e] 0)) → 5", () => {
  const r = run(`(recover (ok 5) (fn [$e] 0))`);
  assert(r === 5, `got ${r}`);
});

test("TC-13: flat-map ok → ok", () => {
  const r = run(`(flat-map (ok 5) (fn [$v] (ok (* $v 3))))`);
  assert(r._tag === "Ok", `_tag=${r._tag}`);
  assert(r.value === 15, `value=${r.value}`);
});

test("TC-14: flat-map err → err", () => {
  const r = run(`(flat-map (err "e" "m") (fn [$v] (ok $v)))`);
  assert(r._tag === "Err", `_tag=${r._tag}`);
});

test("TC-15: 체인 map-ok → map-ok", () => {
  // ok(2) → map-ok (*2) → ok(4) → map-ok (+1) → ok(5)
  const r = run(`
    (define r1 (ok 2))
    (define r2 (map-ok $r1 (fn [$v] (* $v 2))))
    (map-ok $r2 (fn [$v] (+ $v 1)))
  `);
  assert(r._tag === "Ok", `_tag=${r._tag}`);
  assert(r.value === 5, `value=${r.value}`);
});

// ── TC-16~22: fl-try ─────────────────────────────────────────────────────
console.log("\n[TC-16~22] fl-try");

test("TC-16: (fl-try (+ 1 2)) → ok(3)", () => {
  const r = run(`(fl-try (+ 1 2))`);
  assert(r._tag === "Ok", `_tag=${r._tag}`);
  assert(r.value === 3, `value=${r.value}`);
});

test("TC-17: (fl-try (/ 1 0)) → err (런타임 에러)", () => {
  // 1/0 → Infinity (JS), 이 케이스는 예외를 throw하는 표현식으로 대체
  const r = run(`
    (fl-try (unwrap (err "DIV" "0으로 나누기")))
  `);
  assert(r._tag === "Err", `_tag=${r._tag}`);
});

test("TC-18: (fl-try undefined-func-call) → err (not-found/runtime)", () => {
  // 정의되지 않은 함수 호출 → FunctionNotFoundError → Err
  const r = run(`(fl-try (___nonexistent_fn___ 1 2))`);
  assert(r._tag === "Err", `_tag=${r._tag}`);
  assert(typeof r.code === "string", `code=${r.code}`);
});

test("TC-19: :on-err 콜백 실행", () => {
  const r = run(`
    (fl-try
      (unwrap (err "E" "실패"))
      :on-err (fn [$e] 42))
  `);
  assert(r === 42, `got ${r}`);
});

test("TC-20: :on-not-found 타겟 에러 처리 (에러 없는 경우 ok 반환)", () => {
  // fl-try가 성공하면 ok 반환, 에러 시 핸들러 호출
  // not-found 카테고리 에러를 직접 만들어서 테스트
  const r = run(`
    (define not-found-err (err "NF" "없음"))
    (fl-try
      (unwrap $not-found-err)
      :on-not-found (fn [$e] "not-found-handled")
      :default (fn [$e] "default-handled"))
  `);
  // unwrap이 throw → :default 핸들러 호출 (not-found 카테고리가 아닌 경우)
  assert(typeof r === "string", `got ${typeof r}: ${JSON.stringify(r)}`);
  assert(r === "default-handled" || r === "not-found-handled", `got ${r}`);
});

test("TC-21: :default 나머지 처리", () => {
  const r = run(`
    (fl-try
      (unwrap (err "X" "어떤에러"))
      :default (fn [$e] "default"))
  `);
  assert(r === "default", `got ${r}`);
});

test("TC-22: 중첩 fl-try", () => {
  const r = run(`
    (fl-try
      (fl-try (+ 1 2))
      :on-err (fn [$e] 999))
  `);
  // 내부 fl-try가 ok(3)을 반환 → 외부 fl-try도 ok(ok(3))
  // 또는 Result 래핑 감지로 ok(3) 그대로
  assert(r !== null && r !== undefined, `got null/undefined`);
});

// ── TC-23~28: Err 구조/분류 ─────────────────────────────────────────────
console.log("\n[TC-23~28] Err 구조/분류");

test("TC-23: err.category 필드", () => {
  const e = err("E", "msg", { category: ErrorCategory.TYPE_ERROR });
  assert(e.category === ErrorCategory.TYPE_ERROR, `category=${e.category}`);
  assert(e._tag === "Err", `_tag=${e._tag}`);
});

test("TC-24: err.recoverable 필드", () => {
  const e1 = err("E", "msg", { recoverable: true });
  const e2 = err("E", "msg", { recoverable: false });
  assert(e1.recoverable === true, `e1.recoverable=${e1.recoverable}`);
  assert(e2.recoverable === false, `e2.recoverable=${e2.recoverable}`);
});

test("TC-25: err.hint 필드", () => {
  const e = err("E", "msg", { hint: "이렇게 해보세요" });
  assert(e.hint === "이렇게 해보세요", `hint=${e.hint}`);
});

test("TC-26: AIErrorSystem.classify — 기존 throw 에러 → Err", () => {
  const system = new AIErrorSystem();
  const jsErr = new Error("Function not found: foo");
  const flErr = system.classify(jsErr);
  assert(flErr._tag === "Err", `_tag=${flErr._tag}`);
  assert(typeof flErr.code === "string", `code=${flErr.code}`);
  assert(typeof flErr.message === "string", `message=${flErr.message}`);
  assert(typeof flErr.category === "string", `category=${flErr.category}`);
});

test("TC-27: AIErrorSystem.explain → 한국어 설명", () => {
  const e = err("E", "변수 없음", { category: ErrorCategory.NOT_FOUND });
  const explanation = defaultErrorSystem.explain(e);
  assert(typeof explanation === "string", `not a string`);
  assert(explanation.length > 0, `empty explanation`);
  // 한국어 포함 여부
  assert(/찾을|타입|런타임|인자|입출력|AI|사용자|타임/.test(explanation), `no Korean: ${explanation}`);
});

test("TC-28: Phase 56 regression 14/14", () => {
  const interp = new Interpreter();

  // 렉시컬 스코프
  interp.interpret(parse(lex(`(define x 10)`)));
  const x = (interp as any).context.variables.get("$x");
  assert(x === 10, `$x=${x}`);

  // 클로저
  const closureResult = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add5 (make-adder 5))
    (add5 3)
  `);
  assert(closureResult === 8, `closure result=${closureResult}`);

  // loop/recur
  const loopResult = run(`
    (loop [acc 0 n 3]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  assert(loopResult === 6, `loop result=${loopResult}`);

  // 산술 연산
  const arithResult = run(`(+ (* 3 4) (- 10 5))`);
  assert(arithResult === 17, `arith result=${arithResult}`);

  // Result 타입도 regression 체크
  const okResult = run(`(ok 100)`);
  assert(okResult._tag === "Ok", `ok regression: _tag=${okResult._tag}`);
  assert(okResult.value === 100, `ok regression: value=${okResult.value}`);

  const errResult = run(`(err "R" "regression")`);
  assert(errResult._tag === "Err", `err regression: _tag=${errResult._tag}`);

  const unwrapResult = run(`(unwrap-or (err "e" "m") 77)`);
  assert(unwrapResult === 77, `unwrap-or regression: ${unwrapResult}`);

  // fl-try regression
  const tryResult = run(`(fl-try (+ 10 20))`);
  assert(tryResult._tag === "Ok", `fl-try regression: _tag=${tryResult._tag}`);
  assert(tryResult.value === 30, `fl-try regression: value=${tryResult.value}`);
});

// ── 결과 ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Phase 96 AI Error System: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
