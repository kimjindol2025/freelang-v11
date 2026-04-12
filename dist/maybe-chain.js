"use strict";
// FreeLang v9 Phase 112: Maybe Chain — 확률 자동 전파
// (maybe-chain $a $b (fn [x y] (+ x y))) → maybe(0.8*0.9, x+y)
// (maybe-map $m fn) → maybe(same-confidence, fn(value))
// (maybe-bind $m fn) → fn(value) 가 maybe를 반환하면 확률 곱
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeMap = maybeMap;
exports.maybeBind = maybeBind;
exports.maybeChain = maybeChain;
exports.maybeFilter = maybeFilter;
exports.maybeCombine = maybeCombine;
exports.maybeSelect = maybeSelect;
exports.createMaybeChainModule = createMaybeChainModule;
const maybe_type_1 = require("./maybe-type");
// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────
function clamp(v) {
    return Math.max(0, Math.min(1, v));
}
function makeMaybe(confidence, value) {
    return (0, maybe_type_1.maybe)(clamp(confidence), value);
}
function makeNone(reason) {
    return (0, maybe_type_1.none)(reason);
}
// ── map: 값 변환, 확률 유지 ───────────────────────────────────────────────
function maybeMap(m, fn) {
    if ((0, maybe_type_1.isNone)(m))
        return makeNone('none 입력');
    return makeMaybe(m.confidence, fn(m.value));
}
// ── bind (flatMap): fn이 maybe를 반환 → 확률 곱 ──────────────────────────
function maybeBind(m, fn) {
    if ((0, maybe_type_1.isNone)(m))
        return makeNone('none 입력');
    const result = fn(m.value);
    if ((0, maybe_type_1.isNone)(result))
        return makeNone('fn이 none 반환');
    return makeMaybe(m.confidence * result.confidence, result.value);
}
// ── chain: 여러 maybe 값을 결합 (확률은 곱, 값은 fn으로 합성) ─────────────
function maybeChain(maybes, fn) {
    if (maybes.some(m => (0, maybe_type_1.isNone)(m)))
        return makeNone('하나 이상이 none');
    const somes = maybes;
    const confidence = somes.reduce((acc, m) => acc * m.confidence, 1);
    const values = somes.map(m => m.value);
    return makeMaybe(confidence, fn(...values));
}
// ── filter: 조건 불만족 시 none ───────────────────────────────────────────
function maybeFilter(m, pred) {
    if ((0, maybe_type_1.isNone)(m))
        return makeNone('none 입력');
    if (!pred(m.value))
        return makeNone('조건 불만족');
    return m;
}
// ── combine: 두 maybe 값 합성 — 확률 곱, 값 합성 ────────────────────────
function maybeCombine(a, b, fn) {
    if ((0, maybe_type_1.isNone)(a) || (0, maybe_type_1.isNone)(b))
        return makeNone('하나 이상이 none');
    return makeMaybe(a.confidence * b.confidence, fn(a.value, b.value));
}
// ── select: 가장 신뢰도 높은 maybe 선택 ──────────────────────────────────
function maybeSelect(maybes) {
    const valid = maybes.filter(m => (0, maybe_type_1.isMaybe)(m));
    if (valid.length === 0)
        return makeNone('후보 없음');
    return valid.reduce((best, curr) => curr.confidence > best.confidence ? curr : best);
}
function createMaybeChainModule(callFunctionValue) {
    function callFn(fn, args) {
        if (typeof fn === 'function')
            return fn(...args);
        if (fn && fn.kind === 'function-value' && callFunctionValue) {
            return callFunctionValue(fn, args);
        }
        throw new Error('fn은 함수가 아닙니다');
    }
    return {
        'maybe-map': (m, fn) => maybeMap(m, (v) => callFn(fn, [v])),
        'maybe-bind': (m, fn) => maybeBind(m, (v) => callFn(fn, [v])),
        'maybe-chain': (maybes, fn) => maybeChain(maybes, (...vals) => callFn(fn, vals)),
        'maybe-filter': (m, pred) => maybeFilter(m, (v) => callFn(pred, [v])),
        'maybe-combine': (a, b, fn) => maybeCombine(a, b, (x, y) => callFn(fn, [x, y])),
        'maybe-select': (maybes) => maybeSelect(maybes),
    };
}
//# sourceMappingURL=maybe-chain.js.map