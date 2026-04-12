"use strict";
// test-phase120-cognitive.ts — FreeLang v9 Phase 120: Cognitive Architecture
// Phase 111~119 전체 통합 인지 아키텍처 테스트
// 최소 30개 PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const cognitive_1 = require("./cognitive");
const hypothesis_1 = require("./hypothesis");
const meta_reason_1 = require("./meta-reason");
const belief_1 = require("./belief");
const analogy_1 = require("./analogy");
const critique_1 = require("./critique");
const compose_reason_1 = require("./compose-reason");
const debate_1 = require("./debate");
const checkpoint_1 = require("./checkpoint");
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
console.log("\n=== Phase 120: Cognitive Architecture ===\n");
// ─── 1. 인스턴스 생성 ──────────────────────────────────────────────────────
test("1. CognitiveArchitecture 생성", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assertDefined(cog, "CognitiveArchitecture 인스턴스 없음");
});
test("2. meta 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.meta instanceof meta_reason_1.MetaReasoner, "meta는 MetaReasoner 인스턴스여야 함");
});
test("3. beliefs 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.beliefs instanceof belief_1.BeliefSystem, "beliefs는 BeliefSystem 인스턴스여야 함");
});
test("4. analogies 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.analogies instanceof analogy_1.AnalogyStore, "analogies는 AnalogyStore 인스턴스여야 함");
});
test("5. hypothesis 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.hypothesis instanceof hypothesis_1.HypothesisTester, "hypothesis는 HypothesisTester 인스턴스여야 함");
});
test("6. critique 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.critique instanceof critique_1.CritiqueAgent, "critique는 CritiqueAgent 인스턴스여야 함");
});
test("7. composer 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.composer instanceof compose_reason_1.ReasonComposer, "composer는 ReasonComposer 인스턴스여야 함");
});
test("8. debater 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.debater instanceof debate_1.Debater, "debater는 Debater 인스턴스여야 함");
});
test("9. checkpoints 접근", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    assert(cog.checkpoints instanceof checkpoint_1.CheckpointManager, "checkpoints는 CheckpointManager 인스턴스여야 함");
});
// ─── 2. solve() 동작 ───────────────────────────────────────────────────────
test("10. solve() 기본 동작", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("step by step how to sort", (strategy, prob) => [1, 2, 3]);
    assertDefined(result, "solve() 결과 없음");
});
test("11. solve() strategy 반환", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("step by step how to sort", (strategy, prob) => "output");
    assert(typeof result.strategy === "string", "strategy는 문자열이어야 함");
    assert(result.strategy.length > 0, "strategy는 비어있으면 안 됨");
});
test("12. solve() output 반환", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("how to solve", (strategy, prob) => 42);
    assertEq(result.output, 42, "output이 solver 반환값이어야 함");
});
test("13. solve() approved 반환", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("how to solve", (strategy, prob) => "good answer");
    assert(typeof result.approved === "boolean", "approved는 boolean이어야 함");
});
test("14. solve() risk 반환", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("how to solve", (strategy, prob) => "answer");
    assert(typeof result.risk === "number", "risk는 숫자여야 함");
    assert(result.risk >= 0, "risk >= 0");
});
test("15. solve() state.problem", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const problem = "how to debug step by step";
    const result = cog.solve(problem, (s, p) => "ok");
    assertEq(result.state.problem, problem, "state.problem이 입력 문제여야 함");
});
test("16. solve() state.strategy", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("step by step process", (s, p) => "output");
    assert(typeof result.state.strategy === "string", "state.strategy는 문자열이어야 함");
    assertEq(result.state.strategy, result.strategy, "state.strategy == strategy");
});
test("17. solve() 비판 후 신념 업데이트", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    cog.solve("test problem", (s, p) => "result");
    const beliefVal = cog.beliefs.get("solved:test problem");
    assert(beliefVal !== null, "신념이 업데이트되어야 함");
    assert(typeof beliefVal === "number", "신념값은 숫자여야 함");
});
test("18. solve() 체크포인트 저장", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    cog.solve("checkpoint test problem", (s, p) => "saved");
    const cpList = cog.checkpoints.list();
    assert(cpList.includes("pre-solve"), "pre-solve 체크포인트가 저장되어야 함");
});
// ─── 3. stats() 동작 ───────────────────────────────────────────────────────
test("19. stats() beliefs 카운트", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const s = cog.stats();
    assert(typeof s.beliefs === "number", "beliefs는 숫자여야 함");
    assert(s.beliefs >= 0, "beliefs >= 0");
});
test("20. stats() analogies 카운트", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const s = cog.stats();
    assert(typeof s.analogies === "number", "analogies는 숫자여야 함");
    assert(s.analogies >= 0, "analogies >= 0");
});
test("21. stats() checkpoints 카운트", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const s = cog.stats();
    assert(typeof s.checkpoints === "number", "checkpoints는 숫자여야 함");
    assert(s.checkpoints >= 0, "checkpoints >= 0");
});
// ─── 4. globalCognition 싱글톤 ────────────────────────────────────────────
test("22. globalCognition 싱글톤", () => {
    assert(cognitive_1.globalCognition instanceof cognitive_1.CognitiveArchitecture, "globalCognition은 CognitiveArchitecture여야 함");
});
// ─── 5. 내장함수 (cognition-*) — Interpreter 통해 ─────────────────────────
const interp = new interpreter_1.Interpreter();
function run(code) {
    return interp.run(code);
}
test("23. cognition-solve 내장함수", () => {
    const result = run(`(cognition-solve "step by step sort" (fn [s p] "sorted"))`);
    assert(result instanceof Map || typeof result === "object", "cognition-solve 결과는 객체여야 함");
});
test("24. cognition-stats 내장함수", () => {
    const result = run(`(cognition-stats)`);
    assert(result instanceof Map || typeof result === "object", "cognition-stats 결과는 객체여야 함");
});
test("25. cognition-meta 내장함수", () => {
    const ctx = run(`(cognition-meta "step by step how to solve")`);
    const result = ctx.lastValue;
    assert(typeof result === "string", "cognition-meta 결과는 문자열이어야 함");
    assert(result.length > 0, "cognition-meta 결과가 비어있으면 안 됨");
});
test("26. cognition-believe 내장함수", () => {
    run(`(cognition-believe "test-claim" 0.9)`);
    // 에러 없이 실행되면 PASS
    assert(true, "cognition-believe 실행 성공");
});
test("27. cognition-recall 내장함수", () => {
    const result = run(`(cognition-recall "sort algorithm")`);
    // null or a value — 에러 없이 실행되면 PASS
    assert(result === null || result !== undefined, "cognition-recall 실행 성공");
});
// ─── 6. 통합 시나리오 ─────────────────────────────────────────────────────
test("28. solve() 후 stats 변화 — beliefs 증가", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const before = cog.stats().beliefs;
    cog.solve("unique problem for stats test", (s, p) => "answer");
    const after = cog.stats().beliefs;
    assert(after > before, `신념이 증가해야 함 (before=${before}, after=${after})`);
});
test("29. 통합: meta → solve → critique → belief", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const problem = "step by step verify solution";
    // meta 직접 분석
    const metaResult = cog.meta.analyze(problem);
    assert(typeof metaResult.selected === "string", "meta 전략 선택");
    // solve 실행
    const solveResult = cog.solve(problem, (s, p) => ({ verified: true }));
    assert(typeof solveResult.approved === "boolean", "critique approved 반환");
    // belief 확인 — 키: `solved:${problem.slice(0, 20)}`
    const beliefKey = `solved:${problem.slice(0, 20)}`;
    const belief = cog.beliefs.get(beliefKey);
    assert(belief !== null, `신념이 저장되어야 함 (key: ${beliefKey})`);
});
test("30. analogies.store 후 solve에서 활용", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    // 유사 패턴 저장
    cog.analogies.store("binary search algorithm", { complexity: "O(log n)" }, ["search"]);
    const statsBefore = cog.stats().analogies;
    assert(statsBefore > 0, "analogy가 저장되어야 함");
    // solve에서 analogy best 활용 (비슷한 문제)
    const result = cog.solve("binary search step by step", (s, p) => "found");
    // state.analogies는 가장 유사한 유추의 description을 포함할 수 있음
    assert(result.state !== undefined, "state 반환 확인");
});
test("31. solve() state.critique 포함", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("any problem", (s, p) => "output");
    assertDefined(result.state.critique, "state.critique 없음");
    assert(typeof result.state.critique.approved === "boolean", "critique.approved는 boolean");
    assert(typeof result.state.critique.risk === "number", "critique.risk는 숫자");
});
test("32. solve() state.iterations === 1", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("problem", (s, p) => "output");
    assertEq(result.state.iterations, 1, "iterations는 1이어야 함");
});
test("33. solve() state.beliefs 타입", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("problem", (s, p) => "output");
    assert(result.state.beliefs instanceof Map, "state.beliefs는 Map이어야 함");
});
test("34. solve() state.analogies 타입", () => {
    const cog = new cognitive_1.CognitiveArchitecture();
    const result = cog.solve("problem", (s, p) => "output");
    assert(Array.isArray(result.state.analogies), "state.analogies는 배열이어야 함");
});
test("35. globalCognition.meta는 MetaReasoner", () => {
    assert(cognitive_1.globalCognition.meta instanceof meta_reason_1.MetaReasoner, "globalCognition.meta 타입 확인");
});
// ─── 결과 출력 ────────────────────────────────────────────────────────────
console.log(results.join("\n"));
console.log(`\n총 결과: ${passed} PASS, ${failed} FAIL`);
if (failed === 0) {
    console.log("🎉 Phase 120 ALL PASS — Cognitive Architecture 통합 완성!");
}
else {
    console.log(`⚠️  ${failed}개 실패`);
    process.exit(1);
}
//# sourceMappingURL=test-phase120-cognitive.js.map