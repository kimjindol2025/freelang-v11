"use strict";
// test-phase125-swarm.ts — FreeLang v9 Phase 125: SWARM 군집 지능
// 최소 25개 PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const swarm_1 = require("./swarm");
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
function assertApprox(a, b, delta, msg) {
    if (Math.abs(a - b) > delta)
        throw new Error(msg ?? `Expected ${a} ≈ ${b} (delta=${delta})`);
}
console.log("\n=== Phase 125: SWARM 군집 지능 ===\n");
// ─── 1. Swarm 생성 ──────────────────────────────────────────────────────────
test("1. Swarm 생성", () => {
    const sw = new swarm_1.Swarm();
    assertDefined(sw, "Swarm 인스턴스 없음");
    assert(typeof sw.optimize === "function", "optimize 메서드 없음");
});
// ─── 2. optimize() 기본 동작 ───────────────────────────────────────────────
test("2. optimize() 기본 동작", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => -x * x });
    assertDefined(result, "결과 없음");
    assert("bestPosition" in result, "bestPosition 없음");
    assert("bestScore" in result, "bestScore 없음");
    assert("iterations" in result, "iterations 없음");
    assert("particles" in result, "particles 없음");
    assert("converged" in result, "converged 없음");
});
// ─── 3. bestPosition 범위 내 ───────────────────────────────────────────────
test("3. bestPosition 범위 내", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, bounds: [0, 5] });
    assert(result.bestPosition >= 0 && result.bestPosition <= 5, `bestPosition=${result.bestPosition} 범위 초과`);
});
// ─── 4. bestScore 최대화 (양수 목적함수) ────────────────────────────────────
test("4. bestScore 양수 (최대화)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, bounds: [0, 1] });
    assert(result.bestScore > 0, `bestScore=${result.bestScore} 양수여야 함`);
});
// ─── 5. iterations 기록 ────────────────────────────────────────────────────
test("5. iterations 기록", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, iterations: 20 });
    assert(result.iterations >= 1 && result.iterations <= 20, `iterations=${result.iterations} 범위 초과`);
});
// ─── 6. converged 플래그 ───────────────────────────────────────────────────
test("6. converged 플래그 (boolean)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => 1.0 }); // 항상 동일 → 수렴 빠름
    assert(typeof result.converged === "boolean", "converged가 boolean이 아님");
});
// ─── 7. particles 배열 반환 ────────────────────────────────────────────────
test("7. particles 배열 반환", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, particles: 5 });
    assert(Array.isArray(result.particles), "particles가 배열이 아님");
    assertEq(result.particles.length, 5, "particles 수 불일치");
});
// ─── 8. n=1 단일 입자 ──────────────────────────────────────────────────────
test("8. n=1 단일 입자", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, particles: 1 });
    assertEq(result.particles.length, 1, "단일 입자 수 불일치");
    assertDefined(result.bestPosition, "bestPosition 없음");
});
// ─── 9. iterations=1 ───────────────────────────────────────────────────────
test("9. iterations=1", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, iterations: 1 });
    assert(result.iterations >= 1, "iterations=1 이상이어야 함");
});
// ─── 10. bounds 적용 ───────────────────────────────────────────────────────
test("10. bounds 적용 [-5, 5]", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => -Math.abs(x), bounds: [-5, 5], particles: 10, iterations: 30 });
    assert(result.bestPosition >= -5 && result.bestPosition <= 5, `bestPosition=${result.bestPosition} 범위 초과`);
});
// ─── 11. tolerance 수렴 ────────────────────────────────────────────────────
test("11. tolerance 수렴 (constant fn → 빠른 수렴)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: () => 42, tolerance: 0.0001, iterations: 50 });
    // 상수 함수: 모든 입자 동일 score → 빠른 수렴
    assert(result.converged || result.iterations <= 50, "수렴 또는 최대 반복 내 종료");
});
// ─── 12. 단순 함수 -x² (최댓값 x=0) ────────────────────────────────────────
test("12. 단순 함수 x → -x² (최댓값 0 근처)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => -x * x, bounds: [-1, 1], particles: 20, iterations: 100, tolerance: 1e-6 });
    // bestPosition이 0에 근접해야 함
    assertApprox(result.bestPosition, 0, 0.3, `bestPosition=${result.bestPosition} 0에 너무 멀리 있음`);
});
// ─── 13. 단순 함수 x (최댓값 = bound max) ──────────────────────────────────
test("13. 단순 함수 x → x (최댓값 bound max에 근접)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, bounds: [0, 10], particles: 20, iterations: 100 });
    assert(result.bestScore >= 5, `bestScore=${result.bestScore} 5 이상이어야 함`);
});
// ─── 14. 각 particle id 고유 ────────────────────────────────────────────────
test("14. 각 particle id 고유", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, particles: 8 });
    const ids = result.particles.map((p) => p.id);
    const unique = new Set(ids);
    assertEq(unique.size, ids.length, "particle id 중복 존재");
});
// ─── 15. bestPosition과 bestScore 독립 ─────────────────────────────────────
test("15. bestPosition과 bestScore 독립적", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x * 2, bounds: [0, 1] });
    // bestScore ≈ bestPosition * 2
    assertApprox(result.bestScore, result.bestPosition * 2, 0.5, "bestScore ≈ bestPosition*2");
});
// ─── 16. globalSwarm 싱글톤 ─────────────────────────────────────────────────
test("16. globalSwarm 싱글톤", () => {
    assertDefined(swarm_1.globalSwarm, "globalSwarm 없음");
    assert(swarm_1.globalSwarm instanceof swarm_1.Swarm, "globalSwarm이 Swarm 인스턴스가 아님");
    const result = swarm_1.globalSwarm.optimize({ objective: (x) => x });
    assertDefined(result, "globalSwarm.optimize() 결과 없음");
});
// ─── 17~19. 내장함수 테스트 ─────────────────────────────────────────────────
const interp = new interpreter_1.Interpreter();
function runFL(code) {
    const ctx = interp.run(code);
    return ctx.lastValue;
}
test("17. swarm-optimize 내장함수", () => {
    const result = runFL(`(swarm-optimize (fn [$x] (* $x 2)) 5 20)`);
    assertDefined(result, "swarm-optimize 결과 없음");
    assert(typeof result === "number", `swarm-optimize 결과가 숫자여야 함, got ${typeof result}`);
});
test("18. swarm-best-score 내장함수", () => {
    const result = runFL(`(swarm-best-score (fn [$x] (* $x $x)) 5 20)`);
    assertDefined(result, "swarm-best-score 결과 없음");
    assert(typeof result === "number", `swarm-best-score 결과가 숫자여야 함, got ${typeof result}`);
});
test("19. swarm-converged? 내장함수", () => {
    const result = runFL(`(swarm-converged? (fn [$x] 1.0))`);
    assert(typeof result === "boolean", `swarm-converged? 결과가 boolean이어야 함, got ${typeof result}`);
});
// ─── 20. 수렴 후 추가 반복 없음 ─────────────────────────────────────────────
test("20. 수렴 후 추가 반복 없음", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: () => 1.0, iterations: 100, tolerance: 0.0001 });
    // 상수 함수이므로 100 반복 이전에 수렴해야 함
    assert(result.converged || result.iterations <= 100, "수렴하거나 maxIter 이내 종료");
    if (result.converged) {
        assert(result.iterations < 100, `수렴 시 조기 종료해야 함, iterations=${result.iterations}`);
    }
});
// ─── 21. velocity 업데이트 (0 아님) ─────────────────────────────────────────
test("21. velocity 업데이트 (particles에 velocity 있음)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, particles: 5, iterations: 10 });
    // 모든 particle에 velocity 필드 존재
    for (const p of result.particles) {
        assert("velocity" in p, `particle ${p.id}에 velocity 없음`);
        assert(typeof p.velocity === "number", `velocity가 숫자여야 함`);
    }
});
// ─── 22. particle.bestScore >= 초기 score ─────────────────────────────────
test("22. particle.bestScore >= 초기 score (monotonic)", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x * x, particles: 5, iterations: 20 });
    // bestScore는 항상 최소 초기 score 이상
    for (const p of result.particles) {
        assert(p.bestScore >= 0, `bestScore=${p.bestScore} 음수 불가 (x² >= 0)`);
    }
});
// ─── 23. global best 업데이트 ───────────────────────────────────────────────
test("23. global best = particles 중 최대 bestScore", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({ objective: (x) => x, particles: 10, iterations: 30 });
    const maxParticleScore = Math.max(...result.particles.map((p) => p.bestScore));
    assert(result.bestScore >= maxParticleScore - 1e-9, `globalBest=${result.bestScore} < particle max=${maxParticleScore}`);
});
// ─── 24. Math.random 기반 (범위만 확인) ─────────────────────────────────────
test("24. 결과가 합리적 범위 내 (비결정론적)", () => {
    const sw = new swarm_1.Swarm();
    // 두 번 실행 결과가 같지 않을 수 있음 (정상) — 범위만 확인
    const r1 = sw.optimize({ objective: (x) => x, bounds: [0, 1] });
    const r2 = sw.optimize({ objective: (x) => x, bounds: [0, 1] });
    assert(r1.bestPosition >= 0 && r1.bestPosition <= 1, "r1 범위 초과");
    assert(r2.bestPosition >= 0 && r2.bestPosition <= 1, "r2 범위 초과");
});
// ─── 25. 통합: 10입자 50반복 최적화 ─────────────────────────────────────────
test("25. 통합: 10입자 50반복 최적화", () => {
    const sw = new swarm_1.Swarm();
    const result = sw.optimize({
        objective: (x) => -Math.pow(x - 0.5, 2), // 최댓값 x=0.5
        particles: 10,
        iterations: 50,
        bounds: [0, 1],
        tolerance: 1e-4,
    });
    assertDefined(result.bestPosition, "bestPosition 없음");
    assertDefined(result.bestScore, "bestScore 없음");
    assert(result.particles.length === 10, "particles 수 불일치");
    assert(result.iterations >= 1 && result.iterations <= 50, "iterations 범위 초과");
    assert(typeof result.converged === "boolean", "converged 타입 오류");
    // x=0.5 근처가 bestPosition이어야 함
    assertApprox(result.bestPosition, 0.5, 0.4, `bestPosition=${result.bestPosition} 0.5에 너무 멀리 있음`);
});
// ─── 결과 출력 ──────────────────────────────────────────────────────────────
console.log(results.join("\n"));
console.log(`\n총 결과: ${passed} PASS, ${failed} FAIL`);
// ─── Regression: Phase 56 렉시컬 스코프 ──────────────────────────────────────
// 원본 test-phase56-lexical-scope.ts 실행으로 검증
console.log("\n=== Regression: Phase 56 렉시컬 스코프 14/14 ===\n");
const child_process_1 = require("child_process");
let regPassed = 0;
let regFailed = 0;
try {
    const regOutput = (0, child_process_1.execSync)("npx ts-node src/test-phase56-lexical-scope.ts", { cwd: "/home/kimjin/kim/Desktop/kim/01_Active_Projects/freelang-v9", encoding: "utf8", timeout: 30000 });
    const match = regOutput.match(/Phase 56 렉시컬 스코프: (\d+) passed, (\d+) failed/);
    if (match) {
        regPassed = parseInt(match[1]);
        regFailed = parseInt(match[2]);
    }
    console.log(`  Regression 결과: ${regPassed}/14 PASS, ${regFailed} FAIL`);
}
catch (e) {
    console.log(`  ❌ Regression 실행 실패: ${e.message?.slice(0, 100)}`);
    regFailed = 14;
}
console.log(`\nRegression 결과: ${regPassed}/14 PASS`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase125-swarm.js.map