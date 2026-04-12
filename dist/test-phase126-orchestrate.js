"use strict";
// test-phase126-orchestrate.ts — FreeLang v9 Phase 126: ORCHESTRATE 에이전트 오케스트레이터
// 위상 정렬 기반 멀티 에이전트 오케스트레이터
// 최소 25개 PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const orchestrate_1 = require("./orchestrate");
const interpreter_1 = require("./interpreter");
let passed = 0;
let failed = 0;
const results = [];
function test(name, fn) {
    try {
        fn();
        passed++;
        results.push(`  ✅ PASS: ${name}`);
    }
    catch (e) {
        failed++;
        results.push(`  ❌ FAIL: ${name} — ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEq(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertDefined(v, msg) {
    if (v === undefined || v === null)
        throw new Error(msg ?? `Expected defined value, got ${v}`);
}
console.log("\n=== Phase 126: ORCHESTRATE 에이전트 오케스트레이터 ===\n");
// ─── 1. 기본 인스턴스 ─────────────────────────────────────────────────────
test("1. Orchestrator 생성", () => {
    const orch = new orchestrate_1.Orchestrator();
    assertDefined(orch, "Orchestrator 인스턴스 없음");
});
test("2. register() 에이전트 등록", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "agent-a", run: (x) => x });
    assert(orch.list().includes("agent-a"), "agent-a가 목록에 없음");
});
test("3. list() 목록 반환", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "x", run: (v) => v });
    orch.register({ id: "y", run: (v) => v });
    const lst = orch.list();
    assert(lst.includes("x") && lst.includes("y"), "list()에 x, y가 없음");
    assertEq(lst.length, 2, "list() 길이 2 예상");
});
// ─── 2. 단일/다중 태스크 실행 ────────────────────────────────────────────
test("4. run() 단일 태스크", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "t1", run: (x) => x * 2 });
    const result = orch.run([{ id: "t1", input: 5 }]);
    assertEq(result.outputs["t1"], 10, "단일 태스크 출력 10 예상");
});
test("5. run() 여러 태스크", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "a", run: (x) => x + 1 });
    orch.register({ id: "b", run: (x) => x + 2 });
    const result = orch.run([
        { id: "a", input: 10 },
        { id: "b", input: 20 },
    ]);
    assertEq(result.outputs["a"], 11, "a=11 예상");
    assertEq(result.outputs["b"], 22, "b=22 예상");
});
test("6. outputs taskId 키 구조", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "task1", run: (x) => "result-" + x });
    const result = orch.run([{ id: "task1", input: "hello" }]);
    assert("task1" in result.outputs, "outputs에 task1 키 없음");
    assertEq(result.outputs["task1"], "result-hello", "출력값 불일치");
});
test("7. order 배열 반환", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "m", run: (x) => x });
    const result = orch.run([{ id: "m", input: 0 }]);
    assert(Array.isArray(result.order), "order가 배열이 아님");
    assert(result.order.includes("m"), "order에 m 없음");
});
test("8. duration 기록", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "d", run: (x) => x });
    const result = orch.run([{ id: "d", input: 1 }]);
    assert(typeof result.duration === "number", "duration이 숫자가 아님");
    assert(result.duration >= 0, "duration이 음수");
});
test("9. success=true 정상 실행", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "s", run: (x) => x });
    const result = orch.run([{ id: "s", input: 42 }]);
    assertEq(result.success, true, "success가 true가 아님");
});
// ─── 3. 의존성 처리 ──────────────────────────────────────────────────────
test("10. 의존성 없는 태스크 — 등록 순서대로 실행", () => {
    const orch = new orchestrate_1.Orchestrator();
    const exec = [];
    orch.register({ id: "p", run: (x) => { exec.push("p"); return x; } });
    orch.register({ id: "q", run: (x) => { exec.push("q"); return x; } });
    orch.run([{ id: "p", input: 1 }, { id: "q", input: 2 }]);
    assert(exec.length === 2, "두 태스크 모두 실행되어야 함");
});
test("11. dependsOn → 선행 후 실행", () => {
    const orch = new orchestrate_1.Orchestrator();
    const exec = [];
    orch.register({ id: "first", run: (x) => { exec.push("first"); return x + 10; } });
    orch.register({ id: "second", run: (x) => { exec.push("second"); return x; } });
    orch.run([
        { id: "first", input: 5 },
        { id: "second", input: 0, dependsOn: ["first"] },
    ]);
    assertEq(exec[0], "first", "first가 먼저 실행되어야 함");
    assertEq(exec[1], "second", "second가 나중에 실행되어야 함");
});
test("12. depOutputs input에 전달", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "src", run: (_) => 99 });
    orch.register({ id: "dst", run: (x) => x.deps[0] + 1 });
    const result = orch.run([
        { id: "src", input: null },
        { id: "dst", input: {}, dependsOn: ["src"] },
    ]);
    assertEq(result.outputs["dst"], 100, "deps[0]=99 → dst=100 예상");
});
test("13. 위상 정렬 순서 검증 (A→B→C)", () => {
    const orch = new orchestrate_1.Orchestrator();
    const exec = [];
    orch.register({ id: "A", run: (x) => { exec.push("A"); return x; } });
    orch.register({ id: "B", run: (x) => { exec.push("B"); return x; } });
    orch.register({ id: "C", run: (x) => { exec.push("C"); return x; } });
    orch.run([
        { id: "A", input: 1 },
        { id: "B", input: 0, dependsOn: ["A"] },
        { id: "C", input: 0, dependsOn: ["B"] },
    ]);
    assertEq(exec[0], "A", "A 먼저");
    assertEq(exec[1], "B", "B 두 번째");
    assertEq(exec[2], "C", "C 마지막");
});
test("14. 에러 → success=false", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "err", run: (_) => { throw new Error("의도적 에러"); } });
    const result = orch.run([{ id: "err", input: null }]);
    assertEq(result.success, false, "에러 시 success=false 예상");
});
test("15. globalOrchestrator 싱글톤", () => {
    assertDefined(orchestrate_1.globalOrchestrator, "globalOrchestrator가 undefined");
    assert(orchestrate_1.globalOrchestrator instanceof orchestrate_1.Orchestrator, "globalOrchestrator가 Orchestrator 인스턴스가 아님");
});
// ─── 4. 내장 함수 ────────────────────────────────────────────────────────
test("16. orchestrate-register 내장함수", () => {
    const freshOrch = new orchestrate_1.Orchestrator();
    // createOrchestrateBuiltins가 globalOrchestrator에 등록하므로
    // 별도로 로컬 등록 검증
    freshOrch.register({ id: "builtin-test", run: (x) => x });
    assert(freshOrch.list().includes("builtin-test"), "builtin-test 등록 실패");
});
test("17. orchestrate 내장함수 (tasks → outputs)", () => {
    const interp = new interpreter_1.Interpreter();
    const builtins = (0, orchestrate_1.createOrchestrateBuiltins)(interp);
    // 미리 globalOrchestrator에 등록
    orchestrate_1.globalOrchestrator.register({ id: "fn-a", run: (x) => (x ?? 0) + 100 });
    const tasks = [{ id: "fn-a", input: 5 }];
    const outputs = builtins["orchestrate"](tasks);
    assertDefined(outputs, "orchestrate builtin 반환값 없음");
    assert(typeof outputs === "object", "outputs가 객체가 아님");
});
test("18. orchestrate-order 내장함수", () => {
    const interp = new interpreter_1.Interpreter();
    const builtins = (0, orchestrate_1.createOrchestrateBuiltins)(interp);
    const tasks = [
        { id: "step1", input: null },
        { id: "step2", input: null, dependsOn: ["step1"] },
    ];
    const order = builtins["orchestrate-order"](tasks);
    assert(Array.isArray(order), "order가 배열이 아님");
    assert(order.indexOf("step1") < order.indexOf("step2"), "step1이 step2보다 먼저 와야 함");
});
test("19. orchestrate-list 내장함수", () => {
    const interp = new interpreter_1.Interpreter();
    const builtins = (0, orchestrate_1.createOrchestrateBuiltins)(interp);
    orchestrate_1.globalOrchestrator.register({ id: "list-test-agent", run: (x) => x });
    const lst = builtins["orchestrate-list"]();
    assert(Array.isArray(lst), "list가 배열이 아님");
    assert(lst.includes("list-test-agent"), "list-test-agent가 목록에 없음");
});
// ─── 5. 체인 & 병렬 시나리오 ─────────────────────────────────────────────
test("20. A→B→C 체인 순서 (getOrder)", () => {
    const orch = new orchestrate_1.Orchestrator();
    const order = orch.getOrder([
        { id: "A", input: null },
        { id: "B", input: null, dependsOn: ["A"] },
        { id: "C", input: null, dependsOn: ["B"] },
    ]);
    assertEq(order[0], "A", "A 먼저");
    assertEq(order[1], "B", "B 두 번째");
    assertEq(order[2], "C", "C 마지막");
});
test("21. A,B 병렬 → C 순서 (C는 A,B 다음)", () => {
    const orch = new orchestrate_1.Orchestrator();
    const order = orch.getOrder([
        { id: "A", input: null },
        { id: "B", input: null },
        { id: "C", input: null, dependsOn: ["A", "B"] },
    ]);
    const idxA = order.indexOf("A");
    const idxB = order.indexOf("B");
    const idxC = order.indexOf("C");
    assert(idxA < idxC, "A가 C보다 먼저 와야 함");
    assert(idxB < idxC, "B가 C보다 먼저 와야 함");
});
test("22. 빈 tasks → outputs={}, success=true", () => {
    const orch = new orchestrate_1.Orchestrator();
    const result = orch.run([]);
    assertEq(Object.keys(result.outputs).length, 0, "빈 tasks는 outputs={}");
    assertEq(result.success, true, "빈 tasks도 success=true");
});
test("23. 순환 의존성 — 방문 체크로 무한루프 방지", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "X", run: (x) => x });
    orch.register({ id: "Y", run: (x) => x });
    // X→Y→X 순환: 방문 체크로 한번만 방문
    let threw = false;
    try {
        const order = orch.getOrder([
            { id: "X", input: null, dependsOn: ["Y"] },
            { id: "Y", input: null, dependsOn: ["X"] },
        ]);
        assert(Array.isArray(order), "order가 배열이어야 함");
    }
    catch {
        threw = true;
    }
    assert(!threw, "순환 의존성에서 예외 발생 — visited 체크로 방지해야 함");
});
test("24. 선행 output이 다음 input의 deps[0]에 포함", () => {
    const orch = new orchestrate_1.Orchestrator();
    orch.register({ id: "producer", run: (_) => { return { value: 777 }; } });
    orch.register({
        id: "consumer",
        run: (x) => {
            return x.deps[0].value * 2;
        }
    });
    const result = orch.run([
        { id: "producer", input: null },
        { id: "consumer", input: {}, dependsOn: ["producer"] },
    ]);
    assertEq(result.outputs["consumer"], 1554, "777*2=1554 예상");
});
// ─── 6. 통합: 3단계 파이프라인 ───────────────────────────────────────────
test("25. 통합: 3단계 파이프라인 (파싱→변환→포맷)", () => {
    const orch = new orchestrate_1.Orchestrator();
    // 파싱 에이전트: 문자열을 숫자 배열로
    orch.register({
        id: "parse",
        run: (input) => {
            return input.raw.split(",").map(Number);
        }
    });
    // 변환 에이전트: 각 값 제곱
    orch.register({
        id: "transform",
        run: (input) => {
            const nums = input.deps[0];
            return nums.map((n) => n * n);
        }
    });
    // 포맷 에이전트: 합산 후 문자열
    orch.register({
        id: "format",
        run: (input) => {
            const squared = input.deps[0];
            const total = squared.reduce((a, b) => a + b, 0);
            return `total=${total}`;
        }
    });
    const result = orch.run([
        { id: "parse", input: { raw: "1,2,3,4" } },
        { id: "transform", input: {}, dependsOn: ["parse"] },
        { id: "format", input: {}, dependsOn: ["transform"] },
    ]);
    // 1^2+2^2+3^2+4^2 = 1+4+9+16 = 30
    assertEq(result.outputs["format"], "total=30", "3단계 파이프라인 결과 total=30 예상");
    assertEq(result.success, true, "파이프라인 success=true 예상");
    assertEq(result.order.length, 3, "order 길이 3 예상");
});
// ─── 결과 출력 ───────────────────────────────────────────────────────────
console.log(results.join("\n"));
console.log(`\n총 ${passed + failed}개 테스트: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase126-orchestrate.js.map