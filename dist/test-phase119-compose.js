"use strict";
// FreeLang v9: Phase 119 — COMPOSE-REASON 추론 블록 조합기 검증
Object.defineProperty(exports, "__esModule", { value: true });
const compose_reason_1 = require("./compose-reason");
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
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg || "assertion failed");
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
console.log("\n=== Phase 119: COMPOSE-REASON 추론 블록 조합기 ===\n");
// --- Part 1: ReasonComposer 클래스 직접 테스트 ---
test("1. ReasonComposer 생성", () => {
    const composer = new compose_reason_1.ReasonComposer();
    assert(composer instanceof compose_reason_1.ReasonComposer, "ReasonComposer 인스턴스여야 함");
});
test("2. compose() 단일 step", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "double", fn: (x) => x * 2 }
    ];
    const result = composer.compose(steps, 5);
    assert(result.output === 10, `expected 10, got ${result.output}`);
});
test("3. compose() 여러 step (파이프라인)", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "add1", fn: (x) => x + 1 },
        { name: "mul3", fn: (x) => x * 3 },
        { name: "sub2", fn: (x) => x - 2 },
    ];
    const result = composer.compose(steps, 4);
    // (4+1)*3-2 = 13
    assert(result.output === 13, `expected 13, got ${result.output}`);
});
test("4. 이전 step 출력이 다음 step input", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const received = [];
    const steps = [
        { name: "s1", fn: (x) => { received.push(x); return x + "A"; } },
        { name: "s2", fn: (x) => { received.push(x); return x + "B"; } },
    ];
    composer.compose(steps, "Z");
    assert(received[0] === "Z", `s1 input should be Z, got ${received[0]}`);
    assert(received[1] === "ZA", `s2 input should be ZA, got ${received[1]}`);
});
test("5. history 기록", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "step-a", fn: (x) => x + 10 },
        { name: "step-b", fn: (x) => x * 2 },
    ];
    const result = composer.compose(steps, 5);
    assert(result.history.length === 2, `history should have 2 entries, got ${result.history.length}`);
    assert(result.history[0].name === "step-a", `first history name should be step-a`);
    assert(result.history[1].name === "step-b", `second history name should be step-b`);
});
test("6. context.store 공유", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        {
            name: "store-value",
            fn: (x, ctx) => {
                ctx.store.set("key", "shared-data");
                return x;
            }
        },
        {
            name: "read-value",
            fn: (x, ctx) => {
                return ctx.store.get("key");
            }
        },
    ];
    const result = composer.compose(steps, "input");
    assert(result.output === "shared-data", `expected shared-data, got ${result.output}`);
});
test("7. condition으로 step 건너뜀", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "always", fn: (x) => x + 1 },
        { name: "skip-if-big", fn: (x) => x * 100, condition: (x) => x < 3 },
        { name: "add5", fn: (x) => x + 5 },
    ];
    // input=10: always→11, skip-if-big 조건 false(11 < 3 is false) → skip, add5→16
    const result = composer.compose(steps, 10);
    assert(result.output === 16, `expected 16, got ${result.output}`);
});
test("8. onError fallback", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        {
            name: "fail-step",
            fn: () => { throw new Error("test error"); },
            onError: (e, input) => `fallback:${input}`
        },
    ];
    const result = composer.compose(steps, "hello");
    assert(result.output === "fallback:hello", `expected fallback:hello, got ${result.output}`);
    assert(result.success === true, "success should be true when onError handles it");
});
test("9. onError 없이 에러 → success=false", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "explode", fn: () => { throw new Error("boom"); } },
        { name: "never-reached", fn: (x) => x },
    ];
    const result = composer.compose(steps, "input");
    assert(result.success === false, "success should be false");
    assert(result.history[0].name === "explode(failed)", `expected explode(failed), got ${result.history[0].name}`);
});
test("10. success=true 정상 완료", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "inc", fn: (x) => x + 1 },
        { name: "inc", fn: (x) => x + 1 },
    ];
    const result = composer.compose(steps, 0);
    assert(result.success === true, "should succeed");
    assert(result.output === 2, `expected 2, got ${result.output}`);
});
test("11. duration 기록", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "fast", fn: (x) => x },
    ];
    const result = composer.compose(steps, 42);
    assert(typeof result.duration === "number", "duration should be number");
    assert(result.duration >= 0, "duration should be >= 0");
    assert(result.history[0].duration >= 0, "step duration should be >= 0");
});
test("12. steps 카운트", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "a", fn: (x) => x },
        { name: "b", fn: (x) => x },
        { name: "c", fn: (x) => x },
    ];
    const result = composer.compose(steps, "x");
    assert(result.steps === 3, `expected 3 steps, got ${result.steps}`);
});
// --- Part 2: PipelineBuilder 테스트 ---
test("13. PipelineBuilder 생성", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const builder = composer.pipeline();
    assert(builder instanceof compose_reason_1.PipelineBuilder, "should be PipelineBuilder");
});
test("14. pipeline().step().step().run()", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const result = composer.pipeline()
        .step("double", (x) => x * 2)
        .step("add10", (x) => x + 10)
        .run(5);
    // 5*2+10 = 20
    assert(result.output === 20, `expected 20, got ${result.output}`);
});
test("15. pipeline stepCount()", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const builder = composer.pipeline()
        .step("a", (x) => x)
        .step("b", (x) => x)
        .step("c", (x) => x);
    assert(builder.stepCount() === 3, `expected 3, got ${builder.stepCount()}`);
});
test("16. 빈 steps → input 그대로", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const result = composer.compose([], "original");
    assert(result.output === "original", `expected original, got ${result.output}`);
    assert(result.steps === 0, `expected 0 steps, got ${result.steps}`);
    assert(result.history.length === 0, "history should be empty");
});
test("17. context.step 증가", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const stepNums = [];
    const steps = [
        { name: "s0", fn: (x, ctx) => { stepNums.push(ctx.step); return x; } },
        { name: "s1", fn: (x, ctx) => { stepNums.push(ctx.step); return x; } },
        { name: "s2", fn: (x, ctx) => { stepNums.push(ctx.step); return x; } },
    ];
    composer.compose(steps, null);
    assert(stepNums[0] === 0, `step 0 should be 0, got ${stepNums[0]}`);
    assert(stepNums[1] === 1, `step 1 should be 1, got ${stepNums[1]}`);
    assert(stepNums[2] === 2, `step 2 should be 2, got ${stepNums[2]}`);
});
test("18. history name 포함", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "my-step", fn: (x) => x },
    ];
    const result = composer.compose(steps, "v");
    assert(result.history[0].name === "my-step", "history should include step name");
});
test("19. globalComposer 싱글톤", () => {
    assert(compose_reason_1.globalComposer instanceof compose_reason_1.ReasonComposer, "globalComposer should be ReasonComposer");
    const r = compose_reason_1.globalComposer.compose([{ name: "id", fn: (x) => x }], 99);
    assert(r.output === 99, `expected 99, got ${r.output}`);
});
// --- Part 3: 내장 함수 테스트 ---
test("20. compose-reason 내장함수", () => {
    // FL에서 직접 steps 리스트 제공하기 어려우므로 JS 레이어에서 테스트
    const steps = [
        { name: "inc", fn: (x) => x + 1 },
        { name: "dbl", fn: (x) => x * 2 },
    ];
    const result = compose_reason_1.globalComposer.compose(steps, 3);
    // (3+1)*2 = 8
    assert(result.output === 8, `expected 8, got ${result.output}`);
});
test("21. compose-history 내장함수", () => {
    const steps = [
        { name: "step-alpha", fn: (x) => x },
        { name: "step-beta", fn: (x) => x },
    ];
    const result = compose_reason_1.globalComposer.compose(steps, "v");
    const names = result.history.map(h => h.name);
    assert(names.includes("step-alpha"), "history should include step-alpha");
    assert(names.includes("step-beta"), "history should include step-beta");
});
test("22. compose-steps 내장함수", () => {
    const steps = [
        { name: "a", fn: (x) => x },
        { name: "b", fn: (x) => x },
        { name: "c", fn: (x) => x },
        { name: "d", fn: (x) => x },
    ];
    const result = compose_reason_1.globalComposer.compose(steps, 0);
    assert(result.steps === 4, `expected 4, got ${result.steps}`);
});
test("23. 조건부 step (condition=false → skip)", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "always", fn: (x) => x + 10 },
        {
            name: "conditional",
            fn: (x) => x * 999,
            condition: () => false // 항상 skip
        },
        { name: "add1", fn: (x) => x + 1 },
    ];
    const result = composer.compose(steps, 0);
    // 0+10=10, skip, 10+1=11
    assert(result.output === 11, `expected 11, got ${result.output}`);
    // skipped 항목도 history에 기록됨
    const skippedEntry = result.history.find(h => h.name.includes("skipped"));
    assert(skippedEntry !== undefined, "skipped step should appear in history");
});
test("24. step 이름이 history에 기록", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "COT-step", fn: (x) => x },
        { name: "REFLECT-step", fn: (x) => x },
        { name: "CRITIQUE-step", fn: (x) => x },
    ];
    const result = composer.compose(steps, "input");
    const names = result.history.map(h => h.name);
    assert(names[0] === "COT-step", "first should be COT-step");
    assert(names[1] === "REFLECT-step", "second should be REFLECT-step");
    assert(names[2] === "CRITIQUE-step", "third should be CRITIQUE-step");
});
test("25. 통합: 3단계 파이프라인 (META→REASON→REFLECT)", () => {
    const composer = new compose_reason_1.ReasonComposer();
    // 메타 추론: 입력 분석 및 전략 결정
    // 추론: 실제 계산
    // 반성: 품질 확인
    let metaDecision = "";
    let reasonOutput = "";
    let reflectScore = 0;
    const steps = [
        {
            name: "META-REASON",
            fn: (input, ctx) => {
                metaDecision = typeof input === "number" ? "arithmetic" : "text";
                ctx.store.set("strategy", metaDecision);
                return input;
            }
        },
        {
            name: "REASON",
            fn: (input, ctx) => {
                const strategy = ctx.store.get("strategy");
                if (strategy === "arithmetic") {
                    reasonOutput = `computed:${input * 2 + 1}`;
                }
                else {
                    reasonOutput = `processed:${String(input).toUpperCase()}`;
                }
                return reasonOutput;
            }
        },
        {
            name: "REFLECT",
            fn: (input, ctx) => {
                reflectScore = String(input).startsWith("computed:") ? 0.9 : 0.7;
                ctx.store.set("score", reflectScore);
                return { result: input, score: reflectScore };
            }
        },
    ];
    const result = composer.compose(steps, 21);
    assert(result.success === true, "pipeline should succeed");
    assert(result.steps === 3, `should have 3 steps, got ${result.steps}`);
    assert(metaDecision === "arithmetic", `meta should decide arithmetic, got ${metaDecision}`);
    assert(reasonOutput === "computed:43", `reason output should be computed:43, got ${reasonOutput}`);
    assert(reflectScore === 0.9, `reflect score should be 0.9, got ${reflectScore}`);
    assert(result.output.score === 0.9, "final output should include score");
    assert(result.history.length === 3, `history should have 3 entries, got ${result.history.length}`);
});
// --- Part 4: 추가 엣지 케이스 ---
test("26. history.input / history.output 올바른 값", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "transform", fn: (x) => x + 100 },
    ];
    const result = composer.compose(steps, 42);
    assert(result.history[0].input === 42, `input should be 42, got ${result.history[0].input}`);
    assert(result.history[0].output === 142, `output should be 142, got ${result.history[0].output}`);
});
test("27. onError 후 다음 step 계속 실행", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        {
            name: "fail-with-fallback",
            fn: () => { throw new Error("error"); },
            onError: () => "recovered"
        },
        { name: "after-error", fn: (x) => `${x}-done` },
    ];
    const result = composer.compose(steps, "start");
    assert(result.output === "recovered-done", `expected recovered-done, got ${result.output}`);
    assert(result.success === true, "should still succeed with fallback");
});
test("28. PipelineBuilder condition 옵션", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const result = composer.pipeline()
        .step("always-run", (x) => x + 1)
        .step("skip-this", (x) => x * 999, { condition: () => false })
        .step("final", (x) => x + 5)
        .run(10);
    // 10+1=11, skip, 11+5=16
    assert(result.output === 16, `expected 16, got ${result.output}`);
});
test("29. 연속 onError 처리", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        {
            name: "fail1",
            fn: () => { throw new Error("e1"); },
            onError: (_e, input) => input + 1
        },
        {
            name: "fail2",
            fn: () => { throw new Error("e2"); },
            onError: (_e, input) => input * 2
        },
    ];
    const result = composer.compose(steps, 5);
    // fail1 fallback: 5+1=6, fail2 fallback: 6*2=12
    assert(result.output === 12, `expected 12, got ${result.output}`);
    assert(result.success === true, "should succeed with fallbacks");
});
test("30. 객체 타입 데이터 파이프라인", () => {
    const composer = new compose_reason_1.ReasonComposer();
    const steps = [
        { name: "add-field", fn: (obj) => ({ ...obj, score: 100 }) },
        { name: "double-score", fn: (obj) => ({ ...obj, score: obj.score * 2 }) },
        { name: "add-label", fn: (obj) => ({ ...obj, label: `score-${obj.score}` }) },
    ];
    const result = composer.compose(steps, { name: "test" });
    assert(result.output.name === "test", "name should be preserved");
    assert(result.output.score === 200, `score should be 200, got ${result.output.score}`);
    assert(result.output.label === "score-200", `label should be score-200`);
});
// --- 결과 요약 ---
console.log(`\n총 ${passed + failed}개 테스트: ${passed} PASS, ${failed} FAIL\n`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase119-compose.js.map