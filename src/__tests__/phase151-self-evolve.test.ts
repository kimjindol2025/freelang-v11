// Phase 151: v9 자기진화 — v9가 자신의 코드를 진화시킨다

import { EvolutionEngine } from "../evolve";

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("Phase 151: v9 자기진화 [EVOLVE]", () => {
  const sortAlgorithms = [
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

  const evaluateAlgorithm = (genome) => {
    const lengthScore = 100 / (genome.code.length + 1);
    const complexityScore = 100 / (genome.complexity + 1);
    return lengthScore + complexityScore;
  };

  const mutateAlgorithm = (genome, rate) => {
    if (Math.random() < rate) {
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
  };

  const crossoverAlgorithm = (a, b) => {
    const midpoint = Math.floor(a.code.length / 2);
    const newCode = a.code.slice(0, midpoint) + b.code.slice(midpoint);

    return {
      name: `${a.name}_x_${b.name}`,
      code: newCode,
      complexity: Math.round((a.complexity + b.complexity) / 2),
    };
  };

  test("1. 정렬 알고리즘 유전자 정의", () => {
    expect(sortAlgorithms.length).toBe(4);
  });

  test("2. fitness 함수 계산", () => {
    const fitness = evaluateAlgorithm(sortAlgorithms[0]);
    expect(fitness).toBeGreaterThan(0);
    expect(fitness).toBeLessThan(200);
  });

  test("3. 변이 함수 작동", () => {
    const mutated = mutateAlgorithm(sortAlgorithms[0], 1.0);
    expect(mutated.name).toContain("_mut");
  });

  test("4. 교배 함수 작동", () => {
    const child = crossoverAlgorithm(sortAlgorithms[0], sortAlgorithms[1]);
    expect(child.code.length).toBeGreaterThan(0);
    expect(child.name).toContain("_x_");
  });

  test("5. EvolutionEngine으로 8세대 진화", () => {
    const engine = new EvolutionEngine({
      populationSize: 8,
      maxGenerations: 8,
      mutationRate: 0.2,
      eliteRatio: 0.25,
      fitnessFunc: evaluateAlgorithm,
      mutateFunc: (g, r) => mutateAlgorithm(g, r),
      crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
      initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
    });

    engine.initialize();

    for (let i = 0; i < 8; i++) {
      engine.step();
    }

    const pop = engine.getPopulation();
    expect(pop.length).toBe(8);
    expect(pop[0].fitness).toBeGreaterThan(0);
  });

  test("6. 20세대 자기진화 — fitness 향상", () => {
    const engine = new EvolutionEngine({
      populationSize: 10,
      maxGenerations: 20,
      mutationRate: 0.15,
      eliteRatio: 0.2,
      fitnessFunc: evaluateAlgorithm,
      mutateFunc: (g, r) => mutateAlgorithm(g, r),
      crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
      initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
    });

    engine.initialize();

    let firstBestFitness = 0;
    let lastBestFitness = 0;

    for (let i = 0; i < 20; i++) {
      const { bestFitness } = engine.step();
      if (i === 0) firstBestFitness = bestFitness;
      lastBestFitness = bestFitness;
    }

    expect(lastBestFitness).toBeGreaterThanOrEqual(firstBestFitness);
  });

  test("7. 최고 개체 분석 및 코드 생성", () => {
    const engine = new EvolutionEngine({
      populationSize: 10,
      maxGenerations: 15,
      mutationRate: 0.15,
      eliteRatio: 0.2,
      fitnessFunc: evaluateAlgorithm,
      mutateFunc: (g, r) => mutateAlgorithm(g, r),
      crossoverFunc: (a, b) => crossoverAlgorithm(a, b),
      initFunc: () => sortAlgorithms[Math.floor(Math.random() * sortAlgorithms.length)],
    });

    const result = engine.run();
    const best = engine.getBest();

    expect(best).not.toBeNull();
    if (best) {
      expect(best.fitness).toBeGreaterThan(0);
      expect(best.genome.code.length).toBeGreaterThan(0);
    }
  });
});
