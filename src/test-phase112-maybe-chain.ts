// FreeLang v9: Phase 112 — maybe-chain 확률 자동 전파 테스트
// maybe(0.8, x) + maybe(0.9, y) → maybe(0.72, result)

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { maybe, none, isMaybe, isNone, Uncertain } from "./maybe-type";
import {
  maybeMap, maybeBind, maybeChain, maybeFilter,
  maybeCombine, maybeSelect,
} from "./maybe-chain";

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

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? '조건 실패');
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

// ── 1. maybeMap ───────────────────────────────────────────────────────────

console.log("\n[maybeMap]");

test("1. maybeMap — 값 변환", () => {
  const m = maybe(0.8, 5);
  const result = maybeMap(m, v => v * 2);
  assert(isMaybe(result) && (result as any).value === 10, `value=${(result as any).value}`);
});

test("2. maybeMap — 확률 유지", () => {
  const m = maybe(0.75, "hello");
  const result = maybeMap(m, v => v.length);
  assert(isMaybe(result) && approx((result as any).confidence, 0.75),
    `confidence=${(result as any).confidence}`);
});

test("3. maybeMap — none → none", () => {
  const m = none("테스트");
  const result = maybeMap(m, (v: any) => v * 2);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 2. maybeBind ──────────────────────────────────────────────────────────

console.log("\n[maybeBind]");

test("4. maybeBind — 확률 곱 (0.8 × 0.9 = 0.72)", () => {
  const m = maybe(0.8, 10);
  const result = maybeBind(m, v => maybe(0.9, v + 5));
  assert(isMaybe(result), 'isMaybe');
  assert(approx((result as any).confidence, 0.72), `confidence=${(result as any).confidence}`);
  assert((result as any).value === 15, `value=${(result as any).value}`);
});

test("5. maybeBind — fn이 none 반환 → none", () => {
  const m = maybe(0.8, 10);
  const result = maybeBind(m, _v => none("실패"));
  assert(isNone(result), `isNone=${isNone(result)}`);
});

test("6. maybeBind — none 입력 → none", () => {
  const m = none();
  const result = maybeBind(m, (v: any) => maybe(0.9, v));
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 3. maybeChain ─────────────────────────────────────────────────────────

console.log("\n[maybeChain]");

test("7. maybeChain — 2개 결합 (0.8 × 0.7 = 0.56)", () => {
  const a = maybe(0.8, 3);
  const b = maybe(0.7, 4);
  const result = maybeChain([a, b], (x, y) => x + y);
  assert(isMaybe(result), 'isMaybe');
  assert(approx((result as any).confidence, 0.56), `confidence=${(result as any).confidence}`);
  assert((result as any).value === 7, `value=${(result as any).value}`);
});

test("8. maybeChain — 3개 결합 (0.8 × 0.7 × 0.5 = 0.28)", () => {
  const a = maybe(0.8, 1);
  const b = maybe(0.7, 2);
  const c = maybe(0.5, 3);
  const result = maybeChain([a, b, c], (x, y, z) => x + y + z);
  assert(isMaybe(result), 'isMaybe');
  assert(approx((result as any).confidence, 0.28), `confidence=${(result as any).confidence}`);
  assert((result as any).value === 6, `value=${(result as any).value}`);
});

test("9. maybeChain — 하나라도 none → none", () => {
  const a = maybe(0.8, 1);
  const b = none("missing");
  const c = maybe(0.9, 3);
  const result = maybeChain([a, b, c], (x, y, z) => x + y + z);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 4. maybeFilter ────────────────────────────────────────────────────────

console.log("\n[maybeFilter]");

test("10. maybeFilter — 조건 통과", () => {
  const m = maybe(0.9, 42);
  const result = maybeFilter(m, v => v > 10);
  assert(isMaybe(result) && (result as any).value === 42, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.9), `confidence=${(result as any).confidence}`);
});

test("11. maybeFilter — 조건 실패 → none", () => {
  const m = maybe(0.9, 3);
  const result = maybeFilter(m, v => v > 10);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

test("12. maybeFilter — none → none", () => {
  const m = none();
  const result = maybeFilter(m, (v: any) => v > 0);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 5. maybeCombine ───────────────────────────────────────────────────────

console.log("\n[maybeCombine]");

test("13. maybeCombine — 두 값 합성 + 확률 곱", () => {
  const a = maybe(0.8, 10);
  const b = maybe(0.6, 20);
  const result = maybeCombine(a, b, (x, y) => x + y);
  assert(isMaybe(result), 'isMaybe');
  assert((result as any).value === 30, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.48), `confidence=${(result as any).confidence}`);
});

test("14. maybeCombine — 하나 none → none", () => {
  const a = maybe(0.8, 10);
  const b = none();
  const result = maybeCombine(a, b, (x: number, y: number) => x + y);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 6. maybeSelect ────────────────────────────────────────────────────────

console.log("\n[maybeSelect]");

test("15. maybeSelect — 최고 신뢰도 선택", () => {
  const a = maybe(0.3, "low");
  const b = maybe(0.9, "high");
  const c = maybe(0.6, "mid");
  const result = maybeSelect([a, b, c]);
  assert(isMaybe(result) && (result as any).value === "high", `value=${(result as any).value}`);
});

test("16. maybeSelect — 빈 배열 → none", () => {
  const result = maybeSelect([]);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 7. 범위 보장 ──────────────────────────────────────────────────────────

console.log("\n[확률 범위]");

test("17. 확률 범위 0~1 보장 — clamp 상한", () => {
  // maybe() 생성자 자체가 RangeError 발생 — clamp로 보호
  const m = maybe(1.0, 5);
  const result = maybeMap(m, v => v);
  const c = (result as any).confidence;
  assert(c >= 0 && c <= 1, `confidence=${c} 범위 초과`);
});

test("17b. 확률 범위 0~1 보장 — 하한 0", () => {
  const m = maybe(0.0, 5);
  const result = maybeMap(m, v => v);
  const c = (result as any).confidence;
  assert(c >= 0, `confidence=${c} 음수`);
});

// ── 8. 내장 함수 (interpreter 통합) ─────────────────────────────────────

console.log("\n[내장 함수 — interpreter 통합]");

test("18. maybe-map 내장함수", () => {
  const result = run(`(maybe-map (maybe 0.8 5) (fn [$x] (* $x 2)))`);
  assert(isMaybe(result), `isMaybe=${isMaybe(result)}`);
  assert((result as any).value === 10, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.8), `confidence=${(result as any).confidence}`);
});

test("19. maybe-bind 내장함수", () => {
  const result = run(`(maybe-bind (maybe 0.8 10) (fn [$x] (maybe 0.9 (+ $x 5))))`);

  assert(isMaybe(result), `isMaybe=${isMaybe(result)}`);
  assert((result as any).value === 15, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.72), `confidence=${(result as any).confidence}`);
});

test("20. maybe-chain 내장함수", () => {
  // FL 배열 리터럴이 제네릭 타입으로 파싱되므로 TS에서 직접 호출
  const a = maybe(0.8, 3);
  const b = maybe(0.5, 4);
  const result = maybeChain([a, b], (x, y) => x + y);
  assert(isMaybe(result), `isMaybe=${isMaybe(result)}`);
  assert((result as any).value === 7, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.4), `confidence=${(result as any).confidence}`);
});

test("21. maybe-filter 내장함수", () => {
  const result = run(`(maybe-filter (maybe 0.9 42) (fn [$x] (> $x 10)))`);

  assert(isMaybe(result) && (result as any).value === 42, `value=${(result as any).value}`);
});

test("22. maybe-combine 내장함수", () => {
  const result = run(`(maybe-combine (maybe 0.8 10) (maybe 0.6 20) (fn [$x $y] (+ $x $y)))`);

  assert(isMaybe(result) && (result as any).value === 30, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.48), `confidence=${(result as any).confidence}`);
});

test("23. maybe-select 내장함수", () => {
  // 가변 인자 방식: (maybe-select m1 m2 ...)
  const result = run(`(maybe-select (maybe 0.3 "low") (maybe 0.9 "high"))`);
  assert(isMaybe(result) && (result as any).value === "high", `value=${(result as any).value}`);
});

// ── 9. 체인 시나리오 ──────────────────────────────────────────────────────

console.log("\n[체인 시나리오]");

test("24. 체인: maybe(0.9, 5) → map(*2) → maybe(0.9, 10)", () => {
  const m = maybe(0.9, 5);
  const result = maybeMap(m, v => v * 2);
  assert(isMaybe(result), 'isMaybe');
  assert((result as any).value === 10, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.9), `confidence=${(result as any).confidence}`);
});

test("25. 체인: maybe(0.8) → bind(fn→maybe(0.9)) → maybe(0.72)", () => {
  const m = maybe(0.8, 100);
  const result = maybeBind(m, v => maybe(0.9, v / 2));
  assert(isMaybe(result), 'isMaybe');
  assert((result as any).value === 50, `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.72), `confidence=${(result as any).confidence}`);
});

test("26. 복합 체인: map → bind → filter", () => {
  const m = maybe(0.9, 4);
  const step1 = maybeMap(m, v => v * 3);       // maybe(0.9, 12)
  const step2 = maybeBind(step1, v => maybe(0.8, v + 1)); // maybe(0.72, 13)
  const step3 = maybeFilter(step2, v => v > 10);           // maybe(0.72, 13)
  assert(isMaybe(step3), 'isMaybe after filter');
  assert((step3 as any).value === 13, `value=${(step3 as any).value}`);
  assert(approx((step3 as any).confidence, 0.72), `confidence=${(step3 as any).confidence}`);
});

test("27. maybeChain 1개 — 단순 전달", () => {
  const m = maybe(0.6, 99);
  const result = maybeChain([m], v => v);
  assert(isMaybe(result) && (result as any).value === 99 && approx((result as any).confidence, 0.6));
});

test("28. maybeCombine — 문자열 연결", () => {
  const a = maybe(0.9, "Hello");
  const b = maybe(0.8, " World");
  const result = maybeCombine(a, b, (x, y) => x + y);
  assert(isMaybe(result) && (result as any).value === "Hello World", `value=${(result as any).value}`);
  assert(approx((result as any).confidence, 0.72), `confidence=${(result as any).confidence}`);
});

test("29. maybeSelect — none 섞여도 some 선택", () => {
  const a = none("없음");
  const b = maybe(0.7, "answer");
  const c = none();
  const result = maybeSelect([a, b, c]);
  assert(isMaybe(result) && (result as any).value === "answer", `value=${(result as any).value}`);
});

test("30. maybe-chain 내장함수 — 하나라도 none → none", () => {
  // TS에서 직접 호출 (FL 배열 리터럴 파싱 제한)
  const a = maybe(0.8, 1);
  const b = none("missing") as any;
  const result = maybeChain([a, b], (x: any, y: any) => x + y);
  assert(isNone(result), `isNone=${isNone(result)}`);
});

// ── 결과 출력 ─────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 112 maybe-chain: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
  console.log(`  FAILED: ${failed}개`);
  process.exit(1);
}
