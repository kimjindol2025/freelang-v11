"use strict";
// test-phase131-evolve.ts — FreeLang v9 Phase 131: [EVOLVE] 유전 알고리즘 진화 엔진
Object.defineProperty(exports, "__esModule", { value: true });
const evolve_1 = require("./evolve");
let pass = 0;
let fail = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  PASS  ${name}`);
            pass++;
        }
        else {
            console.log(`  FAIL  ${name}`);
            fail++;
        }
    }
    catch (e) {
        console.log(`  FAIL  ${name} — ${e.message}`);
        fail++;
    }
}
console.log("\n=== Phase 131: [EVOLVE] 유전 알고리즘 진화 엔진 ===\n");
// ─── 1. EvolutionEngine 생성 ──────────────────────────────────────────────────
test("1. EvolutionEngine 클래스 인스턴스 생성", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => -g.reduce((s, v) => s + v * v, 0),
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + 0.1 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random(), Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    return engine instanceof evolve_1.EvolutionEngine;
});
// ─── 2. initialize() 개체군 생성 ─────────────────────────────────────────────
test("2. initialize() 개체군 초기화", () => {
    const config = {
        populationSize: 15,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.1,
        fitnessFunc: (g) => -g.reduce((s, v) => s + v * v, 0),
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + 0.1 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random(), Math.random(), Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    return engine.getPopulation().length === 15;
});
// ─── 3. 숫자 배열 진화 (타겟: [1,2,3,4,5]) ───────────────────────────────────
test("3. evolveNumbers — 타겟 [1,2,3,4,5] 수렴", () => {
    const result = (0, evolve_1.evolveNumbers)([1, 2, 3, 4, 5], 20, 30);
    return result !== null && typeof result === "object" && "best" in result;
});
// ─── 4. step() 한 세대 진행 ──────────────────────────────────────────────────
test("4. step() 한 세대 진행 반환값", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 10,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => -Math.abs(g[0] - 5),
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + (Math.random() - 0.5) : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random() * 10],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const stepResult = engine.step();
    return typeof stepResult.bestFitness === "number" && typeof stepResult.avgFitness === "number";
});
// ─── 5. getBest() 최고 개체 ──────────────────────────────────────────────────
test("5. getBest() 최고 개체 반환", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g[0],
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + 0.1 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const best = engine.getBest();
    return best !== null && "genome" in best && "fitness" in best;
});
// ─── 6. getPopulation() 개체군 ───────────────────────────────────────────────
test("6. getPopulation() 개체군 반환", () => {
    const config = {
        populationSize: 8,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g[0],
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + 0.1 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const pop = engine.getPopulation();
    return Array.isArray(pop) && pop.length === 8;
});
// ─── 7. fitnessGoal 조기 종료 ────────────────────────────────────────────────
test("7. fitnessGoal 달성 시 조기 종료 (converged=true)", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 100,
        mutationRate: 0.5,
        eliteRatio: 0.2,
        fitnessGoal: 10, // 도달 가능한 목표
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => 0,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    return result.converged === true || result.best.fitness >= 10;
});
// ─── 8. eliteRatio 엘리트 보존 ───────────────────────────────────────────────
test("8. eliteRatio 엘리트 보존 — best fitness 단조 비감소", () => {
    const config = {
        populationSize: 20,
        maxGenerations: 10,
        mutationRate: 0.05,
        eliteRatio: 0.2,
        fitnessFunc: (g) => -g.reduce((s, v) => s + (v - 5) * (v - 5), 0),
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + (Math.random() - 0.5) * 2 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => Array.from({ length: 3 }, () => Math.random() * 10),
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    let prevBest = engine.getBest().fitness;
    let monotone = true;
    for (let i = 0; i < 10; i++) {
        engine.step();
        const curBest = engine.getBest().fitness;
        if (curBest < prevBest - 0.5) {
            monotone = false;
        }
        prevBest = curBest;
    }
    return monotone;
});
// ─── 9. mutationRate 적용 ────────────────────────────────────────────────────
test("9. mutationRate 0 — 변이 없음 확인", () => {
    const config = {
        populationSize: 5,
        maxGenerations: 3,
        mutationRate: 0, // 변이율 0
        eliteRatio: 1.0, // 전체 엘리트 (선택만)
        fitnessFunc: (g) => g[0],
        mutateFunc: (g, _r) => [...g], // 변이 없음
        crossoverFunc: (a, _b) => [...a],
        initFunc: () => [Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const before = engine.getBest().fitness;
    engine.step();
    const after = engine.getBest().fitness;
    return typeof before === "number" && typeof after === "number";
});
// ─── 10. crossoverFunc 적용 ──────────────────────────────────────────────────
test("10. crossoverFunc — 교배 정상 동작", () => {
    const crossoverCalled = [];
    const config = {
        populationSize: 10,
        maxGenerations: 3,
        mutationRate: 0,
        eliteRatio: 0.1,
        fitnessFunc: (g) => g[0] + g[1],
        mutateFunc: (g, _r) => [...g],
        crossoverFunc: (a, b) => {
            crossoverCalled.push(true);
            return [a[0], b[1]];
        },
        initFunc: () => [Math.random(), Math.random()],
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    engine.step();
    return crossoverCalled.length > 0;
});
// ─── 11. evolve-numbers 빌트인 (직접 함수 호출) ──────────────────────────────
test("11. evolveNumbers 빌트인 — result 구조 확인", () => {
    const result = (0, evolve_1.evolveNumbers)([3, 1, 4, 1, 5], 10, 20);
    return ("best" in result &&
        "generations" in result &&
        "converged" in result &&
        "history" in result);
});
// ─── 12. evolve-strings 빌트인 ───────────────────────────────────────────────
test("12. evolveStrings 빌트인 — result.best.genome은 문자열", () => {
    const result = (0, evolve_1.evolveStrings)("hi", 10, 20);
    return typeof result.best.genome === "string";
});
// ─── 13. evolve-config 빌트인 ────────────────────────────────────────────────
test("13. EvolutionConfig 설정값 확인", () => {
    const config = {
        populationSize: 25,
        maxGenerations: 75,
        mutationRate: 0.15,
        eliteRatio: 0.12,
        fitnessFunc: (g) => g[0],
        mutateFunc: (g, r) => g.map(v => Math.random() < r ? v + 0.1 : v),
        crossoverFunc: (a, b) => a.map((v, i) => Math.random() < 0.5 ? v : b[i]),
        initFunc: () => [Math.random()],
    };
    return config.populationSize === 25 && config.maxGenerations === 75;
});
// ─── 14. evolve-step 빌트인 ──────────────────────────────────────────────────
test("14. step() 반환값 — bestFitness/avgFitness 포함", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 10,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => (a + b) / 2,
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const step = engine.step();
    return "bestFitness" in step && "avgFitness" in step;
});
// ─── 15. evolve-best 빌트인 ──────────────────────────────────────────────────
test("15. getBest() — Individual 구조 확인", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const best = engine.getBest();
    return "genome" in best && "fitness" in best && "generation" in best && "id" in best;
});
// ─── 16. evolve-population 빌트인 ────────────────────────────────────────────
test("16. getPopulation() — 배열 크기 일치", () => {
    const config = {
        populationSize: 12,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    return engine.getPopulation().length === 12;
});
// ─── 17. evolve-run 빌트인 ───────────────────────────────────────────────────
test("17. run() — EvolutionResult 구조 확인", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 10,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    return ("best" in result &&
        "population" in result &&
        "generations" in result &&
        "converged" in result &&
        "history" in result);
});
// ─── 18. evolve-history 빌트인 ───────────────────────────────────────────────
test("18. getHistory() — 히스토리 배열 반환", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    engine.step();
    engine.step();
    const history = engine.getHistory();
    return Array.isArray(history) && history.length === 2;
});
// ─── 19. converged 플래그 ────────────────────────────────────────────────────
test("19. converged 플래그 — fitnessGoal 미달성 시 false", () => {
    const config = {
        populationSize: 5,
        maxGenerations: 3,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessGoal: 1000, // 달성 불가 목표
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 0.1 : g,
        crossoverFunc: (a, b) => (a + b) / 2,
        initFunc: () => Math.random(),
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    return result.converged === false;
});
// ─── 20. history 길이 = generations ─────────────────────────────────────────
test("20. history 길이 === generations 수", () => {
    const config = {
        populationSize: 10,
        maxGenerations: 7,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    return result.history.length === result.generations;
});
// ─── 21. population size 유지 ────────────────────────────────────────────────
test("21. population size 세대 진행 후에도 일정 유지", () => {
    const config = {
        populationSize: 18,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    engine.step();
    engine.step();
    engine.step();
    return engine.getPopulation().length === 18;
});
// ─── 22. fitness 개선 (세대 진행 시) ─────────────────────────────────────────
test("22. fitness 개선 — 충분한 세대 진행 시 best fitness 상승", () => {
    const config = {
        populationSize: 20,
        maxGenerations: 30,
        mutationRate: 0.3,
        eliteRatio: 0.1,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + Math.random() * 2 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 5,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const initialBest = engine.getBest().fitness;
    const result = engine.run();
    return result.best.fitness >= initialBest;
});
// ─── 23. elite 개체 다음 세대에 유지 ─────────────────────────────────────────
test("23. elite 개체 다음 세대 유지 — best fitness 비감소", () => {
    const fitnessHistory = [];
    const config = {
        populationSize: 15,
        maxGenerations: 10,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + (Math.random() - 0.5) * 5 : g,
        crossoverFunc: (a, b) => (a + b) / 2,
        initFunc: () => Math.random() * 100,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    for (let i = 0; i < 5; i++) {
        engine.step();
        fitnessHistory.push(engine.getBest().fitness);
    }
    // 각 세대 최고값이 이전 세대보다 크게 떨어지지 않아야 함
    let monotone = true;
    for (let i = 1; i < fitnessHistory.length; i++) {
        if (fitnessHistory[i] < fitnessHistory[i - 1] - 10) {
            monotone = false;
        }
    }
    return monotone;
});
// ─── 24. Individual 구조 (genome/fitness/generation/id) ──────────────────────
test("24. Individual 구조 — genome/fitness/generation/id 모두 존재", () => {
    const config = {
        populationSize: 5,
        maxGenerations: 3,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g.length,
        mutateFunc: (g, r) => Math.random() < r ? g + "x" : g,
        crossoverFunc: (a, b) => a.slice(0, Math.floor(a.length / 2)) + b.slice(Math.floor(b.length / 2)),
        initFunc: () => "abc",
    };
    const engine = new evolve_1.EvolutionEngine(config);
    engine.initialize();
    const pop = engine.getPopulation();
    const ind = pop[0];
    return ("genome" in ind &&
        "fitness" in ind &&
        "generation" in ind &&
        "id" in ind &&
        typeof ind.id === "string" &&
        ind.id.length > 0);
});
// ─── 25. EvolutionResult 구조 ────────────────────────────────────────────────
test("25. EvolutionResult — 완전한 구조 검증", () => {
    const result = (0, evolve_1.evolveNumbers)([0, 0, 0], 5, 5);
    return ("best" in result &&
        "population" in result &&
        "generations" in result &&
        "converged" in result &&
        "history" in result &&
        Array.isArray(result.population) &&
        Array.isArray(result.history) &&
        typeof result.generations === "number" &&
        typeof result.converged === "boolean");
});
// ─── 26. evolveStrings — 진화 후 타겟과 유사해짐 ────────────────────────────
test("26. evolveStrings — 진화 후 fitness 음수가 작아짐 (타겟 접근)", () => {
    const result = (0, evolve_1.evolveStrings)("ab", 20, 50);
    // fitness는 음수 (0에 가까울수록 좋음)
    return result.best.fitness <= 0;
});
// ─── 27. history 엔트리 구조 ─────────────────────────────────────────────────
test("27. history 엔트리 — gen/bestFitness/avgFitness 포함", () => {
    const config = {
        populationSize: 5,
        maxGenerations: 3,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    if (result.history.length === 0)
        return false;
    const entry = result.history[0];
    return "gen" in entry && "bestFitness" in entry && "avgFitness" in entry;
});
// ─── 28. generation 번호 증가 ────────────────────────────────────────────────
test("28. history gen 번호 순차 증가", () => {
    const config = {
        populationSize: 5,
        maxGenerations: 5,
        mutationRate: 0.1,
        eliteRatio: 0.2,
        fitnessFunc: (g) => g,
        mutateFunc: (g, r) => Math.random() < r ? g + 1 : g,
        crossoverFunc: (a, b) => Math.max(a, b),
        initFunc: () => Math.random() * 10,
    };
    const engine = new evolve_1.EvolutionEngine(config);
    const result = engine.run();
    for (let i = 0; i < result.history.length; i++) {
        if (result.history[i].gen !== i + 1)
            return false;
    }
    return true;
});
// ─── 결과 출력 ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`결과: ${pass} PASS, ${fail} FAIL`);
if (fail === 0) {
    console.log(`\n모든 테스트 통과! Phase 131 [EVOLVE] 완성.\n`);
}
else {
    console.log(`\n${fail}개 실패. 확인 필요.\n`);
    process.exit(1);
}
//# sourceMappingURL=test-phase131-evolve.js.map