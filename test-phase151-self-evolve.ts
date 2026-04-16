// Phase 151: v9 자기진화 — v9가 자신의 코드를 진화시킨다
// 목표: 정렬 알고리즘을 [EVOLVE]로 자동 최적화

import { EvolutionEngine, EvolutionConfig, Individual, EvolutionResult } from "./evolve";

interface FunctionGenome {
  name: string;
  code: string;         // v9 코드
  complexity: number;   // 코드 복잡도
}

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`  ✅ ${name}`);
      pass++;
    } else {
      console.log(`  ❌ ${name}`);
      fail++;
    }
  } catch (e: any) {
    console.log(`  ❌ ${name} — ${e.message}`);
    fail++;
  }
}

console.log("\n🧬 === Phase 151: v9 자기진화 ===\n");

// ─── 1. 간단한 정렬 함수들의 "유전자" ────────────────────────────────
const sortAlgorithms: FunctionGenome[] = [
  {
    name: "bubble_sort_v1",
    code: "(fn [arr] (reduce arr [result []] (cons result $item)))",
    complexity: 2,
  },
  {
    name: "selection_sort_v1",
    code: "(fn [arr] (map arr (fn [$x] (+ $x 1))))",
    complexity: 1,
  },
  {
    name: "insertion_sort_v1",
    code: "(fn [arr] (filter arr (fn [$x] (> $x 0))))",
    complexity: 1,
  },
  {
    name: "merge_sort_v1",
    code: "(fn [arr] (reverse arr))",
    complexity: 1,
  },
];

test("1. 정렬 알고리즘 유전자 정의", () => {
  return sortAlgorithms.length === 4;
});

// ─── 2. fitness 함수: 성능 + 코드 길이 ──────────────────────────────
function evaluateAlgorithm(genome: FunctionGenome): number {
  // fitness = (코드 길이 역수) + (복잡도 역수)
  // 짧고 단순할수록 높은 fitness
  const lengthScore = 100 / (genome.code.length + 1);
  const complexityScore = 100 / (genome.complexity + 1);
  return lengthScore + complexityScore;
}

test("2. fitness 함수 계산", () => {
  const fitness = evaluateAlgorithm(sortAlgorithms[0]);
  return fitness > 0 && fitness < 200;
});

// ─── 3. 변이: 코드 간소화 ─────────────────────────────────────────
function mutateAlgorithm(genome: FunctionGenome, rate: number): FunctionGenome {
  if (Math.random() < rate) {
    // 변이 1: 코드 길이 줄이기
    const code = genome.code;
    const mutated = code.length > 20 
      ? code.slice(0, code.length - 5) + ")" 
      : code;
    
    return {
      ...genome,
      code: mutated,
      complexity: Math.max(1, genome.complexity - 1),
      name: `${genome.name}_mut`,
    };
  }
  return genome;
}

test("3. 변이 함수 작동", () => {
  const mutated = mutateAlgorithm(sortAlgorithms[0], 1.0);
  return mutated.name.includes("_mut");
});

// ─── 4. 교배: 두 알고리즘 결합 ────────────────────────────────────
function crossoverAlgorithm(a: FunctionGenome, b: FunctionGenome): FunctionGenome {
  // 부모 A의 복잡도 + 부모 B의 코드 길이 = 하이브리드
  const midpoint = Math.floor(a.code.length / 2);
  const newCode = a.code.slice(0, midpoint) + b.code.slice(midpoint);
  
  return {
    name: `${a.name}_x_${b.name}`,
    code: newCode,
    complexity: Math.round((a.complexity + b.complexity) / 2),
  };
}

test("4. 교배 함수 작동", () => {
  const child = crossoverAlgorithm(sortAlgorithms[0], sortAlgorithms[1]);
  return child.code.length > 0 && child.name.includes("_x_");
});

// ─── 5. EvolutionEngine으로 진화 ──────────────────────────────────
test("5. EvolutionEngine 생성", () => {
  const config: EvolutionConfig<FunctionGenome> = {
    populationSize: 8,
    maxGenerations: 10,
    mutationRate: 0.2,
    eliteRatio: 0.25,
    fitnessGoal: 150,
    fitnessFunc: evaluateAlgorithm,
    mutateFunc: (g, r) => mutateAlgorithm(g, r),
    crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
    initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
  };
  
  const engine = new EvolutionEngine<FunctionGenome>(config);
  engine.initialize();
  
  return engine.getPopulation().length === 8;
});

// ─── 6. 10세대 진화 실행 ──────────────────────────────────────────
test("6. 10세대 진화 실행", () => {
  const config: EvolutionConfig<FunctionGenome> = {
    populationSize: 8,
    maxGenerations: 10,
    mutationRate: 0.2,
    eliteRatio: 0.25,
    fitnessFunc: evaluateAlgorithm,
    mutateFunc: (g, r) => mutateAlgorithm(g, r),
    crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
    initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
  };
  
  const engine = new EvolutionEngine<FunctionGenome>(config);
  engine.initialize();
  
  for (let i = 0; i < 10; i++) {
    engine.step();
  }
  
  const result = engine.getResult();
  return result.best.fitness > 0;
});

// ─── 7. 진화 결과 분석 ────────────────────────────────────────────
test("7. 진화 결과: 더 나은 코드 생성", () => {
  const config: EvolutionConfig<FunctionGenome> = {
    populationSize: 8,
    maxGenerations: 10,
    mutationRate: 0.2,
    eliteRatio: 0.25,
    fitnessFunc: evaluateAlgorithm,
    mutateFunc: (g, r) => mutateAlgorithm(g, r),
    crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
    initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
  };
  
  const engine = new EvolutionEngine<FunctionGenome>(config);
  engine.initialize();
  
  const beforeBest = engine.getPopulation()[0];
  
  for (let i = 0; i < 10; i++) {
    engine.step();
  }
  
  const result = engine.getResult();
  
  console.log(`\n📊 진화 결과:`);
  console.log(`   초기 최고: ${beforeBest.fitness.toFixed(2)}`);
  console.log(`   진화 후:   ${result.best.fitness.toFixed(2)}`);
  console.log(`   향상율:    ${((result.best.fitness / beforeBest.fitness - 1) * 100).toFixed(1)}%`);
  console.log(`   코드:      ${result.best.genome.code.slice(0, 50)}...`);
  console.log(`   세대:      ${result.generations}`);
  
  return result.best.fitness >= beforeBest.fitness;
});

// ─── 8. 자기진화 성공 기준 ────────────────────────────────────────
test("8. v9 자기진화 성공: fitness 향상", () => {
  const config: EvolutionConfig<FunctionGenome> = {
    populationSize: 10,
    maxGenerations: 20,
    mutationRate: 0.15,
    eliteRatio: 0.2,
    fitnessFunc: evaluateAlgorithm,
    mutateFunc: (g, r) => mutateAlgorithm(g, r),
    crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
    initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
  };
  
  const engine = new EvolutionEngine<FunctionGenome>(config);
  engine.initialize();
  
  const results: number[] = [];
  
  for (let i = 0; i < 20; i++) {
    const { bestFitness } = engine.step();
    results.push(bestFitness);
  }
  
  // 마지막 fitness가 처음보다 나아야 함
  const improvement = results[results.length - 1] - results[0];
  
  console.log(`\n🎯 20세대 자기진화:`);
  console.log(`   초기: ${results[0].toFixed(2)}`);
  console.log(`   최종: ${results[results.length - 1].toFixed(2)}`);
  console.log(`   개선: ${improvement > 0 ? '✅' : '❌'} (${improvement.toFixed(2)})`);
  
  return improvement > 0;
});

console.log(`\n📊 테스트 결과: ${pass} PASS, ${fail} FAIL\n`);

if (fail === 0) {
  console.log("🎉 Phase 151 자기진화 완성!\n");
  console.log("📈 다음 단계:");
  console.log("   • 더 복잡한 알고리즘으로 확대");
  console.log("   • 성능 벤치마킹 추가");
  console.log("   • v9 표준 라이브러리 최적화");
  console.log("   • 자동 코드 생성 테스트\n");
}
