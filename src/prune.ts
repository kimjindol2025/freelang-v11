// FreeLang v9 Prune — 쓸모없는 것 자동 제거
// Phase 136: [PRUNE] AI가 저품질/불필요한 항목을 자동 제거한다

export type PruneStrategy = 'threshold' | 'top-k' | 'top-percent' | 'pareto' | 'diversity';

export interface PruneConfig {
  strategy: PruneStrategy;
  threshold?: number;     // threshold 전략: 이 값 미만 제거
  k?: number;             // top-k 전략: 상위 k개만 유지
  percent?: number;       // top-percent 전략: 상위 N% 유지
  minDiversity?: number;  // diversity 전략: 최소 다양성
}

export interface PruneResult<T> {
  kept: T[];              // 유지된 항목
  removed: T[];           // 제거된 항목
  keptRatio: number;      // 유지 비율
  strategy: PruneStrategy;
  stats: {
    originalCount: number;
    keptCount: number;
    removedCount: number;
    avgFitnessKept: number;
    avgFitnessRemoved: number;
  };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildResult<T>(
  kept: T[],
  removed: T[],
  scorer: (item: T) => number | null,
  strategy: PruneStrategy,
  originalCount: number
): PruneResult<T> {
  const keptFitness = scorer ? kept.map(scorer).filter((n): n is number => n !== null) : [];
  const removedFitness = scorer ? removed.map(scorer).filter((n): n is number => n !== null) : [];
  const total = kept.length + removed.length;
  return {
    kept,
    removed,
    keptRatio: total === 0 ? 1 : kept.length / total,
    strategy,
    stats: {
      originalCount,
      keptCount: kept.length,
      removedCount: removed.length,
      avgFitnessKept: average(keptFitness),
      avgFitnessRemoved: average(removedFitness),
    },
  };
}

export class Pruner<T> {
  private config: Partial<PruneConfig>;

  constructor(config?: Partial<PruneConfig>) {
    this.config = config ?? {};
  }

  // 임계값 기반 제거: score < threshold 이면 제거
  pruneByThreshold(items: T[], scorer: (item: T) => number, threshold: number): PruneResult<T> {
    const original = [...items];
    const kept: T[] = [];
    const removed: T[] = [];
    for (const item of original) {
      if (scorer(item) >= threshold) kept.push(item);
      else removed.push(item);
    }
    return buildResult(kept, removed, scorer, 'threshold', original.length);
  }

  // 상위 K개만 유지
  pruneToTopK(items: T[], scorer: (item: T) => number, k: number): PruneResult<T> {
    const original = [...items];
    const sorted = [...original].sort((a, b) => scorer(b) - scorer(a));
    const effectiveK = Math.min(k, original.length);
    const kept = sorted.slice(0, effectiveK);
    const keptSet = new Set(kept);
    const removed = original.filter(item => !keptSet.has(item));
    return buildResult(kept, removed, scorer, 'top-k', original.length);
  }

  // 상위 N% 유지 (최소 1개)
  pruneToTopPercent(items: T[], scorer: (item: T) => number, percent: number): PruneResult<T> {
    const original = [...items];
    const k = Math.max(1, Math.ceil(original.length * percent));
    return this.pruneToTopK(original, scorer, k);
  }

  // 다양성 기반 제거 (너무 유사한 것 제거)
  pruneForDiversity(
    items: T[],
    scorer: (item: T) => number,
    similarity: (a: T, b: T) => number,
    minDiversity: number
  ): PruneResult<T> {
    const original = [...items];
    if (original.length === 0) {
      return buildResult([], [], scorer, 'diversity', 0);
    }

    // 점수 내림차순 정렬
    const sorted = [...original].sort((a, b) => scorer(b) - scorer(a));
    const kept: T[] = [];

    for (const candidate of sorted) {
      // 이미 kept에 있는 항목들과 너무 유사하면 제거
      const tooSimilar = kept.some(existing => similarity(candidate, existing) > (1 - minDiversity));
      if (!tooSimilar) {
        kept.push(candidate);
      }
    }

    const keptSet = new Set(kept);
    const removed = original.filter(item => !keptSet.has(item));
    return buildResult(kept, removed, scorer, 'diversity', original.length);
  }

  // 중복 제거 (정확히 같은 것)
  dedup(items: T[], key?: (item: T) => string): PruneResult<T> {
    const original = [...items];
    const seen = new Set<string>();
    const kept: T[] = [];
    const removed: T[] = [];

    for (const item of original) {
      const k = key ? key(item) : JSON.stringify(item);
      if (!seen.has(k)) {
        seen.add(k);
        kept.push(item);
      } else {
        removed.push(item);
      }
    }

    // dedup은 scorer가 없으므로 null scorer 사용
    return buildResult(kept, removed, () => 0, 'threshold', original.length);
  }

  // 약한 개체 제거 (평균 이하)
  pruneWeak(items: T[], scorer: (item: T) => number): PruneResult<T> {
    const original = [...items];
    if (original.length === 0) {
      return buildResult([], [], scorer, 'threshold', 0);
    }
    const scores = original.map(scorer);
    const avg = average(scores);
    const kept: T[] = [];
    const removed: T[] = [];
    for (let i = 0; i < original.length; i++) {
      if (scores[i] >= avg) kept.push(original[i]);
      else removed.push(original[i]);
    }
    return buildResult(kept, removed, scorer, 'threshold', original.length);
  }

  // 자동 전략 적용 (설정된 전략 사용, 기본값 top-k with k=10)
  prune(items: T[], scorer: (item: T) => number): PruneResult<T> {
    const strategy = this.config.strategy ?? 'top-k';
    switch (strategy) {
      case 'threshold':
        return this.pruneByThreshold(items, scorer, this.config.threshold ?? 0.5);
      case 'top-k':
        return this.pruneToTopK(items, scorer, this.config.k ?? 10);
      case 'top-percent':
        return this.pruneToTopPercent(items, scorer, this.config.percent ?? 0.5);
      case 'diversity':
        return this.pruneForDiversity(
          items, scorer,
          (a, b) => (a === b ? 1 : 0),
          this.config.minDiversity ?? 0.2
        );
      default:
        return this.pruneWeak(items, scorer);
    }
  }
}

export const globalPruner: Pruner<unknown> = new Pruner<unknown>();

export function keepBest<T>(items: T[], scorer: (item: T) => number, k: number): T[] {
  const sorted = [...items].sort((a, b) => scorer(b) - scorer(a));
  return sorted.slice(0, Math.min(k, items.length));
}

export function removeWeak<T>(items: T[], scorer: (item: T) => number): T[] {
  const scores = items.map(scorer);
  const avg = average(scores);
  return items.filter((_, i) => scores[i] >= avg);
}
