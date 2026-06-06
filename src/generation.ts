// FreeLang v9 Generation — 세대별 진화 루프
// Phase 135: [GENERATION] 세대 단위로 진화를 관리하는 루프 시스템

export interface GenerationStats {
  generation: number;
  best: number;       // 최고 적합도
  worst: number;      // 최저 적합도
  average: number;    // 평균 적합도
  diversity: number;  // 다양성 지수 (0~1)
  elites: number;     // 엘리트 개체 수
  improved: boolean;  // 이전 세대 대비 개선 여부
}

export interface GenerationConfig {
  maxGenerations: number;   // 최대 세대 수
  targetFitness?: number;   // 목표 적합도 (조기 종료)
  stagnationLimit?: number; // 개선 없이 멈추는 세대 수 (기본 10)
  logInterval?: number;     // 로그 출력 간격 (기본 10)
  onGeneration?: (stats: GenerationStats) => void; // 세대 콜백
}

export interface GenerationResult<T> {
  best: T;
  bestFitness: number;
  totalGenerations: number;
  history: GenerationStats[];
  terminationReason: 'max-generations' | 'target-reached' | 'stagnation';
  improvementRatio: number; // 총 개선률
}

export class GenerationLoop<T> {
  private config: GenerationConfig;
  private statsHistory: GenerationStats[] = [];
  private stagnationCount: number = 0;
  private currentStats: GenerationStats | null = null;

  constructor(config: GenerationConfig) {
    this.config = {
      maxGenerations: config.maxGenerations,
      targetFitness: config.targetFitness,
      stagnationLimit: config.stagnationLimit ?? 10,
      logInterval: config.logInterval ?? 10,
      onGeneration: config.onGeneration,
    };
  }

  // 세대 루프 실행
  run(
    initialPopulation: T[],
    fitnessFunc: (item: T) => number,
    nextGenFunc: (population: T[], fitnesses: number[]) => T[]
  ): GenerationResult<T> {
    // 초기화
    this.statsHistory = [];
    this.stagnationCount = 0;
    this.currentStats = null;

    let population = [...initialPopulation];
    let fitnesses = population.map(fitnessFunc);

    let bestItem = population[0];
    let bestFitness = fitnesses[0] ?? -Infinity;

    // 초기 best 탐색
    for (let i = 0; i < population.length; i++) {
      if (fitnesses[i] > bestFitness) {
        bestFitness = fitnesses[i];
        bestItem = population[i];
      }
    }

    const initialBest = bestFitness;
    let previousBest = -Infinity;
    let terminationReason: 'max-generations' | 'target-reached' | 'stagnation' = 'max-generations';

    for (let gen = 0; gen < this.config.maxGenerations; gen++) {
      // 현재 세대 통계 계산
      const stats = this._computeStats(gen, fitnesses, previousBest);
      this.statsHistory.push(stats);
      this.currentStats = stats;

      // 현재 best 업데이트
      for (let i = 0; i < population.length; i++) {
        if (fitnesses[i] > bestFitness) {
          bestFitness = fitnesses[i];
          bestItem = population[i];
        }
      }

      // 콜백
      if (this.config.onGeneration) {
        this.config.onGeneration(stats);
      }

      // 조기 종료: 목표 달성
      if (this.config.targetFitness !== undefined && bestFitness >= this.config.targetFitness) {
        terminationReason = 'target-reached';
        break;
      }

      // 정체 카운트 업데이트
      if (stats.improved) {
        this.stagnationCount = 0;
      } else {
        this.stagnationCount++;
      }

      // 조기 종료: 정체
      const stagnationLimit = this.config.stagnationLimit ?? 10;
      if (this.stagnationCount >= stagnationLimit) {
        terminationReason = 'stagnation';
        break;
      }

      previousBest = stats.best;

      // 다음 세대 생성 (마지막 세대는 생략)
      if (gen < this.config.maxGenerations - 1) {
        population = nextGenFunc(population, fitnesses);
        fitnesses = population.map(fitnessFunc);
      }
    }

    // 개선률 계산
    const improvementRatio = initialBest === 0
      ? (bestFitness - initialBest)
      : Math.abs((bestFitness - initialBest) / Math.abs(initialBest === 0 ? 1 : initialBest));

    return {
      best: bestItem,
      bestFitness,
      totalGenerations: this.statsHistory.length,
      history: [...this.statsHistory],
      terminationReason,
      improvementRatio,
    };
  }

  // 현재 통계
  getCurrentStats(): GenerationStats | null {
    return this.currentStats;
  }

  // 전체 히스토리
  getHistory(): GenerationStats[] {
    return [...this.statsHistory];
  }

  // 다양성 계산 (숫자 배열 기준)
  calculateDiversity(fitnesses: number[]): number {
    if (fitnesses.length <= 1) return 0;
    const min = Math.min(...fitnesses);
    const max = Math.max(...fitnesses);
    const range = max - min;
    if (range === 0) return 0;

    // 표준편차 기반 다양성 (0~1 정규화)
    const mean = fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length;
    const variance = fitnesses.reduce((s, v) => s + (v - mean) ** 2, 0) / fitnesses.length;
    const stdDev = Math.sqrt(variance);

    // range 대비 stdDev 비율 (0~1)
    const diversity = Math.min(1, stdDev / (range + 1e-9));
    return diversity;
  }

  // 진화 수렴 여부 (마지막 5세대 best가 변화 없으면 수렴)
  hasConverged(): boolean {
    if (this.statsHistory.length < 5) return false;
    const recent = this.statsHistory.slice(-5);
    const firstBest = recent[0].best;
    return recent.every(s => Math.abs(s.best - firstBest) < 1e-9);
  }

  // 내부: 세대 통계 계산
  private _computeStats(gen: number, fitnesses: number[], previousBest: number): GenerationStats {
    if (fitnesses.length === 0) {
      return { generation: gen, best: 0, worst: 0, average: 0, diversity: 0, elites: 0, improved: false };
    }

    const best = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const average = fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length;
    const diversity = this.calculateDiversity(fitnesses);
    const elites = Math.max(1, Math.floor(fitnesses.length * 0.1));
    const improved = gen === 0 ? true : best > previousBest;

    return { generation: gen, best, worst, average, diversity, elites, improved };
  }
}

// 편의 함수: 간단한 세대 루프
export function runGeneration<T>(
  population: T[],
  fitness: (item: T) => number,
  next: (pop: T[], fits: number[]) => T[],
  maxGen: number = 50
): GenerationResult<T> {
  const loop = new GenerationLoop<T>({ maxGenerations: maxGen });
  return loop.run(population, fitness, next);
}
