"use strict";
// FreeLang v9 Phase 89: 벤치마크 프레임워크 단위 테스트
Object.defineProperty(exports, "__esModule", { value: true });
const bench_runner_1 = require("./benchmarks/bench-runner");
const bench_vm_1 = require("./benchmarks/bench-vm");
const compiler_1 = require("./compiler");
const vm_1 = require("./vm");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
// ─── 테스트 인프라 ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name} — ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(a, b, msg) {
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same)
        throw new Error(msg ?? `기대: ${JSON.stringify(b)}, 실제: ${JSON.stringify(a)}`);
}
function assertClose(a, b, tolerance, msg) {
    if (Math.abs(a - b) > tolerance) {
        throw new Error(msg ?? `기대: ~${b}, 실제: ${a} (허용오차: ${tolerance})`);
    }
}
// ─── FL 실행 헬퍼 ────────────────────────────────────────────────────────────
function runFL(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ─── VM 헬퍼 ─────────────────────────────────────────────────────────────────
function lit(value) {
    if (typeof value === "number")
        return { kind: "literal", type: "number", value };
    if (typeof value === "boolean")
        return { kind: "literal", type: "boolean", value };
    if (value === null)
        return { kind: "literal", type: "null", value: null };
    return { kind: "literal", type: "string", value };
}
function sexpr(op, ...args) {
    return { kind: "sexpr", op, args };
}
function runVM(node) {
    const compiler = new compiler_1.BytecodeCompiler();
    const vm = new vm_1.VM();
    const chunk = compiler.compile(node);
    return vm.run(chunk);
}
// ─── TC-1 ~ TC-13: BenchmarkSuite 기본 기능 ─────────────────────────────────
console.log("\n[TC-1 ~ TC-5] BenchmarkSuite 기본 구조");
test("TC-1: BenchmarkSuite 생성", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    assert(suite !== null && suite !== undefined, "BenchmarkSuite 생성 실패");
    assert(typeof suite.add === "function", "add 메서드 없음");
    assert(typeof suite.run === "function", "run 메서드 없음");
});
test("TC-2: add 체이닝", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    const result = suite
        .add("bench-a", () => 1 + 1)
        .add("bench-b", () => 2 + 2);
    assert(result === suite, "add가 this를 반환하지 않음");
});
test("TC-3: run() 결과 배열 반환", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("test", () => Math.sqrt(2));
    const results = suite.run();
    assert(Array.isArray(results), "결과가 배열이 아님");
    assertEqual(results.length, 1, "결과 개수가 1이 아님");
});
test("TC-4: BenchmarkResult 구조 검증", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("check", () => 42);
    const [r] = suite.run();
    assert("name" in r, "name 없음");
    assert("opsPerSec" in r, "opsPerSec 없음");
    assert("avgMs" in r, "avgMs 없음");
    assert("iterations" in r, "iterations 없음");
    assert("totalMs" in r, "totalMs 없음");
});
test("TC-5: iterations 기본값 100", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("default-iter", () => 1);
    const [r] = suite.run();
    assertEqual(r.iterations, 100, "기본 iterations가 100이 아님");
});
console.log("\n[TC-6 ~ TC-11] 수치 계산 검증");
test("TC-6: totalMs > 0", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("slow-ish", () => {
        let x = 0;
        for (let i = 0; i < 1000; i++)
            x += i;
        return x;
    }, { iterations: 50 });
    const [r] = suite.run();
    assert(r.totalMs > 0, `totalMs가 0 이하: ${r.totalMs}`);
});
test("TC-7: avgMs = totalMs / iterations (근사)", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("check-avg", () => Math.PI, { iterations: 200 });
    const [r] = suite.run();
    const expected = r.totalMs / r.iterations;
    // 부동소수점 허용 오차 0.001ms
    assertClose(r.avgMs, expected, 0.001, `avgMs 불일치: ${r.avgMs} vs ${expected}`);
});
test("TC-8: opsPerSec = 1000 / avgMs (근사)", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("ops-check", () => 1 + 1, { iterations: 300 });
    const [r] = suite.run();
    if (r.avgMs > 0) {
        const expected = 1000 / r.avgMs;
        assertClose(r.opsPerSec, expected, expected * 0.01, "opsPerSec 계산 불일치 (1% 이상 오차)");
    }
});
test("TC-9: toMarkdown — 헤더에 '| name |' 포함", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("md-test", () => 0);
    const results = suite.run();
    const md = suite.toMarkdown(results);
    assert(md.includes("| name |"), "헤더에 '| name |' 없음");
});
test("TC-10: toMarkdown — 각 결과 행 포함", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("row-alpha", () => 1);
    suite.add("row-beta", () => 2);
    const results = suite.run();
    const md = suite.toMarkdown(results);
    assert(md.includes("row-alpha"), "row-alpha 행 없음");
    assert(md.includes("row-beta"), "row-beta 행 없음");
});
test("TC-11: toJSON — 배열 형태", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("json-test", () => 99);
    const results = suite.run();
    const json = suite.toJSON(results);
    assert(Array.isArray(json), "toJSON 결과가 배열이 아님");
    assert(json.length === 1, "JSON 배열 길이가 1이 아님");
});
console.log("\n[TC-12 ~ TC-13] 여러 벤치마크 / 빈 suite");
test("TC-12: 여러 benchmark 추가 후 run", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite
        .add("a", () => 1)
        .add("b", () => 2)
        .add("c", () => 3);
    const results = suite.run();
    assertEqual(results.length, 3, "결과 수가 3이 아님");
    assertEqual(results[0].name, "a");
    assertEqual(results[1].name, "b");
    assertEqual(results[2].name, "c");
});
test("TC-13: 빈 suite run → 빈 배열", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    const results = suite.run();
    assert(Array.isArray(results), "빈 배열이 아님");
    assertEqual(results.length, 0, "빈 suite 결과가 0이 아님");
});
console.log("\n[TC-14 ~ TC-17] 실제 FL 코드 벤치마크");
test("TC-14: 실제 FL 코드 벤치마크 — (+ 1 2) N회", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("FL: (+ 1 2)", () => runFL("(+ 1 2)"), { iterations: 50 });
    const [r] = suite.run();
    assert(r.opsPerSec > 0, `opsPerSec가 0 이하: ${r.opsPerSec}`);
    assert(r.totalMs > 0, `totalMs가 0 이하: ${r.totalMs}`);
    // 결과값 정확성 확인
    const val = runFL("(+ 1 2)");
    assertEqual(val, 3, "(+ 1 2) 결과가 3이 아님");
});
test("TC-15: 팩토리얼 벤치마크 결과 > 0 opsPerSec", () => {
    const factSrc = `[FUNC fact :params [$n] :body (if (= $n 0) 1 (* $n (fact (- $n 1))))] (fact 10)`;
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("FL: factorial(10)", () => runFL(factSrc), { iterations: 20 });
    const [r] = suite.run();
    assert(r.opsPerSec > 0, `factorial 벤치마크 opsPerSec가 0: ${r.opsPerSec}`);
    // 정확성 확인
    const val = runFL(factSrc);
    assertEqual(val, 3628800, "factorial(10) 결과 불일치");
});
test("TC-16: BenchmarkSuite.findResult로 결과 찾기", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("target-bench", () => 42, { iterations: 10 });
    suite.add("other-bench", () => 0, { iterations: 10 });
    const results = suite.run();
    const found = suite.findResult(results, "target-bench");
    assert(found !== undefined, "findResult가 undefined 반환");
    assertEqual(found.name, "target-bench", "이름 불일치");
});
test("TC-17: 빠른 작업 > 느린 작업 opsPerSec", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("fast", () => 1 + 1, { iterations: 200 });
    suite.add("slow", () => {
        // 의도적으로 느린 작업
        let s = 0;
        for (let i = 0; i < 50000; i++)
            s += Math.sqrt(i);
        return s;
    }, { iterations: 10 });
    const results = suite.run();
    const fast = suite.findResult(results, "fast");
    const slow = suite.findResult(results, "slow");
    assert(fast.opsPerSec > slow.opsPerSec, `빠른 작업(${fast.opsPerSec.toFixed(0)})이 느린 작업(${slow.opsPerSec.toFixed(0)})보다 느림`);
});
console.log("\n[TC-18 ~ TC-20] 테이블 행수 + VM + Regression");
test("TC-18: 벤치마크 표 행 수 = 추가한 bench 수", () => {
    const suite = new bench_runner_1.BenchmarkSuite();
    suite.add("x1", () => 1);
    suite.add("x2", () => 2);
    suite.add("x3", () => 3);
    const results = suite.run();
    const md = suite.toMarkdown(results);
    // 헤더 2줄(헤더+구분자) + 3데이터 = 5줄
    const lines = md.split("\n").filter(l => l.startsWith("|"));
    // 데이터 행만 (헤더 제외)
    const dataRows = lines.slice(2); // header + separator
    assertEqual(dataRows.length, 3, `데이터 행 수가 3이 아님: ${dataRows.length}`);
});
test("TC-19: VM 벤치마크 — 결과 숫자값 정확성", () => {
    // (+ (* 2 3) (- 10 4)) = 6 + 6 = 12
    const ast = sexpr("+", sexpr("*", lit(2), lit(3)), sexpr("-", lit(10), lit(4)));
    const result = runVM(ast);
    assertEqual(result, 12, `VM 결과가 12가 아님: ${result}`);
    // VM 벤치마크 전체 실행
    const vmResults = (0, bench_vm_1.runVMBenchmarks)();
    assert(vmResults.length > 0, "VM 벤치마크 결과 없음");
    for (const r of vmResults) {
        assert(r.opsPerSec > 0, `${r.name}: opsPerSec가 0 이하`);
    }
});
// ─── TC-20: Phase 56 regression 14/14 ───────────────────────────────────────
console.log("\n[TC-20] Phase 56 Regression");
test("TC-20: Phase 56 regression — 14개 핵심 케이스 검증", () => {
    // 1. 산술 기본
    assertEqual(runFL("(+ 1 2 3)"), 6, "합산 불일치");
    assertEqual(runFL("(* 2 3 4)"), 24, "곱셈 불일치");
    assertEqual(runFL("(- 10 3)"), 7, "뺄셈 불일치");
    assertEqual(runFL("(/ 10 2)"), 5, "나눗셈 불일치");
    // 2. 비교
    assertEqual(runFL("(> 5 3)"), true, "비교 > 불일치");
    assertEqual(runFL("(< 3 5)"), true, "비교 < 불일치");
    assertEqual(runFL("(= 4 4)"), true, "비교 = 불일치");
    // 3. if 조건문
    assertEqual(runFL("(if true 1 2)"), 1, "if true 불일치");
    assertEqual(runFL("(if false 1 2)"), 2, "if false 불일치");
    // 4. 리스트 연산
    const lst = runFL("(length (list 1 2 3 4 5))");
    assertEqual(lst, 5, "리스트 length 불일치");
    // 5. 재귀 팩토리얼 (FUNC 구문)
    const fact = runFL("[FUNC fact :params [$n]\n  :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]\n(fact 6)");
    assertEqual(fact, 720, "팩토리얼 6 결과 불일치");
    // 6. 재귀 피보나치
    const fib = runFL("[FUNC fib :params [$n]\n  :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]\n(fib 10)");
    assertEqual(fib, 55, "피보나치(10) 결과 불일치");
    // 7. 클로저 캡처 (fn 구문)
    const closure = runFL("(define base 100)\n(define add-base (fn [$x] (+ $x $base)))\n(add-base 5)");
    assertEqual(closure, 105, "클로저 결과 불일치");
    // 8. and/or/not
    assertEqual(runFL("(and true true)"), true, "and 불일치");
    assertEqual(runFL("(or false true)"), true, "or 불일치");
    assertEqual(runFL("(not false)"), true, "not 불일치");
    // 9. 문자열 length
    assertEqual(runFL('(length "hello")'), 5, "문자열 length 불일치");
    // 10. 중첩 산술
    assertEqual(runFL("(+ (* 2 3) (- 10 4))"), 12, "중첩 산술 불일치");
    // 11. loop/recur
    const loopResult = runFL("(loop [acc 0 n 5]\n  (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))");
    assertEqual(loopResult, 15, "loop/recur 결과 불일치");
    // 12. 고차 함수 (fn 반환)
    const adder = runFL("(define make-adder (fn [$n] (fn [$x] (+ $x $n))))\n(define add10 (make-adder 10))\n(add10 7)");
    assertEqual(adder, 17, "고차 함수 결과 불일치");
    // 13. 리스트 first
    const head = runFL("(first (list 10 20 30))");
    assertEqual(head, 10, "first 불일치");
    // 14. 수학 floor
    assertEqual(runFL("(floor 10.7)"), 10, "floor 불일치");
});
// ─── 최종 결과 ───────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────────────────────");
console.log(`Phase 89 벤치마크: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase89-bench.js.map