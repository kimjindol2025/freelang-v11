"use strict";
// FreeLang v9: Phase 91 — 불확실성 타입 (Uncertain<T>) 검증
// AI의 확률적 사고를 퍼스트 클래스 값으로
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const child_process_1 = require("child_process");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function runMulti(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp;
}
console.log("[Phase 91] 불확실성 타입 (Uncertain<T>) 검증\n");
// ── TC-1~8: 기본 생성/확인 ───────────────────────────────────────────────
console.log("[TC-1~8] 기본 생성/확인");
test("TC-1: (maybe 0.9 \"hello\") → confidence=0.9, value=\"hello\"", () => {
    const res = run(`(maybe 0.9 "hello")`);
    if (!res || res._tag !== 'Maybe')
        throw new Error(`_tag이 Maybe가 아님: ${JSON.stringify(res)}`);
    if (res.confidence !== 0.9)
        throw new Error(`confidence=${res.confidence}, 기대=0.9`);
    if (res.value !== 'hello')
        throw new Error(`value=${res.value}, 기대=hello`);
});
test("TC-2: (uncertain-none) → _tag=\"None\"", () => {
    const res = run(`(uncertain-none)`);
    if (!res || res._tag !== 'None')
        throw new Error(`_tag이 None이 아님: ${JSON.stringify(res)}`);
});
test("TC-3: (maybe 0.5 42 \"이유\") → reason=\"이유\"", () => {
    const res = run(`(maybe 0.5 42 "이유")`);
    if (!res || res._tag !== 'Maybe')
        throw new Error(`_tag이 Maybe가 아님`);
    if (res.value !== 42)
        throw new Error(`value=${res.value}, 기대=42`);
    if (res.reason !== '이유')
        throw new Error(`reason=${res.reason}, 기대=이유`);
});
test("TC-4: (is-maybe? (maybe 0.8 1)) → true", () => {
    const res = run(`(is-maybe? (maybe 0.8 1))`);
    if (res !== true)
        throw new Error(`got ${res}, 기대=true`);
});
test("TC-5: (is-maybe? (uncertain-none)) → false", () => {
    const res = run(`(is-maybe? (uncertain-none))`);
    if (res !== false)
        throw new Error(`got ${res}, 기대=false`);
});
test("TC-6: (is-none? (uncertain-none)) → true", () => {
    const res = run(`(is-none? (uncertain-none))`);
    if (res !== true)
        throw new Error(`got ${res}, 기대=true`);
});
test("TC-7: confidence 범위 초과 (1.5) → 에러 발생", () => {
    let threw = false;
    try {
        run(`(maybe 1.5 "over")`);
    }
    catch (e) {
        threw = true;
    }
    if (!threw)
        throw new Error("에러가 발생해야 하는데 발생하지 않음");
});
test("TC-8: (maybe 1.0 \"확실\") → confidence=1.0", () => {
    const res = run(`(maybe 1.0 "확실")`);
    if (!res || res._tag !== 'Maybe')
        throw new Error(`_tag이 Maybe가 아님`);
    if (res.confidence !== 1.0)
        throw new Error(`confidence=${res.confidence}, 기대=1.0`);
    if (res.value !== '확실')
        throw new Error(`value=${res.value}, 기대=확실`);
});
// ── TC-9~15: 값 추출 ──────────────────────────────────────────────────────
console.log("\n[TC-9~15] 값 추출");
test("TC-9: (confident (maybe 0.9 42) 0.8) → 42", () => {
    const res = run(`(confident (maybe 0.9 42) 0.8)`);
    if (res !== 42)
        throw new Error(`got ${res}, 기대=42`);
});
test("TC-10: (confident (maybe 0.5 42) 0.8) → null (threshold 미달)", () => {
    const res = run(`(confident (maybe 0.5 42) 0.8)`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
test("TC-11: (confident (uncertain-none) 0.5) → null", () => {
    const res = run(`(confident (uncertain-none) 0.5)`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
test("TC-12: (most-likely (list ...)) → 가장 높은 confidence 선택 (\"b\")", () => {
    const res = run(`(most-likely (list (maybe 0.3 "a") (maybe 0.8 "b") (maybe 0.5 "c")))`);
    if (!res || res._tag !== 'Maybe')
        throw new Error(`_tag이 Maybe가 아님: ${JSON.stringify(res)}`);
    if (res.value !== 'b')
        throw new Error(`value=${res.value}, 기대=b`);
    if (res.confidence !== 0.8)
        throw new Error(`confidence=${res.confidence}, 기대=0.8`);
});
test("TC-13: (most-likely (list)) → None (빈 배열)", () => {
    const res = run(`(most-likely (list))`);
    if (!res || res._tag !== 'None')
        throw new Error(`빈 배열에서 None이 나와야 함: ${JSON.stringify(res)}`);
});
test("TC-14: (when-confident (maybe 0.9 10) 0.7 fn) → 20", () => {
    const res = run(`(when-confident (maybe 0.9 10) 0.7 (fn [$x] (* $x 2)))`);
    if (res !== 20)
        throw new Error(`got ${res}, 기대=20`);
});
test("TC-15: (when-confident (maybe 0.3 10) 0.7 fn) → null", () => {
    const res = run(`(when-confident (maybe 0.3 10) 0.7 (fn [$x] (* $x 2)))`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
// ── TC-16~20: 조합 ────────────────────────────────────────────────────────
console.log("\n[TC-16~20] 조합");
test("TC-16: combine(0.8, 0.9, fn +) → maybe(0.72, 5) (확률 곱)", () => {
    const res = run(`(combine (maybe 0.8 2) (maybe 0.9 3) (fn [$a $b] (+ $a $b)))`);
    if (!res || res._tag !== 'Maybe')
        throw new Error(`_tag이 Maybe가 아님: ${JSON.stringify(res)}`);
    if (res.value !== 5)
        throw new Error(`value=${res.value}, 기대=5`);
    // 부동소수점 허용: 0.72 ±0.001
    if (Math.abs(res.confidence - 0.72) > 0.001)
        throw new Error(`confidence=${res.confidence}, 기대=0.72`);
});
test("TC-17: combine with uncertain-none → None", () => {
    const res = run(`(combine (maybe 0.8 2) (uncertain-none) +)`);
    if (!res || res._tag !== 'None')
        throw new Error(`None이 나와야 함: ${JSON.stringify(res)}`);
});
test("TC-18: confidence 출력 확인 (maybe-confidence)", () => {
    const res = run(`(maybe-confidence (maybe 0.75 "test"))`);
    if (res !== 0.75)
        throw new Error(`got ${res}, 기대=0.75`);
});
test("TC-19: reason 필드 보존 (maybe-reason)", () => {
    const res = run(`(maybe-reason (maybe 0.6 "Seoul" "검색 기반"))`);
    if (res !== '검색 기반')
        throw new Error(`got ${res}, 기대=검색 기반`);
});
test("TC-20: maybe를 list에 저장 가능", () => {
    const res = run(`
    (define candidates (list (maybe 0.9 "A") (maybe 0.4 "B")))
    (is-maybe? (first $candidates))
  `);
    if (res !== true)
        throw new Error(`got ${res}, 기대=true`);
});
// ── TC-21~25: 실용 시나리오 ────────────────────────────────────────────────
console.log("\n[TC-21~25] 실용 시나리오");
test("TC-21: AI 답변 불확실성 표현 (maybe 0.7 \"서울\" \"검색 결과 기반\")", () => {
    const res = run(`
    (define location (maybe 0.7 "서울" "검색 결과 기반"))
    (is-maybe? $location)
  `);
    if (res !== true)
        throw new Error(`got ${res}, 기대=true`);
});
test("TC-22: 여러 후보 중 best 선택", () => {
    const res = run(`
    (define best (most-likely (list (maybe 0.4 "부산") (maybe 0.85 "서울") (maybe 0.6 "대전"))))
    (maybe-value $best)
  `);
    if (res !== '서울')
        throw new Error(`got ${res}, 기대=서울`);
});
test("TC-23: threshold로 신뢰 구간 필터링", () => {
    const res = run(`
    (define answer (maybe 0.65 "정답"))
    (confident $answer 0.8)
  `);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null (threshold 미달)`);
});
test("TC-24: uncertain-none 처리 fallback 패턴", () => {
    const res = run(`
    (define result (uncertain-none "정보 없음"))
    (if (is-none? $result) "fallback" "found")
  `);
    if (res !== 'fallback')
        throw new Error(`got ${res}, 기대=fallback`);
});
test("TC-25: combine 체인 — 확률 누적 감소 확인", () => {
    const res = run(`
    (define a (maybe 0.9 10))
    (define b (maybe 0.8 5))
    (define combined (combine $a $b (fn [$x $y] (+ $x $y))))
    (maybe-confidence $combined)
  `);
    if (typeof res !== 'number')
        throw new Error(`got ${res}, 숫자여야 함`);
    // 0.9 * 0.8 = 0.72 ±0.001
    if (Math.abs(res - 0.72) > 0.001)
        throw new Error(`got ${res}, 기대=0.72`);
});
// ── TC-26~30: 추가 시나리오 ───────────────────────────────────────────────
console.log("\n[TC-26~30] 추가 시나리오");
test("TC-26: maybe-value로 값 추출", () => {
    const res = run(`(maybe-value (maybe 0.9 "extracted"))`);
    if (res !== 'extracted')
        throw new Error(`got ${res}`);
});
test("TC-27: maybe-value on uncertain-none → null", () => {
    const res = run(`(maybe-value (uncertain-none))`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
test("TC-28: maybe-confidence on uncertain-none → null", () => {
    const res = run(`(maybe-confidence (uncertain-none))`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
test("TC-29: when-confident uncertain-none → null", () => {
    const res = run(`(when-confident (uncertain-none) 0.5 (fn [$x] $x))`);
    if (res !== null)
        throw new Error(`got ${res}, 기대=null`);
});
test("TC-30: maybe confidence=0.0 → confident threshold=0 OK", () => {
    const res = run(`(confident (maybe 0.0 "zero") 0.0)`);
    if (res !== 'zero')
        throw new Error(`got ${res}, 기대=zero`);
});
// ── Phase 56 Regression ────────────────────────────────────────────────────
console.log("\n[Regression] Phase 56 Lexical Scope (14/14)");
test("Phase 56 regression 14/14 PASS", () => {
    const result = (0, child_process_1.execSync)("npx ts-node src/test-phase56-lexical-scope.ts", { encoding: "utf-8", cwd: "/home/kimjin/kim/Desktop/kim/01_Active_Projects/freelang-v9" });
    if (!result.includes("14 passed")) {
        throw new Error(`Phase 56 regression 실패: ${result.slice(-300)}`);
    }
});
// ── 결과 ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Phase 91 불확실성 타입: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase91-maybe.js.map