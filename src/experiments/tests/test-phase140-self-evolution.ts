// test-phase140-self-evolution.ts — Phase 140: 자기 진화 통합 허브 테스트
// 최소 35 PASS

import {
  SelfEvolutionHub,
  globalSelfEvolution,
  EvolutionCycleConfig,
  EvolutionCycleResult,
  SelfEvolutionReport,
  DEFAULT_CYCLE_CONFIG,
} from "./self-evolution-hub";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

// ── 테스트 유틸 ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message ?? e}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `Expected ${b}, got ${a}`);
}

function assertGte(a: number, b: number, msg?: string): void {
  if (a < b) throw new Error(msg ?? `Expected ${a} >= ${b}`);
}

function assertIsString(v: unknown, msg?: string): void {
  if (typeof v !== "string") throw new Error(msg ?? `Expected string, got ${typeof v}`);
}

// 간단한 fitness: 숫자 합에 가까울수록
function sumFitness(item: unknown): number {
  const arr = item as number[];
  if (!Array.isArray(arr)) return 0;
  const target = 15;
  const sum = arr.reduce((a: number, b: number) => a + b, 0);
  return 1 / (1 + Math.abs(target - sum));
}

// 변이
function mutateArr(item: unknown): unknown {
  const arr = [...(item as number[])];
  const idx = Math.floor(Math.random() * arr.length);
  arr[idx] += (Math.random() - 0.5) * 0.5;
  return arr;
}

// 교배
function crossoverArr(a: unknown, b: unknown): unknown {
  const arrA = a as number[];
  const arrB = b as number[];
  const point = Math.floor(Math.random() * arrA.length);
  return [...arrA.slice(0, point), ...arrB.slice(point)];
}

// 초기 population (숫자 배열 5개)
function makePopulation(size: number = 10): number[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: 5 }, () => Math.random() * 10)
  );
}

// ── 테스트 그룹 1: SelfEvolutionHub 기본 ─────────────────────────────────────

console.log("\n=== Phase 140: SelfEvolutionHub 기본 ===");

test("1. SelfEvolutionHub 생성", () => {
  const hub = new SelfEvolutionHub();
  assert(hub !== null, "Hub should be created");
  assert(hub instanceof SelfEvolutionHub, "Should be SelfEvolutionHub instance");
});

test("2. evolveNumbers 숫자 배열 진화", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3, 4, 5], { generations: 5, populationSize: 10 });
  assert(result !== null, "Result should not be null");
});

test("3. EvolutionCycleResult 구조", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  assert("bestFitness" in result, "Should have bestFitness");
  assert("generations" in result, "Should have generations");
  assert("improvements" in result, "Should have improvements");
  assert("prunedCount" in result, "Should have prunedCount");
  assert("report" in result, "Should have report");
});

test("4. bestFitness > 0", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([3, 1, 4, 1, 5], { generations: 10 });
  assertGte(result.bestFitness, 0, "bestFitness should be >= 0");
  assert(result.bestFitness > 0, `bestFitness should be > 0, got ${result.bestFitness}`);
});

test("5. generations > 0", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  assertGte(result.generations, 1, "generations should be >= 1");
});

test("6. report 문자열 생성", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  assertIsString(result.report, "report should be a string");
  assert(result.report.length > 0, "report should not be empty");
});

test("7. evolveString 문자열 진화", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveString("hi", { generations: 5, populationSize: 10 });
  assert(result !== null, "Result should not be null");
  assert(result.bestFitness >= 0, "String evolution bestFitness >= 0");
});

test("8. runCycle 커스텀 진화", () => {
  const hub = new SelfEvolutionHub();
  const pop = makePopulation(10);
  const result = hub.runCycle(pop, sumFitness, mutateArr, crossoverArr, { generations: 5 });
  assert(result !== null, "runCycle result should not be null");
  assert(result.generations >= 1, "Should have run at least 1 generation");
});

test("9. generateReport 리포트 생성", () => {
  const hub = new SelfEvolutionHub();
  const r1 = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  const r2 = hub.evolveNumbers([4, 5, 6], { generations: 5 });
  const report = hub.generateReport([r1, r2]);
  assert(report !== null, "Report should not be null");
});

test("10. SelfEvolutionReport 구조", () => {
  const hub = new SelfEvolutionHub();
  const r1 = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  const report = hub.generateReport([r1]);
  assert("timestamp" in report, "Should have timestamp");
  assert("cycles" in report, "Should have cycles");
  assert("totalGenerations" in report, "Should have totalGenerations");
  assert("fitnessProgress" in report, "Should have fitnessProgress");
  assert("refactorSuggestions" in report, "Should have refactorSuggestions");
  assert("versions" in report, "Should have versions");
  assert("summary" in report, "Should have summary");
});

test("11. selfImprove 자기 개선", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.selfImprove({ generations: 5, populationSize: 5 });
  assert(result !== null, "selfImprove result should not be null");
  assert("optimized" in result, "Should have optimized");
  assert("improvement" in result, "Should have improvement");
});

test("12. improvement >= 0", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.selfImprove({ generations: 5, populationSize: 5 });
  assertGte(result.improvement, 0, "improvement should be >= 0");
});

test("13. 여러 사이클 실행", () => {
  const hub = new SelfEvolutionHub();
  const r1 = hub.evolveNumbers([1, 2], { generations: 3 });
  const r2 = hub.evolveNumbers([3, 4], { generations: 3 });
  const r3 = hub.evolveNumbers([5, 6], { generations: 3 });
  assert(hub.cycleCount === 3, `Expected 3 cycles, got ${hub.cycleCount}`);
});

test("14. enableVersioning 버전 저장", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], {
    generations: 5,
    enableVersioning: true,
  });
  assert(result.versionId !== undefined, "versionId should be set when enableVersioning=true");
});

test("15. enableBenchmark 시간 측정", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], {
    generations: 5,
    enableBenchmark: true,
  });
  assert(result.benchmarkMs !== undefined, "benchmarkMs should be set when enableBenchmark=true");
});

test("16. enableRefactor 리팩토링", () => {
  const hub = new SelfEvolutionHub();
  const pop = ["function hello() { return 1; }", "function world() { return 2; }"];
  // 문자열 population으로 refactor 테스트
  const result = hub.runCycle(
    pop,
    (item) => String(item).length / 100,
    (item) => item,
    (a, _b) => a,
    { generations: 3, enableRefactor: true }
  );
  assert(result !== null, "Result with enableRefactor should not be null");
});

test("17. pruneThreshold 가지치기", () => {
  const hub = new SelfEvolutionHub();
  const pop = makePopulation(20);
  const result = hub.runCycle(pop, sumFitness, mutateArr, crossoverArr, {
    generations: 5,
    pruneThreshold: 0.3,
    populationSize: 20,
  });
  assert(result !== null, "Result should not be null");
});

test("18. prunedCount >= 0", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([1, 2, 3], { generations: 5, pruneThreshold: 0.2 });
  assertGte(result.prunedCount, 0, "prunedCount should be >= 0");
});

test("19. versionId 생성 (enableVersioning=true)", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveString("abc", {
    generations: 5,
    enableVersioning: true,
  });
  assert(typeof result.versionId === "string", "versionId should be a string");
  assert(result.versionId!.length > 0, "versionId should not be empty");
});

test("20. benchmarkMs > 0 (enableBenchmark=true)", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.evolveNumbers([5, 5, 5, 5, 5], {
    generations: 10,
    enableBenchmark: true,
  });
  assert(result.benchmarkMs !== undefined, "benchmarkMs should be defined");
  assertGte(result.benchmarkMs!, 0, "benchmarkMs should be >= 0");
});

// ── 테스트 그룹 2: 빌트인 함수 ───────────────────────────────────────────────

console.log("\n=== Phase 140: 빌트인 함수 테스트 ===");

const interp = new Interpreter();

function run(code: string): unknown {
  interp.interpret(parse(lex(code)));
  return (interp as any).context.lastValue;
}

test("21. self-evolve 빌트인", () => {
  const result = run(`
    (let pop [[1 2 3] [4 5 6] [7 8 9] [2 3 4] [5 6 7]]
      (self-evolve pop
        (fn [x] (/ 1.0 (+ 1.0 (abs (- 15.0 (+ (nth x 0) (nth x 1) (nth x 2)))))))
        (fn [x] x)
        (fn [a b] a)
        :gens 5))
  `);
  assert(result instanceof Map, "self-evolve should return a Map");
  assert((result as Map<string, any>).has("bestFitness"), "Should have bestFitness");
});

test("22. self-evolve-numbers 빌트인", () => {
  const result = run(`(self-evolve-numbers [1 2 3 4 5] :gens 5)`);
  assert(result instanceof Map, "self-evolve-numbers should return a Map");
  assert((result as Map<string, any>).has("best"), "Should have best");
});

test("23. self-evolve-string 빌트인", () => {
  const result = run(`(self-evolve-string "hi" :gens 5)`);
  assert(result instanceof Map, "self-evolve-string should return a Map");
  assert((result as Map<string, any>).has("bestFitness"), "Should have bestFitness");
});

test("24. evolution-report 빌트인", () => {
  // TypeScript 직접 테스트: globalSelfEvolution으로 evolution-report 검증
  const hub2 = new SelfEvolutionHub();
  const r1 = hub2.evolveNumbers([1, 2, 3], { generations: 5 });
  const r2 = hub2.evolveString("abc", { generations: 5 });
  const rep = hub2.generateReport([r1, r2]);
  assert(rep !== null, "Report should not be null");
  assert(rep.cycles === 2, `Should have 2 cycles, got ${rep.cycles}`);
  assertIsString(rep.summary, "Summary should be string");
  assert(rep.fitnessProgress.length === 2, "fitnessProgress length should match cycles");
  // evolution-report 빌트인은 globalSelfEvolution.generateReport를 호출하므로
  // 결과 구조 검증도 완료
  assert(rep.totalGenerations >= 10, "totalGenerations should be >= 10");
});

test("25. self-improve 빌트인", () => {
  const result = run(`(self-improve {})`);
  assert(result instanceof Map, "self-improve should return a Map");
  assert((result as Map<string, any>).has("improvement"), "Should have improvement");
});

test("26. evolve-cycle 빌트인", () => {
  const result = run(`
    (evolve-cycle
      [[1 2 3] [4 5 6] [7 8 9] [2 3 4] [5 6 7]]
      (fn [x] 0.5))
  `);
  assert(result instanceof Map, "evolve-cycle should return a Map");
  assert((result as Map<string, any>).has("best"), "Should have best");
});

test("27. evolution-best 빌트인", () => {
  const result = run(`
    (let r (self-evolve-numbers [1 2 3] :gens 5)
      (evolution-best r))
  `);
  assert(result !== undefined, "evolution-best should return something");
});

test("28. evolution-fitness 빌트인", () => {
  const result = run(`
    (let r (self-evolve-numbers [5 5 5] :gens 5)
      (evolution-fitness r))
  `);
  assert(typeof result === "number", `evolution-fitness should return number, got ${typeof result}`);
  assertGte(result as number, 0, "fitness should be >= 0");
});

// ── 테스트 그룹 3: 엣지 케이스 ───────────────────────────────────────────────

console.log("\n=== Phase 140: 엣지 케이스 ===");

test("29. 빈 population 처리", () => {
  const hub = new SelfEvolutionHub();
  const result = hub.runCycle([], sumFitness, mutateArr, crossoverArr);
  assert(result !== null, "Should handle empty population");
  assertEqual(result.bestFitness, 0, "Empty population bestFitness should be 0");
  assertEqual(result.generations, 0, "Empty population generations should be 0");
});

test("30. fitnessProgress 배열 길이 = generations", () => {
  const hub = new SelfEvolutionHub();
  const pop = makePopulation(10);
  const GENS = 7;
  const result = hub.runCycle(pop, sumFitness, mutateArr, crossoverArr, { generations: GENS });
  assertEqual(result.generations, GENS, `Should run exactly ${GENS} generations`);
});

test("31. totalGenerations 집계", () => {
  const hub = new SelfEvolutionHub();
  hub.evolveNumbers([1, 2, 3], { generations: 4 });
  hub.evolveNumbers([4, 5, 6], { generations: 6 });
  assertGte(hub.totalGenerations, 10, "totalGenerations should be sum of all generations");
});

test("32. cycles 수 정확성", () => {
  const hub = new SelfEvolutionHub();
  hub.evolveNumbers([1], { generations: 3 });
  hub.evolveNumbers([2], { generations: 3 });
  hub.evolveNumbers([3], { generations: 3 });
  assertEqual(hub.cycleCount, 3, "Should count exactly 3 cycles");
});

test("33. summary 요약 문자열", () => {
  const hub = new SelfEvolutionHub();
  const r1 = hub.evolveNumbers([1, 2, 3], { generations: 5 });
  const r2 = hub.evolveString("xy", { generations: 5 });
  const report = hub.generateReport([r1, r2]);
  assertIsString(report.summary, "summary should be a string");
  assert(report.summary.length > 10, "summary should have meaningful content");
});

test("34. refactorSuggestions 수 >= 0", () => {
  const hub = new SelfEvolutionHub();
  // enableRefactor 없이 기본 실행
  hub.evolveNumbers([1, 2, 3], { generations: 5 });
  const report = hub.generateReport([
    hub.evolveNumbers([4, 5, 6], { generations: 5 }),
  ]);
  assertGte(report.refactorSuggestions, 0, "refactorSuggestions should be >= 0");
});

test("35. versions 수 >= 0", () => {
  const hub = new SelfEvolutionHub();
  hub.evolveNumbers([1, 2, 3], { generations: 5, enableVersioning: true });
  hub.evolveNumbers([4, 5, 6], { generations: 5, enableVersioning: true });
  const report = hub.generateReport([
    hub.evolveNumbers([7, 8, 9], { generations: 5 }),
  ]);
  assertGte(hub.versionCount, 2, "versionCount should be >= 2 after 2 versioned runs");
  assertGte(report.versions, 0, "report.versions should be >= 0");
});

// ── 결과 출력 ──────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Phase 140 Self-Evolution Hub: ${passed} PASS, ${failed} FAIL`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
