"use strict";
// FreeLang v9: 통합 테스트 — TS interpreter + FL stdlib
//
// 목표: interpreter.ts가 시작할 때 freelang-stdlib.fl을 로드하므로
// FL 서버 코드에서 fl-map, fl-filter, fl-reduce, Maybe, Result를 바로 사용 가능
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
        console.log(`  ❌ ${name}: ${e.message?.slice(0, 120)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ── fl-map / fl-filter / fl-reduce ────────────────────────────
console.log("\n[INT-A] Array 고차 함수");
test("fl-map — 숫자 변환", () => {
    const result = run(`
[FUNC double :params [$x] :body ((* $x 2))]
(fl-map [1 2 3 4 5] double)`);
    if (!Array.isArray(result) || result[0] !== 2 || result[4] !== 10)
        throw new Error(`got ${JSON.stringify(result)}`);
});
test("fl-filter — 짝수 필터", () => {
    const result = run(`
[FUNC even? :params [$n] :body ((= (% $n 2) 0))]
(fl-filter [1 2 3 4 5 6] even?)`);
    if (!Array.isArray(result) || result.length !== 3 || result[0] !== 2)
        throw new Error(`got ${JSON.stringify(result)}`);
});
test("fl-reduce — 합계", () => {
    const result = run(`
[FUNC add :params [$a $b] :body ((+ $a $b))]
(fl-reduce [1 2 3 4 5] 0 add)`);
    if (result !== 15)
        throw new Error(`got ${result}`);
});
test("fl-range + fl-reduce — 1~10 합계", () => {
    const result = run(`
[FUNC add :params [$a $b] :body ((+ $a $b))]
(fl-reduce (fl-range 1 11) 0 add)`);
    if (result !== 55)
        throw new Error(`got ${result}`);
});
test("fl-map + fl-filter 파이프라인", () => {
    const result = run(`
[FUNC double :params [$x] :body ((* $x 2))]
[FUNC gt5 :params [$n] :body ((> $n 5))]
(fl-filter (fl-map [1 2 3 4 5] double) gt5)`);
    if (!Array.isArray(result) || result.length !== 3 || result[0] !== 6)
        throw new Error(`got ${JSON.stringify(result)}`);
});
test("fl-find — 첫 조건 일치 항목", () => {
    const result = run(`
[FUNC gt3 :params [$n] :body ((> $n 3))]
(fl-find [1 2 3 4 5] gt3)`);
    if (result !== 4)
        throw new Error(`got ${result}`);
});
test("fl-any? / fl-all?", () => {
    const any = run(`
[FUNC gt4 :params [$n] :body ((> $n 4))]
(fl-any? [1 2 3 4 5] gt4)`);
    const all = run(`
[FUNC pos? :params [$n] :body ((> $n 0))]
(fl-all? [1 2 3] pos?)`);
    if (any !== true)
        throw new Error(`any: ${any}`);
    if (all !== true)
        throw new Error(`all: ${all}`);
});
test("fl-flatten — 중첩 배열 평탄화", () => {
    const result = run(`(fl-flatten [[1 2] [3 [4 5]]])`);
    if (!Array.isArray(result) || result.length !== 5)
        throw new Error(`got ${JSON.stringify(result)}`);
});
test("fl-zip — 두 배열 묶기", () => {
    const result = run(`(fl-zip [1 2 3] ["a" "b" "c"])`);
    if (!Array.isArray(result) || result[0][0] !== 1 || result[0][1] !== "a")
        throw new Error(`got ${JSON.stringify(result)}`);
});
// ── Maybe ──────────────────────────────────────────────────────
console.log("\n[INT-B] Maybe/Option");
test("some + maybe-or", () => {
    const result = run(`(maybe-or (some 42) 0)`);
    if (result !== 42)
        throw new Error(`got ${result}`);
});
test("none + maybe-or → 기본값", () => {
    const result = run(`(maybe-or (none) 99)`);
    if (result !== 99)
        throw new Error(`got ${result}`);
});
test("maybe-map — 변환", () => {
    const result = run(`
[FUNC double :params [$x] :body ((* $x 2))]
(maybe-or (maybe-map (some 5) double) 0)`);
    if (result !== 10)
        throw new Error(`got ${result}`);
});
test("maybe-chain — 연쇄", () => {
    const result = run(`
[FUNC safe-double :params [$n]
  :body ((if (> $n 0) (some (* $n 2)) (none)))
]
(maybe-or (maybe-chain (some 5) safe-double) 0)`);
    if (result !== 10)
        throw new Error(`got ${result}`);
});
// ── Result ──────────────────────────────────────────────────────
console.log("\n[INT-C] Result/Either");
test("ok + result-or", () => {
    const result = run(`(result-or (ok 42) 0)`);
    if (result !== 42)
        throw new Error(`got ${result}`);
});
test("err + result-or → 기본값", () => {
    const result = run(`(result-or (err "실패") 99)`);
    if (result !== 99)
        throw new Error(`got ${result}`);
});
test("result-map — ok 변환", () => {
    const result = run(`
[FUNC double :params [$x] :body ((* $x 2))]
(result-or (result-map (ok 5) double) 0)`);
    if (result !== 10)
        throw new Error(`got ${result}`);
});
test("result-chain — ok 연쇄", () => {
    const result = run(`
[FUNC safe-div :params [$n]
  :body ((if (!= $n 0) (ok (/ 100 $n)) (err "division by zero")))
]
(result-or (result-chain (ok 5) safe-div) -1)`);
    if (result !== 20)
        throw new Error(`got ${result}`);
});
// ── 서버 코드 패턴 시뮬레이션 ────────────────────────────────
console.log("\n[INT-D] 서버 코드 패턴");
test("fl-map으로 DB 결과 변환 패턴", () => {
    const result = run(`
[FUNC format-user :params [$u]
  :body ((concat "USER:" (get $u 0)))
]
(fl-map [["alice"] ["bob"] ["charlie"]] format-user)`);
    if (!Array.isArray(result) || result[0] !== "USER:alice")
        throw new Error(`got ${JSON.stringify(result)}`);
});
test("result + fl-filter 조합 패턴", () => {
    const result = run(`
[FUNC positive? :params [$n] :body ((> $n 0))]
[FUNC process :params [$nums]
  :body (
    (let [[$filtered (fl-filter $nums positive?)]]
      (if (> (length $filtered) 0)
        (ok $filtered)
        (err "빈 결과")
      )
    )
  )
]
(result-or (process [1 -2 3 -4 5]) [])`);
    if (!Array.isArray(result) || result.length !== 3)
        throw new Error(`got ${JSON.stringify(result)}`);
});
// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Integration stdlib: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-integration-stdlib.js.map