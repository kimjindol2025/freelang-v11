// FreeLang v9 Evolve — 유전 알고리즘 진화 엔진
// Phase 131: [EVOLVE] AI가 진화 알고리즘으로 더 나은 코드/해답을 찾는다

import { randomUUID } from "crypto";

export interface Individual<T> {
  genome: T;
  fitness: number;
  generation: number;
  id: string;
}

export interface EvolutionConfig<T> {
  populationSize: number;     // 개체군 크기 (기본 20)
  maxGenerations: number;     // 최대 세대 (기본 50)
  mutationRate: number;       // 변이율 (기본 0.1)
  eliteRatio: number;         // 엘리트 비율 (기본 0.1)
  fitnessGoal?: number;       // 목표 적합도 (달성 시 조기 종료)
  fitnessFunc: (genome: T) => number;
  mutateFunc: (genome: T, rate: number) => T;
  crossoverFunc: (a: T, b: T) => T;
  initFunc: () => T;
}

export interface EvolutionResult<T> {
  best: Individual<T>;
  population: Individual<T>[];
  generations: number;
  converged: boolean;
  history: Array<{ gen: number; bestFitness: number; avgFitness: number }>;
}

export class EvolutionEngine<T> {
  private config: EvolutionConfig<T>;
  private population: Individual<T>[] = [];
  private currentGeneration: number = 0;
  private history: Array<{ gen: number; bestFitness: number; avgFitness: number }> = [];

  constructor(config: EvolutionConfig<T>) {
    this.config = {
      populationSize: config.populationSize ?? 20,
      maxGenerations: config.maxGenerations ?? 50,
      mutationRate: config.mutationRate ?? 0.1,
      eliteRatio: config.eliteRatio ?? 0.1,
      fitnessGoal: config.fitnessGoal,
      fitnessFunc: config.fitnessFunc,
      mutateFunc: config.mutateFunc,
      crossoverFunc: config.crossoverFunc,
      initFunc: config.initFunc,
    };
  }

  // 개체군 초기화
  initialize(): void {
    this.population = [];
    this.currentGeneration = 0;
    this.history = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = this.config.initFunc();
      const fitness = this.config.fitnessFunc(genome);
      this.population.push({
        genome,
        fitness,
        generation: 0,
        id: randomUUID(),
      });
    }
  }

  // 자연선택 (토너먼트 선택)
  select(): Individual<T> {
    const tournamentSize = Math.max(2, Math.floor(this.population.length * 0.2));
    const tournament: Individual<T>[] = [];

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }

    // 가장 높은 fitness 선택
    return tournament.reduce((best, ind) =>
      ind.fitness > best.fitness ? ind : best
    );
  }

  // 한 세대 진행
  step(): { bestFitness: number; avgFitness: number } {
    if (this.population.length === 0) {
      throw new Error("Population not initialized. Call initialize() first.");
    }

    // 현재 세대 정렬 (fitness 내림차순)
    this.population.sort((a, b) => b.fitness - a.fitness);

    const eliteCount = Math.max(1, Math.floor(this.config.populationSize * this.config.eliteRatio));
    const elites = this.population.slice(0, eliteCount).map(ind => ({ ...ind }));

    // 새 개체군 생성
    const newPop: Individual<T>[] = [...elites];

    while (newPop.length < this.config.populationSize) {
      const parent1 = this.select();
      const parent2 = this.select();

      // 교배
      let childGenome = this.config.crossoverFunc(parent1.genome, parent2.genome);

      // 변이
      childGenome = this.config.mutateFunc(childGenome, this.config.mutationRate);

      const fitness = this.config.fitnessFunc(childGenome);
      newPop.push({
        genome: childGenome,
        fitness,
        generation: this.currentGeneration + 1,
        id: randomUUID(),
      });
    }

    this.population = newPop;
    this.currentGeneration++;

    const bestFitness = this.population[0]?.fitness ?? 0;
    const avgFitness = this.population.reduce((s, ind) => s + ind.fitness, 0) / this.population.length;

    this.history.push({ gen: this.currentGeneration, bestFitness, avgFitness });

    return { bestFitness, avgFitness };
  }

  // 전체 진화 실행
  run(): EvolutionResult<T> {
    if (this.population.length === 0) {
      this.initialize();
    }

    let converged = false;

    for (let g = 0; g < this.config.maxGenerations; g++) {
      this.step();

      const best = this.getBest();
      if (best && this.config.fitnessGoal !== undefined && best.fitness >= this.config.fitnessGoal) {
        converged = true;
        break;
      }
    }

    const best = this.getBest()!;
    return {
      best,
      population: [...this.population],
      generations: this.currentGeneration,
      converged,
      history: [...this.history],
    };
  }

  // 현재 최고 개체
  getBest(): Individual<T> | null {
    if (this.population.length === 0) return null;
    return this.population.reduce((best, ind) =>
      ind.fitness > best.fitness ? ind : best
    );
  }

  // 현재 개체군
  getPopulation(): Individual<T>[] {
    return [...this.population];
  }

  // 히스토리 반환
  getHistory(): Array<{ gen: number; bestFitness: number; avgFitness: number }> {
    return [...this.history];
  }
}

// 숫자 배열 진화 (기본 예시 — 타겟 배열에 수렴)
export function evolveNumbers(
  target: number[],
  populationSize: number = 20,
  maxGenerations: number = 50
): EvolutionResult<number[]> {
  const config: EvolutionConfig<number[]> = {
    populationSize,
    maxGenerations,
    mutationRate: 0.2,
    eliteRatio: 0.1,
    fitnessGoal: 0,  // 음의 MSE → 0에 수렴하면 완벽

    fitnessFunc: (genome: number[]) => {
      // 음의 MSE (0에 가까울수록 좋음, 최대 0)
      const mse = genome.reduce((sum, v, i) => {
        const diff = v - (target[i] ?? 0);
        return sum + diff * diff;
      }, 0) / genome.length;
      return -mse;
    },

    mutateFunc: (genome: number[], rate: number) => {
      return genome.map(v => {
        if (Math.random() < rate) {
          return v + (Math.random() - 0.5) * 2;
        }
        return v;
      });
    },

    crossoverFunc: (a: number[], b: number[]) => {
      const point = Math.floor(Math.random() * Math.min(a.length, b.length));
      return [...a.slice(0, point), ...b.slice(point)];
    },

    initFunc: () => {
      return target.map(() => (Math.random() - 0.5) * 20);
    },
  };

  const engine = new EvolutionEngine<number[]>(config);
  return engine.run();
}

// 문자열 진화 (타겟 문자열에 수렴)
export function evolveStrings(
  target: string,
  populationSize: number = 30,
  maxGenerations: number = 100
): EvolutionResult<string> {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !.,";

  const config: EvolutionConfig<string> = {
    populationSize,
    maxGenerations,
    mutationRate: 0.05,
    eliteRatio: 0.1,
    fitnessGoal: 0,  // 음의 거리 → 0이 완벽

    fitnessFunc: (genome: string) => {
      // 각 문자별 거리 합 (음수, 0에 가까울수록 좋음)
      let score = 0;
      for (let i = 0; i < Math.max(genome.length, target.length); i++) {
        const gc = genome.charCodeAt(i) || 0;
        const tc = target.charCodeAt(i) || 0;
        score -= Math.abs(gc - tc);
      }
      return score;
    },

    mutateFunc: (genome: string, rate: number) => {
      let result = genome;
      for (let i = 0; i < result.length; i++) {
        if (Math.random() < rate) {
          const newChar = chars[Math.floor(Math.random() * chars.length)];
          result = result.slice(0, i) + newChar + result.slice(i + 1);
        }
      }
      return result;
    },

    crossoverFunc: (a: string, b: string) => {
      const len = Math.max(a.length, b.length);
      const point = Math.floor(Math.random() * len);
      return a.slice(0, point) + b.slice(point);
    },

    initFunc: () => {
      return Array.from({ length: target.length }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    },
  };

  const engine = new EvolutionEngine<string>(config);
  return engine.run();
}
