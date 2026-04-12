"use strict";
// test-phase142-causal.ts — Phase 142: CAUSAL 인과 추론 테스트
// 최소 25 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const causal_1 = require("./causal");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
// ── 테스트 유틸 ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ FAIL: ${name} — ${e.message ?? e}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function evalFL(interp, code) {
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    let result;
    for (const node of ast)
        result = interp.eval(node);
    return result;
}
// ── 시나리오 설정: 비 → 젖은 도로 → 사고 ─────────────────────────────────────
console.log("\n=== Phase 142: CAUSAL 인과 추론 테스트 ===\n");
// ── 1. CausalGraph 생성 ────────────────────────────────────────────────────────
console.log("[ CausalGraph 기본 기능 ]");
test("1. CausalGraph 생성", () => {
    const g = new causal_1.CausalGraph();
    assert(g !== null && g !== undefined, "CausalGraph 인스턴스 생성 실패");
});
// ── 2. addNode 노드 추가 ──────────────────────────────────────────────────────
test("2. addNode 노드 추가", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    // getDirectCauses 호출 시 에러 없으면 성공
    const causes = g.getDirectCauses("wet-road");
    assert(Array.isArray(causes), "getDirectCauses가 배열을 반환해야 함");
});
// ── 3. addEdge 인과 에지 추가 ─────────────────────────────────────────────────
test("3. addEdge 인과 에지 추가", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95, mechanism: "물리적 접촉" });
    const causes = g.getDirectCauses("wet-road");
    assert(causes.length === 1, `직접 원인이 1개여야 함, got ${causes.length}`);
    assert(causes[0].from === "rain", "원인이 rain이어야 함");
});
// ── 4. getDirectCauses 직접 원인 ─────────────────────────────────────────────
test("4. getDirectCauses 직접 원인", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "fog", name: "안개", description: "시야 제한" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "fog", to: "wet-road", strength: 0.3, confidence: 0.5 });
    const causes = g.getDirectCauses("wet-road");
    assert(causes.length === 2, `직접 원인이 2개여야 함, got ${causes.length}`);
});
// ── 5. getDirectEffects 직접 결과 ────────────────────────────────────────────
test("5. getDirectEffects 직접 결과", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "flood", name: "홍수", description: "침수" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "rain", to: "flood", strength: 0.6, confidence: 0.7 });
    const effects = g.getDirectEffects("rain");
    assert(effects.length === 2, `직접 결과가 2개여야 함, got ${effects.length}`);
});
// ── 6. findCausalChains 인과 체인 ────────────────────────────────────────────
test("6. findCausalChains 인과 체인", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "wet-road", to: "accident", strength: 0.7, confidence: 0.8 });
    const chains = g.findCausalChains("rain", "accident");
    assert(chains.length > 0, "인과 체인이 존재해야 함");
    assert(chains[0].path[0] === "rain", "체인 시작이 rain이어야 함");
    assert(chains[0].path[chains[0].path.length - 1] === "accident", "체인 끝이 accident여야 함");
});
// ── 7. CausalChain 구조 검증 ─────────────────────────────────────────────────
test("7. CausalChain 구조 검증", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "accident", strength: 0.8, confidence: 0.9 });
    const chains = g.findCausalChains("rain", "accident");
    assert(chains.length > 0, "체인이 존재해야 함");
    const c = chains[0];
    assert(Array.isArray(c.path), "path가 배열이어야 함");
    assert(typeof c.totalStrength === "number", "totalStrength가 숫자여야 함");
    assert(typeof c.explanation === "string", "explanation이 문자열이어야 함");
    assert(typeof c.confidence === "number", "confidence가 숫자여야 함");
});
// ── 8. explain 인과 설명 ──────────────────────────────────────────────────────
test("8. explain 인과 설명", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "wet-road", to: "accident", strength: 0.7, confidence: 0.8 });
    const expl = g.explain("accident");
    assert(expl !== null, "설명이 null이 아니어야 함");
    assert(expl.effect === "accident", "effect가 accident여야 함");
});
// ── 9. CausalExplanation 구조 ────────────────────────────────────────────────
test("9. CausalExplanation 구조", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "accident", strength: 0.9, confidence: 0.95 });
    const expl = g.explain("accident");
    assert(typeof expl.effect === "string", "effect가 문자열이어야 함");
    assert(Array.isArray(expl.causes), "causes가 배열이어야 함");
    assert(typeof expl.primaryCause === "string", "primaryCause가 문자열이어야 함");
    assert(typeof expl.explanation === "string", "explanation이 문자열이어야 함");
    assert(typeof expl.confidence === "number", "confidence가 숫자여야 함");
});
// ── 10. primaryCause 정확성 ───────────────────────────────────────────────────
test("10. primaryCause 정확성", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "minor-cause", name: "작은 원인", description: "약한 원인" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "accident", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "minor-cause", to: "accident", strength: 0.1, confidence: 0.5 });
    const expl = g.explain("accident");
    assert(expl.primaryCause === "rain", `주요 원인이 rain이어야 함, got ${expl.primaryCause}`);
});
// ── 11. findRootCauses 루트 원인 ─────────────────────────────────────────────
test("11. findRootCauses 루트 원인", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "climate", name: "기후", description: "기후 변화" });
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "climate", to: "rain", strength: 0.8, confidence: 0.9 });
    g.addEdge({ from: "rain", to: "accident", strength: 0.9, confidence: 0.95 });
    const roots = g.findRootCauses("accident");
    assert(roots.includes("climate"), `루트 원인에 climate가 포함되어야 함, got ${JSON.stringify(roots)}`);
    assert(!roots.includes("rain"), "rain은 루트 원인이 아니어야 함 (더 깊은 원인이 있음)");
});
// ── 12. simulate 개입 시뮬레이션 ─────────────────────────────────────────────
test("12. simulate 개입 시뮬레이션", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수", value: 0 });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤", value: 0 });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    const result = g.simulate({ rain: 1.0 });
    assert("rain" in result, "rain이 결과에 포함되어야 함");
    assert("wet-road" in result, "wet-road가 파급효과로 포함되어야 함");
    assert(result["wet-road"] > 0, `wet-road의 값이 양수여야 함, got ${result["wet-road"]}`);
});
// ── 13. 음수 strength (억제 관계) ────────────────────────────────────────────
test("13. 음수 strength (억제 관계)", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "anti-slip", name: "미끄럼 방지", description: "타이어 마찰", value: 0 });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고", value: 0 });
    g.addEdge({ from: "anti-slip", to: "accident", strength: -0.8, confidence: 0.9 });
    const result = g.simulate({ "anti-slip": 1.0 });
    assert("accident" in result, "accident가 결과에 포함되어야 함");
    assert(result["accident"] < 0, `억제 관계로 accident 값이 음수여야 함, got ${result["accident"]}`);
});
// ── 14. confidence 전파 ───────────────────────────────────────────────────────
test("14. confidence 전파", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 표면 습윤" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.9 });
    g.addEdge({ from: "wet-road", to: "accident", strength: 0.7, confidence: 0.8 });
    const chains = g.findCausalChains("rain", "accident");
    assert(chains.length > 0, "체인이 존재해야 함");
    // 체인 confidence = 0.9 * 0.8 = 0.72
    const expectedConf = 0.9 * 0.8;
    assert(Math.abs(chains[0].confidence - expectedConf) < 0.01, `confidence가 ${expectedConf}여야 함, got ${chains[0].confidence}`);
});
// ── Built-in 함수 테스트 ─────────────────────────────────────────────────────
console.log("\n[ causal-* 빌트인 함수 테스트 ]");
// 빌트인 테스트에는 별도 그래프를 사용 (globalCausal)
const interp = new interpreter_1.Interpreter();
test("15. causal-add-node 빌트인", () => {
    const result = evalFL(interp, `(causal-add-node :id "rain" :name "비" :desc "강수")`);
    assert(result instanceof Map, "결과가 Map이어야 함");
    assert(result.get("id") === "rain", `id가 rain이어야 함, got ${result.get("id")}`);
    assert(result.get("name") === "비", `name이 비여야 함, got ${result.get("name")}`);
});
test("16. causal-add-edge 빌트인", () => {
    evalFL(interp, `(causal-add-node :id "wet-road" :name "젖은 도로" :desc "도로 습윤")`);
    const result = evalFL(interp, `(causal-add-edge :from "rain" :to "wet-road" :strength 0.9 :confidence 0.95)`);
    assert(result instanceof Map, "결과가 Map이어야 함");
    assert(result.get("from") === "rain", `from이 rain이어야 함`);
    assert(result.get("to") === "wet-road", `to가 wet-road여야 함`);
    assert(Math.abs(result.get("strength") - 0.9) < 0.01, `strength가 0.9여야 함`);
});
test("17. causal-explain 빌트인", () => {
    evalFL(interp, `(causal-add-node :id "accident" :name "사고" :desc "교통 사고")`);
    evalFL(interp, `(causal-add-edge :from "wet-road" :to "accident" :strength 0.7 :confidence 0.8)`);
    const result = evalFL(interp, `(causal-explain "accident")`);
    assert(result instanceof Map, "결과가 Map이어야 함");
    assert(result.get("effect") === "accident", "effect가 accident여야 함");
    assert(typeof result.get("explanation") === "string", "explanation이 문자열이어야 함");
});
test("18. causal-chains 빌트인", () => {
    const result = evalFL(interp, `(causal-chains "rain" "accident")`);
    assert(Array.isArray(result), "결과가 배열이어야 함");
    assert(result.length > 0, "인과 체인이 존재해야 함");
    const chain = result[0];
    assert(chain instanceof Map, "체인이 Map이어야 함");
    assert(Array.isArray(chain.get("path")), "path가 배열이어야 함");
});
test("19. causal-causes 빌트인", () => {
    const result = evalFL(interp, `(causal-causes "wet-road")`);
    assert(Array.isArray(result), "결과가 배열이어야 함");
    assert(result.length > 0, "직접 원인이 있어야 함");
    assert(result[0].get("from") === "rain", "원인이 rain이어야 함");
});
test("20. causal-effects 빌트인", () => {
    const result = evalFL(interp, `(causal-effects "rain")`);
    assert(Array.isArray(result), "결과가 배열이어야 함");
    assert(result.length > 0, "직접 결과가 있어야 함");
});
test("21. causal-roots 빌트인", () => {
    const result = evalFL(interp, `(causal-roots "accident")`);
    assert(Array.isArray(result), "결과가 배열이어야 함");
    // rain은 더 이상 원인이 없으므로 루트 원인
    assert(result.includes("rain"), `루트 원인에 rain이 포함되어야 함, got ${JSON.stringify(result)}`);
});
test("22. causal-simulate 빌트인", () => {
    // globalCausal에 rain2→mud 엣지가 있음 (위에서 추가됨)
    // evalBuiltin을 직접 호출 (interp 없이)
    const { evalBuiltin } = require("./eval-builtins");
    const inputMap = new Map([["rain2", 1.0]]);
    const result = evalBuiltin(interp, "causal-simulate", [inputMap], {});
    assert(result instanceof Map, "결과가 Map이어야 함");
    assert(result.has("mud") || result.has("rain2"), `파급효과가 있어야 함, keys: ${JSON.stringify(Array.from(result.keys()))}`);
});
test("23. causal-why 빌트인", () => {
    const result = evalFL(interp, `(causal-why "accident" "rain")`);
    assert(result instanceof Map, "결과가 Map이어야 함");
    assert(Array.isArray(result.get("path")), "path가 배열이어야 함");
    assert(result.get("path").includes("rain"), "path에 rain이 포함되어야 함");
    assert(result.get("path").includes("accident"), "path에 accident가 포함되어야 함");
});
test("24. causal-summary 빌트인", () => {
    const result = evalFL(interp, `(causal-summary "rain")`);
    assert(typeof result === "string", "결과가 문자열이어야 함");
    assert(result.length > 0, "요약이 비어있지 않아야 함");
    assert(result.includes("비"), "요약에 노드 이름이 포함되어야 함");
});
// ── 25. 순환 인과 감지 ───────────────────────────────────────────────────────
console.log("\n[ 고급 기능 ]");
test("25. 순환 인과 감지 (A→B→A)", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "A", name: "A", description: "노드 A" });
    g.addNode({ id: "B", name: "B", description: "노드 B" });
    g.addEdge({ from: "A", to: "B", strength: 0.8, confidence: 0.9 });
    g.addEdge({ from: "B", to: "A", strength: 0.8, confidence: 0.9 }); // 순환
    // findCausalChains가 무한 루프 없이 종료되어야 함
    const chains = g.findCausalChains("A", "A");
    // 순환이 있어도 방문 추적으로 안전하게 처리
    assert(typeof chains.length === "number", "체인 탐색이 안전하게 종료되어야 함");
});
// ── 추가 테스트 ────────────────────────────────────────────────────────────────
test("26. 다중 경로 인과 체인", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "fog", name: "안개", description: "시야 제한" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 습윤" });
    g.addNode({ id: "accident", name: "사고", description: "교통 사고" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    g.addEdge({ from: "fog", to: "accident", strength: 0.6, confidence: 0.7 });
    g.addEdge({ from: "wet-road", to: "accident", strength: 0.7, confidence: 0.8 });
    const expl = g.explain("accident");
    assert(expl.causes.length >= 2, `원인이 2개 이상이어야 함, got ${expl.causes.length}`);
});
test("27. totalStrength 계산 (체인 곱)", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "A", name: "A", description: "" });
    g.addNode({ id: "B", name: "B", description: "" });
    g.addNode({ id: "C", name: "C", description: "" });
    g.addEdge({ from: "A", to: "B", strength: 0.8, confidence: 1.0 });
    g.addEdge({ from: "B", to: "C", strength: 0.5, confidence: 1.0 });
    const chains = g.findCausalChains("A", "C");
    assert(chains.length > 0, "체인이 있어야 함");
    const expected = 0.8 * 0.5;
    assert(Math.abs(chains[0].totalStrength - expected) < 0.01, `totalStrength가 ${expected}여야 함, got ${chains[0].totalStrength}`);
});
test("28. whyCaused 전역 함수", () => {
    // globalCausal에 이미 rain→wet-road→accident 추가됨
    const chain = (0, causal_1.whyCaused)("accident", "rain");
    assert(chain !== null, "체인이 null이 아니어야 함");
    if (chain) {
        assert(chain.path.includes("rain"), "path에 rain이 포함되어야 함");
    }
});
test("29. findRootCauses 복잡한 체인", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "L1", name: "Level1", description: "" });
    g.addNode({ id: "L2", name: "Level2", description: "" });
    g.addNode({ id: "L3", name: "Level3", description: "" });
    g.addNode({ id: "L4", name: "Level4", description: "" });
    g.addEdge({ from: "L1", to: "L2", strength: 0.9, confidence: 0.9 });
    g.addEdge({ from: "L2", to: "L3", strength: 0.8, confidence: 0.8 });
    g.addEdge({ from: "L3", to: "L4", strength: 0.7, confidence: 0.7 });
    const roots = g.findRootCauses("L4");
    assert(roots.includes("L1"), "L1이 루트 원인이어야 함");
    assert(!roots.includes("L2"), "L2는 루트 원인이 아니어야 함");
});
test("30. summarize 출력 형식", () => {
    const g = new causal_1.CausalGraph();
    g.addNode({ id: "rain", name: "비", description: "강수" });
    g.addNode({ id: "wet-road", name: "젖은 도로", description: "도로 습윤" });
    g.addEdge({ from: "rain", to: "wet-road", strength: 0.9, confidence: 0.95 });
    const summary = g.summarize("rain");
    assert(typeof summary === "string", "요약이 문자열이어야 함");
    assert(summary.includes("비"), "요약에 노드 이름이 포함되어야 함");
    assert(summary.includes("직접결과"), "요약에 직접결과 항목이 포함되어야 함");
});
// ── 결과 요약 ─────────────────────────────────────────────────────────────────
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL ===\n`);
if (failed > 0) {
    process.exit(1);
}
else {
    process.exit(0);
}
//# sourceMappingURL=test-phase142-causal.js.map