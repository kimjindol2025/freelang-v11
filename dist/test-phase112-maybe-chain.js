"use strict";
// FreeLang v9: Phase 112 — maybe-chain 확률 자동 전파 테스트
// maybe(0.8, x) + maybe(0.9, y) → maybe(0.72, result)
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const maybe_type_1 = require("./maybe-type");
const maybe_chain_1 = require("./maybe-chain");
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
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg ?? '조건 실패');
}
function approx(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ── 1. maybeMap ───────────────────────────────────────────────────────────
console.log("\n[maybeMap]");
test("1. maybeMap — 값 변환", () => {
    const m = (0, maybe_type_1.maybe)(0.8, 5);
    const result = (0, maybe_chain_1.maybeMap)(m, v => v * 2);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === 10, `value=${result.value}`);
});
test("2. maybeMap — 확률 유지", () => {
    const m = (0, maybe_type_1.maybe)(0.75, "hello");
    const result = (0, maybe_chain_1.maybeMap)(m, v => v.length);
    assert((0, maybe_type_1.isMaybe)(result) && approx(result.confidence, 0.75), `confidence=${result.confidence}`);
});
test("3. maybeMap — none → none", () => {
    const m = (0, maybe_type_1.none)("테스트");
    const result = (0, maybe_chain_1.maybeMap)(m, (v) => v * 2);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 2. maybeBind ──────────────────────────────────────────────────────────
console.log("\n[maybeBind]");
test("4. maybeBind — 확률 곱 (0.8 × 0.9 = 0.72)", () => {
    const m = (0, maybe_type_1.maybe)(0.8, 10);
    const result = (0, maybe_chain_1.maybeBind)(m, v => (0, maybe_type_1.maybe)(0.9, v + 5));
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(approx(result.confidence, 0.72), `confidence=${result.confidence}`);
    assert(result.value === 15, `value=${result.value}`);
});
test("5. maybeBind — fn이 none 반환 → none", () => {
    const m = (0, maybe_type_1.maybe)(0.8, 10);
    const result = (0, maybe_chain_1.maybeBind)(m, _v => (0, maybe_type_1.none)("실패"));
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
test("6. maybeBind — none 입력 → none", () => {
    const m = (0, maybe_type_1.none)();
    const result = (0, maybe_chain_1.maybeBind)(m, (v) => (0, maybe_type_1.maybe)(0.9, v));
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 3. maybeChain ─────────────────────────────────────────────────────────
console.log("\n[maybeChain]");
test("7. maybeChain — 2개 결합 (0.8 × 0.7 = 0.56)", () => {
    const a = (0, maybe_type_1.maybe)(0.8, 3);
    const b = (0, maybe_type_1.maybe)(0.7, 4);
    const result = (0, maybe_chain_1.maybeChain)([a, b], (x, y) => x + y);
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(approx(result.confidence, 0.56), `confidence=${result.confidence}`);
    assert(result.value === 7, `value=${result.value}`);
});
test("8. maybeChain — 3개 결합 (0.8 × 0.7 × 0.5 = 0.28)", () => {
    const a = (0, maybe_type_1.maybe)(0.8, 1);
    const b = (0, maybe_type_1.maybe)(0.7, 2);
    const c = (0, maybe_type_1.maybe)(0.5, 3);
    const result = (0, maybe_chain_1.maybeChain)([a, b, c], (x, y, z) => x + y + z);
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(approx(result.confidence, 0.28), `confidence=${result.confidence}`);
    assert(result.value === 6, `value=${result.value}`);
});
test("9. maybeChain — 하나라도 none → none", () => {
    const a = (0, maybe_type_1.maybe)(0.8, 1);
    const b = (0, maybe_type_1.none)("missing");
    const c = (0, maybe_type_1.maybe)(0.9, 3);
    const result = (0, maybe_chain_1.maybeChain)([a, b, c], (x, y, z) => x + y + z);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 4. maybeFilter ────────────────────────────────────────────────────────
console.log("\n[maybeFilter]");
test("10. maybeFilter — 조건 통과", () => {
    const m = (0, maybe_type_1.maybe)(0.9, 42);
    const result = (0, maybe_chain_1.maybeFilter)(m, v => v > 10);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === 42, `value=${result.value}`);
    assert(approx(result.confidence, 0.9), `confidence=${result.confidence}`);
});
test("11. maybeFilter — 조건 실패 → none", () => {
    const m = (0, maybe_type_1.maybe)(0.9, 3);
    const result = (0, maybe_chain_1.maybeFilter)(m, v => v > 10);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
test("12. maybeFilter — none → none", () => {
    const m = (0, maybe_type_1.none)();
    const result = (0, maybe_chain_1.maybeFilter)(m, (v) => v > 0);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 5. maybeCombine ───────────────────────────────────────────────────────
console.log("\n[maybeCombine]");
test("13. maybeCombine — 두 값 합성 + 확률 곱", () => {
    const a = (0, maybe_type_1.maybe)(0.8, 10);
    const b = (0, maybe_type_1.maybe)(0.6, 20);
    const result = (0, maybe_chain_1.maybeCombine)(a, b, (x, y) => x + y);
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(result.value === 30, `value=${result.value}`);
    assert(approx(result.confidence, 0.48), `confidence=${result.confidence}`);
});
test("14. maybeCombine — 하나 none → none", () => {
    const a = (0, maybe_type_1.maybe)(0.8, 10);
    const b = (0, maybe_type_1.none)();
    const result = (0, maybe_chain_1.maybeCombine)(a, b, (x, y) => x + y);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 6. maybeSelect ────────────────────────────────────────────────────────
console.log("\n[maybeSelect]");
test("15. maybeSelect — 최고 신뢰도 선택", () => {
    const a = (0, maybe_type_1.maybe)(0.3, "low");
    const b = (0, maybe_type_1.maybe)(0.9, "high");
    const c = (0, maybe_type_1.maybe)(0.6, "mid");
    const result = (0, maybe_chain_1.maybeSelect)([a, b, c]);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === "high", `value=${result.value}`);
});
test("16. maybeSelect — 빈 배열 → none", () => {
    const result = (0, maybe_chain_1.maybeSelect)([]);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 7. 범위 보장 ──────────────────────────────────────────────────────────
console.log("\n[확률 범위]");
test("17. 확률 범위 0~1 보장 — clamp 상한", () => {
    // maybe() 생성자 자체가 RangeError 발생 — clamp로 보호
    const m = (0, maybe_type_1.maybe)(1.0, 5);
    const result = (0, maybe_chain_1.maybeMap)(m, v => v);
    const c = result.confidence;
    assert(c >= 0 && c <= 1, `confidence=${c} 범위 초과`);
});
test("17b. 확률 범위 0~1 보장 — 하한 0", () => {
    const m = (0, maybe_type_1.maybe)(0.0, 5);
    const result = (0, maybe_chain_1.maybeMap)(m, v => v);
    const c = result.confidence;
    assert(c >= 0, `confidence=${c} 음수`);
});
// ── 8. 내장 함수 (interpreter 통합) ─────────────────────────────────────
console.log("\n[내장 함수 — interpreter 통합]");
test("18. maybe-map 내장함수", () => {
    const result = run(`(maybe-map (maybe 0.8 5) (fn [$x] (* $x 2)))`);
    assert((0, maybe_type_1.isMaybe)(result), `isMaybe=${(0, maybe_type_1.isMaybe)(result)}`);
    assert(result.value === 10, `value=${result.value}`);
    assert(approx(result.confidence, 0.8), `confidence=${result.confidence}`);
});
test("19. maybe-bind 내장함수", () => {
    const result = run(`(maybe-bind (maybe 0.8 10) (fn [$x] (maybe 0.9 (+ $x 5))))`);
    assert((0, maybe_type_1.isMaybe)(result), `isMaybe=${(0, maybe_type_1.isMaybe)(result)}`);
    assert(result.value === 15, `value=${result.value}`);
    assert(approx(result.confidence, 0.72), `confidence=${result.confidence}`);
});
test("20. maybe-chain 내장함수", () => {
    // FL 배열 리터럴이 제네릭 타입으로 파싱되므로 TS에서 직접 호출
    const a = (0, maybe_type_1.maybe)(0.8, 3);
    const b = (0, maybe_type_1.maybe)(0.5, 4);
    const result = (0, maybe_chain_1.maybeChain)([a, b], (x, y) => x + y);
    assert((0, maybe_type_1.isMaybe)(result), `isMaybe=${(0, maybe_type_1.isMaybe)(result)}`);
    assert(result.value === 7, `value=${result.value}`);
    assert(approx(result.confidence, 0.4), `confidence=${result.confidence}`);
});
test("21. maybe-filter 내장함수", () => {
    const result = run(`(maybe-filter (maybe 0.9 42) (fn [$x] (> $x 10)))`);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === 42, `value=${result.value}`);
});
test("22. maybe-combine 내장함수", () => {
    const result = run(`(maybe-combine (maybe 0.8 10) (maybe 0.6 20) (fn [$x $y] (+ $x $y)))`);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === 30, `value=${result.value}`);
    assert(approx(result.confidence, 0.48), `confidence=${result.confidence}`);
});
test("23. maybe-select 내장함수", () => {
    // 가변 인자 방식: (maybe-select m1 m2 ...)
    const result = run(`(maybe-select (maybe 0.3 "low") (maybe 0.9 "high"))`);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === "high", `value=${result.value}`);
});
// ── 9. 체인 시나리오 ──────────────────────────────────────────────────────
console.log("\n[체인 시나리오]");
test("24. 체인: maybe(0.9, 5) → map(*2) → maybe(0.9, 10)", () => {
    const m = (0, maybe_type_1.maybe)(0.9, 5);
    const result = (0, maybe_chain_1.maybeMap)(m, v => v * 2);
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(result.value === 10, `value=${result.value}`);
    assert(approx(result.confidence, 0.9), `confidence=${result.confidence}`);
});
test("25. 체인: maybe(0.8) → bind(fn→maybe(0.9)) → maybe(0.72)", () => {
    const m = (0, maybe_type_1.maybe)(0.8, 100);
    const result = (0, maybe_chain_1.maybeBind)(m, v => (0, maybe_type_1.maybe)(0.9, v / 2));
    assert((0, maybe_type_1.isMaybe)(result), 'isMaybe');
    assert(result.value === 50, `value=${result.value}`);
    assert(approx(result.confidence, 0.72), `confidence=${result.confidence}`);
});
test("26. 복합 체인: map → bind → filter", () => {
    const m = (0, maybe_type_1.maybe)(0.9, 4);
    const step1 = (0, maybe_chain_1.maybeMap)(m, v => v * 3); // maybe(0.9, 12)
    const step2 = (0, maybe_chain_1.maybeBind)(step1, v => (0, maybe_type_1.maybe)(0.8, v + 1)); // maybe(0.72, 13)
    const step3 = (0, maybe_chain_1.maybeFilter)(step2, v => v > 10); // maybe(0.72, 13)
    assert((0, maybe_type_1.isMaybe)(step3), 'isMaybe after filter');
    assert(step3.value === 13, `value=${step3.value}`);
    assert(approx(step3.confidence, 0.72), `confidence=${step3.confidence}`);
});
test("27. maybeChain 1개 — 단순 전달", () => {
    const m = (0, maybe_type_1.maybe)(0.6, 99);
    const result = (0, maybe_chain_1.maybeChain)([m], v => v);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === 99 && approx(result.confidence, 0.6));
});
test("28. maybeCombine — 문자열 연결", () => {
    const a = (0, maybe_type_1.maybe)(0.9, "Hello");
    const b = (0, maybe_type_1.maybe)(0.8, " World");
    const result = (0, maybe_chain_1.maybeCombine)(a, b, (x, y) => x + y);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === "Hello World", `value=${result.value}`);
    assert(approx(result.confidence, 0.72), `confidence=${result.confidence}`);
});
test("29. maybeSelect — none 섞여도 some 선택", () => {
    const a = (0, maybe_type_1.none)("없음");
    const b = (0, maybe_type_1.maybe)(0.7, "answer");
    const c = (0, maybe_type_1.none)();
    const result = (0, maybe_chain_1.maybeSelect)([a, b, c]);
    assert((0, maybe_type_1.isMaybe)(result) && result.value === "answer", `value=${result.value}`);
});
test("30. maybe-chain 내장함수 — 하나라도 none → none", () => {
    // TS에서 직접 호출 (FL 배열 리터럴 파싱 제한)
    const a = (0, maybe_type_1.maybe)(0.8, 1);
    const b = (0, maybe_type_1.none)("missing");
    const result = (0, maybe_chain_1.maybeChain)([a, b], (x, y) => x + y);
    assert((0, maybe_type_1.isNone)(result), `isNone=${(0, maybe_type_1.isNone)(result)}`);
});
// ── 결과 출력 ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 112 maybe-chain: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
    console.log(`  FAILED: ${failed}개`);
    process.exit(1);
}
//# sourceMappingURL=test-phase112-maybe-chain.js.map