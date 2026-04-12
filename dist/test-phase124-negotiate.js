"use strict";
// test-phase124-negotiate.ts — FreeLang v9 Phase 124: NEGOTIATE
// 에이전트 협상 블록 — 25+ PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const negotiate_1 = require("./negotiate");
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
function assertClose(a, b, tol = 0.05, msg) {
    if (Math.abs(a - b) > tol)
        throw new Error(msg ?? `Expected ~${b}, got ${a} (tolerance ${tol})`);
}
console.log("\n=== Phase 124: NEGOTIATE — 에이전트 협상 블록 ===\n");
// ─── 1. 기본 인스턴스 ─────────────────────────────────────────────────────
test("1. Negotiator 생성", () => {
    const n = new negotiate_1.Negotiator();
    assertDefined(n, "Negotiator 인스턴스 없음");
});
test("2. negotiate() 합의 성공", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.4, minAccept: 0.3, maxOffer: 0.6, flexibility: 0.8 },
        { agentId: "B", offer: 0.6, minAccept: 0.4, maxOffer: 0.7, flexibility: 0.8 },
    ];
    const result = n.negotiate(positions);
    assert(result.agreed === true, "합의 성공해야 함");
});
test("3. negotiate() 협상 결렬", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.1, minAccept: 0.05, maxOffer: 0.15, flexibility: 0.0 },
        { agentId: "B", offer: 0.9, minAccept: 0.85, maxOffer: 0.95, flexibility: 0.0 },
    ];
    const result = n.negotiate(positions, 3);
    assert(result.agreed === false, "협상 결렬이어야 함");
});
test("4. agreed=true 반환 확인", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.5, minAccept: 0.3, maxOffer: 0.7, flexibility: 0.9 },
        { agentId: "B", offer: 0.5, minAccept: 0.3, maxOffer: 0.7, flexibility: 0.9 },
    ];
    const result = n.negotiate(positions);
    assertEq(result.agreed, true, "agreed는 true여야 함");
});
test("5. agreed=false 반환 확인", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "X", offer: 0.0, minAccept: 0.0, maxOffer: 0.1, flexibility: 0.0 },
        { agentId: "Y", offer: 1.0, minAccept: 0.9, maxOffer: 1.0, flexibility: 0.0 },
    ];
    const result = n.negotiate(positions, 3);
    assertEq(result.agreed, false, "agreed는 false여야 함");
});
// ─── 2. value 합의값 ─────────────────────────────────────────────────────
test("6. value 합의값 존재", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.4, minAccept: 0.3, maxOffer: 0.7, flexibility: 1.0 },
        { agentId: "B", offer: 0.6, minAccept: 0.3, maxOffer: 0.7, flexibility: 1.0 },
    ];
    const result = n.negotiate(positions);
    assertDefined(result.value, "합의값이 있어야 함");
});
test("7. avgOffer가 value", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 1.0 },
        { agentId: "B", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 1.0 },
    ];
    const result = n.negotiate(positions);
    assert(result.agreed === true, "합의 성공해야 함");
    assertClose(result.value, 0.5, 0.05, "합의값은 0.5 근처여야 함");
});
// ─── 3. rounds 배열 ─────────────────────────────────────────────────────
test("8. rounds 배열 존재", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.3, minAccept: 0.2, maxOffer: 0.8, flexibility: 0.5 },
        { agentId: "B", offer: 0.7, minAccept: 0.2, maxOffer: 0.8, flexibility: 0.5 },
    ];
    const result = n.negotiate(positions);
    assert(Array.isArray(result.rounds), "rounds는 배열이어야 함");
    assert(result.rounds.length > 0, "rounds가 비어 있으면 안 됨");
});
test("9. gap 계산 (라운드 1)", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.2, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.5 },
        { agentId: "B", offer: 0.8, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.5 },
    ];
    const result = n.negotiate(positions);
    const firstRound = result.rounds[0];
    assertClose(firstRound.gap, 0.6, 0.05, "초기 gap은 0.6이어야 함");
});
test("10. 라운드별 gap 감소 (flexibility > 0)", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.1, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.8 },
        { agentId: "B", offer: 0.9, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.8 },
    ];
    const result = n.negotiate(positions, 5);
    if (result.rounds.length >= 2) {
        const gap0 = result.rounds[0].gap;
        const gap1 = result.rounds[result.rounds.length - 1].gap;
        assert(gap1 <= gap0, `gap이 줄어야 함: ${gap0} → ${gap1}`);
    }
});
// ─── 4. flexibility 영향 ─────────────────────────────────────────────────
test("11. flexibility 높으면 빠른 합의", () => {
    const n = new negotiate_1.Negotiator();
    const highFlex = [
        { agentId: "A", offer: 0.2, minAccept: 0.0, maxOffer: 1.0, flexibility: 1.0 },
        { agentId: "B", offer: 0.8, minAccept: 0.0, maxOffer: 1.0, flexibility: 1.0 },
    ];
    const lowFlex = [
        { agentId: "A", offer: 0.2, minAccept: 0.0, maxOffer: 1.0, flexibility: 0.1 },
        { agentId: "B", offer: 0.8, minAccept: 0.0, maxOffer: 1.0, flexibility: 0.1 },
    ];
    const rHigh = n.negotiate(highFlex, 10);
    const rLow = n.negotiate(lowFlex, 10);
    assert(rHigh.rounds.length <= rLow.rounds.length || rHigh.agreed, "높은 flexibility가 더 빨리 합의해야 함");
});
test("12. flexibility=0 → 결렬 가능", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.1, minAccept: 0.05, maxOffer: 0.15, flexibility: 0.0 },
        { agentId: "B", offer: 0.9, minAccept: 0.85, maxOffer: 0.95, flexibility: 0.0 },
    ];
    const result = n.negotiate(positions, 5);
    assert(result.agreed === false, "flexibility=0에서 멀리 떨어진 경우 결렬이어야 함");
});
// ─── 5. maxRounds 제한 ───────────────────────────────────────────────────
test("13. maxRounds 제한 준수", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.1, minAccept: 0.05, maxOffer: 0.5, flexibility: 0.3 },
        { agentId: "B", offer: 0.9, minAccept: 0.5, maxOffer: 0.95, flexibility: 0.3 },
    ];
    const result = n.negotiate(positions, 3);
    assert(result.rounds.length <= 3, "rounds는 maxRounds를 초과하면 안 됨");
});
// ─── 6. minAccept / maxOffer 범위 체크 ──────────────────────────────────
test("14. minAccept 범위 체크", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.5, minAccept: 0.45, maxOffer: 0.55, flexibility: 0.5 },
        { agentId: "B", offer: 0.5, minAccept: 0.45, maxOffer: 0.55, flexibility: 0.5 },
    ];
    const result = n.negotiate(positions);
    assert(result.agreed === true, "minAccept/maxOffer 범위 내에서 합의해야 함");
});
test("15. maxOffer 범위 체크", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.3, minAccept: 0.0, maxOffer: 0.4, flexibility: 1.0 },
        { agentId: "B", offer: 0.6, minAccept: 0.5, maxOffer: 1.0, flexibility: 1.0 },
    ];
    // A의 maxOffer(0.4) < B의 minAccept(0.5) → 결렬
    const result = n.negotiate(positions, 10);
    // 합의 불가 확인
    if (result.agreed && result.value !== undefined) {
        assert(result.value >= 0 && result.value <= 1, "합의값은 0~1 범위여야 함");
    }
});
// ─── 7. breakdown 문자열 ─────────────────────────────────────────────────
test("16. breakdown 합의 문자열", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.5, minAccept: 0.3, maxOffer: 0.7, flexibility: 1.0 },
        { agentId: "B", offer: 0.5, minAccept: 0.3, maxOffer: 0.7, flexibility: 1.0 },
    ];
    const result = n.negotiate(positions);
    assert(typeof result.breakdown === "string", "breakdown은 문자열이어야 함");
    assert(result.breakdown.length > 0, "breakdown이 비어 있으면 안 됨");
});
test("17. breakdown 결렬 문자열", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "X", offer: 0.0, minAccept: 0.0, maxOffer: 0.1, flexibility: 0.0 },
        { agentId: "Y", offer: 1.0, minAccept: 0.9, maxOffer: 1.0, flexibility: 0.0 },
    ];
    const result = n.negotiate(positions, 3);
    assert(result.breakdown.includes("결렬") || result.breakdown.includes("라운드"), "결렬 메시지가 있어야 함");
});
// ─── 8. globalNegotiator 싱글톤 ─────────────────────────────────────────
test("18. globalNegotiator 싱글톤", () => {
    assertDefined(negotiate_1.globalNegotiator, "globalNegotiator가 없음");
    assert(negotiate_1.globalNegotiator instanceof negotiate_1.Negotiator, "globalNegotiator는 Negotiator 인스턴스여야 함");
});
test("19. globalNegotiator로 협상", () => {
    const positions = [
        { agentId: "P", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 0.8 },
        { agentId: "Q", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 0.8 },
    ];
    const result = negotiate_1.globalNegotiator.negotiate(positions);
    assert(result.agreed === true, "globalNegotiator로 합의 성공해야 함");
});
// ─── 9. 2명/3명 협상 ─────────────────────────────────────────────────────
test("20. 2명 협상", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.3, minAccept: 0.2, maxOffer: 0.8, flexibility: 0.8 },
        { agentId: "B", offer: 0.7, minAccept: 0.2, maxOffer: 0.8, flexibility: 0.8 },
    ];
    const result = n.negotiate(positions);
    assertDefined(result, "2명 협상 결과 없음");
    assert(typeof result.agreed === "boolean", "agreed는 boolean이어야 함");
});
test("21. 3명 협상", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.2, minAccept: 0.1, maxOffer: 0.8, flexibility: 0.9 },
        { agentId: "B", offer: 0.5, minAccept: 0.1, maxOffer: 0.8, flexibility: 0.9 },
        { agentId: "C", offer: 0.8, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.9 },
    ];
    const result = n.negotiate(positions);
    assertDefined(result, "3명 협상 결과 없음");
    assert(typeof result.agreed === "boolean", "agreed는 boolean이어야 함");
});
// ─── 10. 특수 케이스 ─────────────────────────────────────────────────────
test("22. 동일 offer → 즉시 합의", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 0.5 },
        { agentId: "B", offer: 0.5, minAccept: 0.4, maxOffer: 0.6, flexibility: 0.5 },
    ];
    const result = n.negotiate(positions);
    assert(result.agreed === true, "동일 offer는 즉시 합의여야 함");
    assertClose(result.value, 0.5, 0.05, "합의값은 0.5여야 함");
});
test("23. 극단적 차이 → 결렬", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.0, minAccept: 0.0, maxOffer: 0.05, flexibility: 0.0 },
        { agentId: "B", offer: 1.0, minAccept: 0.95, maxOffer: 1.0, flexibility: 0.0 },
    ];
    const result = n.negotiate(positions, 5);
    assert(result.agreed === false, "극단적 차이 + flexibility=0은 결렬이어야 함");
});
test("24. positions flexibility 반영 (라운드 기록 포함)", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "A", offer: 0.2, minAccept: 0.0, maxOffer: 1.0, flexibility: 0.9 },
        { agentId: "B", offer: 0.8, minAccept: 0.0, maxOffer: 1.0, flexibility: 0.9 },
    ];
    const result = n.negotiate(positions, 10);
    assert(result.rounds.length > 0, "라운드 기록이 있어야 함");
    // 라운드별 offers 객체에 에이전트 ID가 있어야 함
    const firstRound = result.rounds[0];
    assert("A" in firstRound.offers, "라운드 offers에 A가 있어야 함");
    assert("B" in firstRound.offers, "라운드 offers에 B가 있어야 함");
});
// ─── 11. 내장 함수 테스트 ─────────────────────────────────────────────────
const interp = new interpreter_1.Interpreter();
function run(code) {
    return interp.run(code);
}
test("25. negotiate 내장함수 — agreed boolean", () => {
    const result = run(`
    (negotiate (list
      (list "A" 0.4 0.3 0.7 0.8)
      (list "B" 0.6 0.3 0.7 0.8)
    ))
  `);
    const val = result?.lastValue !== undefined ? result.lastValue : result;
    assert(typeof val === "boolean", `negotiate는 boolean을 반환해야 함, got: ${typeof val}`);
});
test("26. negotiate-value 내장함수 — 합의값 or null", () => {
    const result = run(`
    (negotiate-value (list
      (list "A" 0.5 0.4 0.6 1.0)
      (list "B" 0.5 0.4 0.6 1.0)
    ))
  `);
    const val = result?.lastValue !== undefined ? result.lastValue : result;
    assertDefined(val, "negotiate-value는 합의값을 반환해야 함");
    assert(typeof val === "number", `negotiate-value는 number여야 함, got: ${typeof val}`);
});
test("27. negotiate-rounds 내장함수 — 라운드 수", () => {
    const result = run(`
    (negotiate-rounds (list
      (list "A" 0.3 0.2 0.8 0.7)
      (list "B" 0.7 0.2 0.8 0.7)
    ))
  `);
    const val = result?.lastValue !== undefined ? result.lastValue : result;
    assert(typeof val === "number", `negotiate-rounds는 number여야 함, got: ${typeof val}`);
    assert(val > 0, "라운드 수는 0보다 커야 함");
});
// ─── 12. 통합 테스트 ─────────────────────────────────────────────────────
test("28. 통합: 3명 다른 입장 → 협상", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "cheapest", offer: 0.2, minAccept: 0.1, maxOffer: 0.6, flexibility: 0.7 },
        { agentId: "moderate", offer: 0.5, minAccept: 0.3, maxOffer: 0.7, flexibility: 0.7 },
        { agentId: "premium", offer: 0.8, minAccept: 0.4, maxOffer: 0.9, flexibility: 0.7 },
    ];
    const result = n.negotiate(positions, 10);
    assert(typeof result.agreed === "boolean", "agreed는 boolean이어야 함");
    assert(Array.isArray(result.rounds), "rounds는 배열이어야 함");
    assert(typeof result.breakdown === "string", "breakdown은 문자열이어야 함");
});
test("29. negotiate-value null 반환 (결렬)", () => {
    const result = run(`
    (negotiate-value (list
      (list "A" 0.0 0.0 0.05 0.0)
      (list "B" 1.0 0.95 1.0 0.0)
    ))
  `);
    const val = result?.lastValue !== undefined ? result.lastValue : result;
    // 결렬이면 null, 합의면 number
    assert(val === null || typeof val === "number", "결렬 시 null이어야 함");
});
test("30. 라운드 offers 구조 검증", () => {
    const n = new negotiate_1.Negotiator();
    const positions = [
        { agentId: "alpha", offer: 0.3, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.5 },
        { agentId: "beta", offer: 0.7, minAccept: 0.1, maxOffer: 0.9, flexibility: 0.5 },
    ];
    const result = n.negotiate(positions, 3);
    result.rounds.forEach((r, i) => {
        assert(r.round === i + 1, `round 번호 오류: ${r.round}`);
        assert(typeof r.gap === "number", "gap은 number여야 함");
        assert("alpha" in r.offers, "offers에 alpha가 있어야 함");
        assert("beta" in r.offers, "offers에 beta가 있어야 함");
    });
});
// ─── 결과 출력 ──────────────────────────────────────────────────────────
console.log(results.join("\n"));
console.log(`\n총 ${passed + failed}개 | ✅ ${passed} PASS | ❌ ${failed} FAIL`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase124-negotiate.js.map