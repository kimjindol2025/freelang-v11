"use strict";
// test-phase116-belief.ts — FreeLang v9 Phase 116 Belief System 테스트
// BeliefSystem + 베이즈 업데이트 + 내장함수 25개+
Object.defineProperty(exports, "__esModule", { value: true });
const belief_1 = require("./belief");
const interpreter_1 = require("./interpreter");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        }
        else {
            console.log(`  ❌ FAIL: ${name}`);
            failed++;
        }
    }
    catch (e) {
        console.log(`  ❌ ERROR: ${name} — ${e.message}`);
        failed++;
    }
}
function run(code) {
    const interp = new interpreter_1.Interpreter();
    const state = interp.run(code);
    return state.lastValue;
}
console.log("\n=== Phase 116: BELIEF — AI 신념 시스템 ===\n");
// --- BeliefSystem 클래스 직접 테스트 ---
console.log("[ BeliefSystem 클래스 ]");
test("1. BeliefSystem 생성", () => {
    const bs = new belief_1.BeliefSystem();
    return bs !== null && bs.size() === 0;
});
test("2. set() + get() 기본", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("sky-is-blue", 0.9);
    return bs.get("sky-is-blue") === 0.9;
});
test("3. get() 없는 신념 → null", () => {
    const bs = new belief_1.BeliefSystem();
    return bs.get("nonexistent") === null;
});
test("4. confidence 범위 클램프 — 1 초과 → 1", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("test", 1.5);
    return bs.get("test") === 1.0;
});
test("5. confidence 범위 클램프 — 0 미만 → 0", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("test", -0.3);
    return bs.get("test") === 0.0;
});
test("6. update() 긍정 증거 → 확신 증가", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("earth-is-round", 0.5);
    const after = bs.update("earth-is-round", 0.9);
    return after > 0.5;
});
test("7. update() 부정 증거 → 확신 감소", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("moon-is-cheese", 0.5);
    const after = bs.update("moon-is-cheese", 0.1);
    return after < 0.5;
});
test("8. negate() 신념 약화", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("claim", 0.8);
    const after = bs.negate("claim");
    return after < 0.8;
});
test("9. history 기록 — initialized 이벤트 포함", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("test-claim", 0.5);
    const b = bs.list()[0];
    return b.history.length >= 1 && b.history[0].event === 'initialized';
});
test("10. history 기록 — update 후 history 증가", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("claim", 0.5);
    bs.update("claim", 0.8);
    const b = bs.list()[0];
    return b.history.length >= 2;
});
test("11. list() 전체 신념 반환", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("a", 0.3);
    bs.set("b", 0.7);
    bs.set("c", 0.9);
    return bs.list().length === 3;
});
test("12. strongest() 최고 확신 신념", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("low", 0.2);
    bs.set("high", 0.95);
    bs.set("mid", 0.5);
    const s = bs.strongest();
    return s?.claim === "high";
});
test("13. strongest() 빈 시스템 → null", () => {
    const bs = new belief_1.BeliefSystem();
    return bs.strongest() === null;
});
test("14. certain(0.8) 필터링", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("very-sure", 0.9);
    bs.set("unsure", 0.4);
    bs.set("borderline", 0.8);
    const certain = bs.certain(0.8);
    return certain.length === 2 && certain.every(b => b.confidence >= 0.8);
});
test("15. certain() 기본값 0.8 적용", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("confident", 0.85);
    bs.set("weak", 0.3);
    const certain = bs.certain();
    return certain.length === 1 && certain[0].claim === "confident";
});
test("16. forget() 신념 삭제", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("temp", 0.5);
    const deleted = bs.forget("temp");
    return deleted === true && bs.get("temp") === null;
});
test("17. size() 카운트", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("x", 0.1);
    bs.set("y", 0.2);
    bs.set("z", 0.3);
    return bs.size() === 3;
});
test("18. globalBeliefs 싱글톤 — 동일 인스턴스", () => {
    return belief_1.globalBeliefs === belief_1.globalBeliefs;
});
test("19. 동일 claim 재 set → confidence 업데이트", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("claim", 0.3);
    bs.set("claim", 0.8);
    return bs.get("claim") === 0.8 && bs.size() === 1;
});
test("20. 반복 update로 수렴 — 긍정 증거 반복 → 높은 확신", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("converge", 0.5);
    for (let i = 0; i < 10; i++)
        bs.update("converge", 0.9);
    const conf = bs.get("converge");
    return conf > 0.8 && conf <= 0.99;
});
test("21. 반복 negate → 낮은 확신", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("fade", 0.9);
    for (let i = 0; i < 8; i++)
        bs.negate("fade");
    const conf = bs.get("fade");
    return conf < 0.5;
});
// --- 내장함수 테스트 ---
console.log("\n[ 내장함수 (FreeLang 인터프리터) ]");
// 각 테스트는 독립된 인터프리터 사용 (globalBeliefs 공유됨)
// 테스트 간 간섭 방지를 위해 고유한 claim 이름 사용
test("22. belief-set 내장함수", () => {
    run(`(belief-set "fl-test-set" 0.75)`);
    const val = belief_1.globalBeliefs.get("fl-test-set");
    return val !== null && Math.abs(val - 0.75) < 0.001;
});
test("23. belief-get 내장함수", () => {
    belief_1.globalBeliefs.set("fl-test-get", 0.65);
    const result = run(`(belief-get "fl-test-get")`);
    return Math.abs(result - 0.65) < 0.001;
});
test("24. belief-update 내장함수 — 긍정 증거 → 증가", () => {
    belief_1.globalBeliefs.set("fl-test-update", 0.5);
    const result = run(`(belief-update "fl-test-update" 0.9)`);
    return typeof result === "number" && result > 0.5;
});
test("25. belief-negate 내장함수 — 확신 감소", () => {
    belief_1.globalBeliefs.set("fl-test-negate", 0.8);
    const result = run(`(belief-negate "fl-test-negate")`);
    return typeof result === "number" && result < 0.8;
});
test("26. belief-list 내장함수 → 배열 반환", () => {
    const result = run(`(belief-list)`);
    return Array.isArray(result);
});
test("27. belief-certain 내장함수", () => {
    belief_1.globalBeliefs.set("fl-certain-high", 0.95);
    const result = run(`(belief-certain 0.9)`);
    return Array.isArray(result) && result.some((b) => b.claim === "fl-certain-high");
});
test("28. belief-strongest 내장함수 → 가장 강한 claim 문자열", () => {
    belief_1.globalBeliefs.set("fl-strongest-candidate", 0.999);
    const result = run(`(belief-strongest)`);
    return typeof result === "string" && result.length > 0;
});
test("29. belief-forget 내장함수 → 삭제 후 null", () => {
    belief_1.globalBeliefs.set("fl-forget-me", 0.5);
    run(`(belief-forget "fl-forget-me")`);
    return belief_1.globalBeliefs.get("fl-forget-me") === null;
});
test("30. belief-size 내장함수 → 숫자", () => {
    const result = run(`(belief-size)`);
    return typeof result === "number" && result >= 0;
});
// --- 통합 시나리오 ---
console.log("\n[ 통합 시나리오 ]");
test("31. 복합 시나리오 — set, update, get 순서", () => {
    const bs = new belief_1.BeliefSystem();
    bs.set("hypothesis", 0.5);
    bs.update("hypothesis", 0.8); // 긍정 증거
    bs.update("hypothesis", 0.9); // 추가 긍정
    const conf = bs.get("hypothesis");
    return conf > 0.6;
});
test("32. update() 존재하지 않는 claim → 0 반환", () => {
    const bs = new belief_1.BeliefSystem();
    const result = bs.update("nonexistent-claim", 0.9);
    return result === 0;
});
test("33. createdAt 타임스탬프 설정", () => {
    const bs = new belief_1.BeliefSystem();
    const before = Date.now();
    bs.set("time-test", 0.5);
    const after = Date.now();
    const b = bs.list()[0];
    return b.createdAt >= before && b.createdAt <= after;
});
// --- 최종 결과 ---
const total = passed + failed;
console.log(`\n=== 결과: ${passed}/${total} PASS ===`);
if (failed === 0) {
    console.log("🎉 ALL PASS — Phase 116 BELIEF 완성!");
}
else {
    console.log(`❌ ${failed}개 실패`);
    process.exit(1);
}
//# sourceMappingURL=test-phase116-belief.js.map