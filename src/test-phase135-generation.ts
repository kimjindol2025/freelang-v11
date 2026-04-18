// test-phase135-generation.ts — FreeLang v9 Phase 135: [GENERATION] 세대별 진화 루프

import {
  GenerationLoop,
  GenerationConfig,
  GenerationStats,
  GenerationResult,
  runGeneration,
} from "./generation";

import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

// 인터프리터 헬퍼
function run(interp: Interpreter, code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

console.log("\n=== Phase 135: [GENERATION] 세대별 진화 루프 ===\n");

// 공통 헬퍼
const simplePopulation = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const fitnessId = (x: number) => x;  // 숫자 자체가 적합도
const nextGenKeepBest = (pop: number[], fits: number[]): number[] => {
  const paired = pop.map((v, i) => ({ v, f: fits[i] })).sort((a, b) => b.f - a.f);
  const half = Math.max(1, Math.floor(paired.length / 2));
  const elites = paired.slice(0, half).map(p => p.v);
  const result: number[] = [...elites];
  while (result.length < pop.length) result.push(elites[result.length % half] + Math.random() * 0.01);
  return result;
};

// ─── 1. GenerationLoop 생성 ───────────────────────────────────────────────────
test("1. GenerationLoop 클래스 인스턴스 생성", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 10 });
  assert(loop instanceof GenerationLoop, "GenerationLoop 생성 실패");
});

// ─── 2. 간단한 진화 루프 실행 (숫자 최대화) ──────────────────────────────────
test("2. 간단한 숫자 최대화 진화 루프 실행", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(typeof result.bestFitness === "number", "bestFitness는 숫자여야 함");
});

// ─── 3. maxGenerations 제한 준수 ─────────────────────────────────────────────
test("3. maxGenerations 제한 준수", () => {
  const maxGen = 7;
  const loop = new GenerationLoop<number>({ maxGenerations: maxGen });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(result.totalGenerations <= maxGen, `totalGenerations ${result.totalGenerations} > ${maxGen}`);
});

// ─── 4. targetFitness 조기 종료 ──────────────────────────────────────────────
test("4. targetFitness 달성 시 조기 종료", () => {
  const loop = new GenerationLoop<number>({
    maxGenerations: 100,
    targetFitness: 5,
  });
  const pop = [1, 2, 3, 4, 5, 6];
  const result = loop.run(pop, fitnessId, nextGenKeepBest);
  assert(result.terminationReason === "target-reached", `예상: target-reached, 실제: ${result.terminationReason}`);
  assert(result.totalGenerations < 100, "100세대 미만이어야 함");
});

// ─── 5. stagnation 정지 ───────────────────────────────────────────────────────
test("5. stagnation 정지 (개선 없이 멈춤)", () => {
  const flatPop = [5, 5, 5, 5, 5];
  const flatFitness = (x: number) => x;
  const flatNext = (pop: number[]) => [...pop]; // 변화 없음

  const loop = new GenerationLoop<number>({
    maxGenerations: 100,
    stagnationLimit: 3,
  });
  const result = loop.run(flatPop, flatFitness, flatNext);
  assert(result.terminationReason === "stagnation", `예상: stagnation, 실제: ${result.terminationReason}`);
  assert(result.totalGenerations < 100, "100세대 미만이어야 함");
});

// ─── 6. GenerationStats 구조 ─────────────────────────────────────────────────
test("6. GenerationStats 구조 검증", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 3 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  const stats = result.history[0];
  assert(typeof stats.generation === "number", "generation 필드 누락");
  assert(typeof stats.best === "number", "best 필드 누락");
  assert(typeof stats.worst === "number", "worst 필드 누락");
  assert(typeof stats.average === "number", "average 필드 누락");
  assert(typeof stats.diversity === "number", "diversity 필드 누락");
  assert(typeof stats.elites === "number", "elites 필드 누락");
  assert(typeof stats.improved === "boolean", "improved 필드 누락");
});

// ─── 7. GenerationResult 구조 ────────────────────────────────────────────────
test("7. GenerationResult 구조 검증", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert("best" in result, "best 필드 없음");
  assert("bestFitness" in result, "bestFitness 필드 없음");
  assert("totalGenerations" in result, "totalGenerations 필드 없음");
  assert("history" in result, "history 필드 없음");
  assert("terminationReason" in result, "terminationReason 필드 없음");
  assert("improvementRatio" in result, "improvementRatio 필드 없음");
});

// ─── 8. history 길이 = 실행 세대 수 ─────────────────────────────────────────
test("8. history 길이 == totalGenerations", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 8 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(
    result.history.length === result.totalGenerations,
    `history 길이 ${result.history.length} != totalGenerations ${result.totalGenerations}`
  );
});

// ─── 9. best 항상 최고 적합도 ────────────────────────────────────────────────
test("9. best는 최고 적합도 개체", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 10 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(result.bestFitness === fitnessId(result.best), "bestFitness와 fitnessId(best) 불일치");
});

// ─── 10. diversity 계산 (0~1) ────────────────────────────────────────────────
test("10. diversity 계산 (0~1 범위)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 1 });
  const diversity = loop.calculateDiversity([1, 5, 3, 7, 2]);
  assert(diversity >= 0 && diversity <= 1, `diversity ${diversity} 범위 벗어남`);
});

// ─── 11. improved 플래그 정확성 ──────────────────────────────────────────────
test("11. improved 플래그 정확성 (첫 세대는 true)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(result.history[0].improved === true, "첫 세대 improved는 true여야 함");
});

// ─── 12. terminationReason 정확성 ────────────────────────────────────────────
test("12. terminationReason 정확성 (max-generations)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 3 });
  const pop = [0.1, 0.2, 0.3];
  const result = loop.run(pop, (x) => x, (p) => p.map(v => v + 0.001));
  assert(result.terminationReason === "max-generations", `예상: max-generations, 실제: ${result.terminationReason}`);
});

// ─── 13. improvementRatio 계산 ───────────────────────────────────────────────
test("13. improvementRatio 계산 (개선 있으면 >= 0)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 10 });
  const pop = [1, 2, 3];
  const result = loop.run(pop, fitnessId, nextGenKeepBest);
  assert(typeof result.improvementRatio === "number", "improvementRatio는 숫자여야 함");
  assert(result.improvementRatio >= 0, `improvementRatio ${result.improvementRatio} < 0`);
});

// ─── 14. onGeneration 콜백 호출 ──────────────────────────────────────────────
test("14. onGeneration 콜백 호출 횟수 == totalGenerations", () => {
  let callCount = 0;
  const loop = new GenerationLoop<number>({
    maxGenerations: 6,
    onGeneration: (_stats) => { callCount++; },
  });
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(callCount === result.totalGenerations, `콜백 ${callCount}회 != totalGenerations ${result.totalGenerations}`);
});

// ─── 15. generation-run 빌트인 ───────────────────────────────────────────────
test("15. generation-run 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define test-pop [1 2 3 4 5])`);
  const ctx = interp.run(`(generation-run test-pop (fn [$x] $x) null)`);
  assert(ctx.lastValue instanceof Map, "generation-run 결과는 Map이어야 함");
  assert((ctx.lastValue as Map<string, any>).has("best"), "best 필드 없음");
});

// ─── 16. generation-stats 빌트인 ─────────────────────────────────────────────
test("16. generation-stats 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr16 (generation-run [1 2 3 4 5] (fn [$x] $x) null))`);
  const ctx = interp.run(`(generation-stats gr16)`);
  assert(Array.isArray(ctx.lastValue), "generation-stats 결과는 배열이어야 함");
  assert((ctx.lastValue as any[]).length > 0, "stats 배열이 비어 있음");
});

// ─── 17. generation-best 빌트인 ──────────────────────────────────────────────
test("17. generation-best 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr17 (generation-run [1 2 3 4 5] (fn [$x] $x) null))`);
  const ctx = interp.run(`(generation-best gr17)`);
  assert(typeof ctx.lastValue === "number", `generation-best 결과가 숫자가 아님: ${typeof ctx.lastValue}`);
});

// ─── 18. generation-history 빌트인 ───────────────────────────────────────────
test("18. generation-history 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr18 (generation-run [1 2 3 4 5] (fn [$x] $x) null))`);
  const ctx = interp.run(`(generation-history gr18)`);
  assert(Array.isArray(ctx.lastValue), "generation-history 결과는 배열이어야 함");
  assert((ctx.lastValue as any[]).length > 0, "history 배열이 비어 있음");
});

// ─── 19. generation-converged 빌트인 ─────────────────────────────────────────
test("19. generation-converged 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr19 (generation-run [1 2 3] (fn [$x] $x) null))`);
  const ctx = interp.run(`(generation-converged gr19)`);
  assert(typeof ctx.lastValue === "boolean", `generation-converged 결과가 boolean이 아님: ${typeof ctx.lastValue}`);
});

// ─── 20. generation-diversity 빌트인 ─────────────────────────────────────────
test("20. generation-diversity 빌트인", () => {
  const interp = new Interpreter();
  const ctx = interp.run(`(generation-diversity [0.8 0.7 0.9 0.6])`);
  const d = ctx.lastValue as number;
  assert(typeof d === "number", "diversity는 숫자여야 함");
  assert(d >= 0 && d <= 1, `diversity ${d} 범위 벗어남`);
});

// ─── 21. gen-improvement 빌트인 ──────────────────────────────────────────────
test("21. gen-improvement 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr21 (generation-run [1 2 3 4 5] (fn [$x] $x) null))`);
  const ctx = interp.run(`(gen-improvement gr21)`);
  assert(typeof ctx.lastValue === "number", "gen-improvement 결과가 숫자가 아님");
  assert((ctx.lastValue as number) >= 0, "improvementRatio < 0");
});

// ─── 22. gen-termination 빌트인 ──────────────────────────────────────────────
test("22. gen-termination 빌트인", () => {
  const interp = new Interpreter();
  interp.run(`(define gr22 (generation-run [1 2 3] (fn [$x] $x) null))`);
  const ctx = interp.run(`(gen-termination gr22)`);
  const valid = ["max-generations", "target-reached", "stagnation"];
  assert(valid.includes(ctx.lastValue as string), `terminationReason 잘못됨: ${ctx.lastValue}`);
});

// ─── 23. 연속 실행 (두 번째 run()은 초기화) ──────────────────────────────────
test("23. 연속 실행 시 초기화 (history 재시작)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  const result2 = loop.run([1, 2, 3], fitnessId, nextGenKeepBest);
  assert(result2.history.length === result2.totalGenerations, "두 번째 실행 history 불일치");
});

// ─── 24. 단조 증가 (bestFitness >= 초기 최고값) ───────────────────────────────
test("24. bestFitness >= 초기 개체군 최고 적합도", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 10 });
  const initMax = Math.max(...simplePopulation.map(fitnessId));
  const result = loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  assert(result.bestFitness >= initMax, `bestFitness ${result.bestFitness} < initMax ${initMax}`);
});

// ─── 25. elites 계산 (상위 10%) ──────────────────────────────────────────────
test("25. elites 계산 (상위 10%)", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 3 });
  const pop = new Array(20).fill(0).map((_, i) => i);
  const result = loop.run(pop, fitnessId, nextGenKeepBest);
  const expectedElites = Math.max(1, Math.floor(pop.length * 0.1));
  assert(
    result.history[0].elites === expectedElites,
    `elites ${result.history[0].elites} != expected ${expectedElites}`
  );
});

// ─── 26. runGeneration 편의 함수 ─────────────────────────────────────────────
test("26. runGeneration 편의 함수 동작", () => {
  const result = runGeneration(
    [1, 2, 3, 4, 5],
    fitnessId,
    nextGenKeepBest,
    5
  );
  assert(typeof result.bestFitness === "number", "bestFitness 없음");
  assert(result.bestFitness > 0, "bestFitness > 0 이어야 함");
});

// ─── 27. 균일한 개체군 다양성 = 0 ───────────────────────────────────────────
test("27. 균일한 개체군 다양성 = 0", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 1 });
  const diversity = loop.calculateDiversity([5, 5, 5, 5, 5]);
  assert(diversity === 0, `diversity ${diversity} != 0`);
});

// ─── 28. hasConverged(): 히스토리 부족 시 false ──────────────────────────────
test("28. hasConverged(): 히스토리 부족 시 false", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 3 });
  loop.run([1, 2, 3], fitnessId, nextGenKeepBest);
  assert(loop.hasConverged() === false, "3 세대 < 5 → hasConverged false여야 함");
});

// ─── 29. getCurrentStats(): 실행 전 null ─────────────────────────────────────
test("29. getCurrentStats(): 실행 전 null", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  assert(loop.getCurrentStats() === null, "실행 전 getCurrentStats는 null이어야 함");
});

// ─── 30. getCurrentStats(): 실행 후 마지막 stats 반환 ────────────────────────
test("30. getCurrentStats(): 실행 후 stats 반환", () => {
  const loop = new GenerationLoop<number>({ maxGenerations: 5 });
  loop.run(simplePopulation, fitnessId, nextGenKeepBest);
  const stats = loop.getCurrentStats();
  assert(stats !== null, "실행 후 getCurrentStats는 null이 아니어야 함");
  assert(typeof stats!.generation === "number", "generation 필드 없음");
});

// ─── 결과 출력 ───────────────────────────────────────────────────────────────
console.log(`\n총 ${passed + failed}개 테스트: ${passed} PASS, ${failed} FAIL\n`);

if (failed > 0) {
  process.exit(1);
}
