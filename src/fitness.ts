// FreeLang v9 Fitness — 적합도 함수 모음
// Phase 134: [FITNESS] AI가 솔루션의 품질을 평가하는 적합도 함수

export interface FitnessResult {
  score: number;          // 0~1 정규화된 점수
  rawScore: number;       // 원점수
  rank?: number;          // 랭킹 (집합에서)
  percentile?: number;    // 백분위
  details: Record<string, number>; // 세부 점수
}

export interface FitnessConfig {
  weights?: Record<string, number>; // 가중치 맵
  normalize?: boolean;              // 0~1 정규화 여부 (기본 true)
  maximize?: boolean;               // true=높을수록 좋음, false=낮을수록 좋음
}

// 레벤슈타인 거리 계산
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export class FitnessEvaluator {
  private config: FitnessConfig;

  constructor(config: FitnessConfig = {}) {
    this.config = {
      normalize: config.normalize !== false,
      maximize: config.maximize !== false,
      weights: config.weights ?? {},
    };
  }

  // 숫자 근접도 (목표값에 얼마나 가까운가)
  proximity(value: number, target: number, tolerance?: number): FitnessResult {
    const diff = Math.abs(value - target);
    const tol = tolerance !== undefined ? tolerance : Math.abs(target) || 1;

    let rawScore: number;
    let score: number;

    if (tol === 0) {
      rawScore = diff === 0 ? 1 : 0;
      score = rawScore;
    } else {
      rawScore = Math.max(0, 1 - diff / tol);
      score = this.config.normalize !== false ? rawScore : rawScore;
    }

    if (this.config.maximize === false) {
      score = 1 - score;
    }

    return {
      score,
      rawScore,
      details: {
        diff,
        tolerance: tol,
        proximity: rawScore,
      },
    };
  }

  // 문자열 유사도 (레벤슈타인 거리 기반)
  stringSimilarity(a: string, b: string): FitnessResult {
    if (a.length === 0 && b.length === 0) {
      return { score: 1, rawScore: 1, details: { distance: 0, maxLen: 0 } };
    }
    const maxLen = Math.max(a.length, b.length);
    const dist = levenshtein(a, b);
    const rawScore = maxLen === 0 ? 1 : 1 - dist / maxLen;
    const score = this.config.maximize === false ? 1 - rawScore : rawScore;

    return {
      score,
      rawScore,
      details: {
        distance: dist,
        maxLen,
        similarity: rawScore,
      },
    };
  }

  // 배열 일치도
  arrayMatch<T>(arr: T[], target: T[]): FitnessResult {
    if (target.length === 0 && arr.length === 0) {
      return { score: 1, rawScore: 1, details: { matched: 0, total: 0 } };
    }
    const maxLen = Math.max(arr.length, target.length);
    let matched = 0;
    const minLen = Math.min(arr.length, target.length);
    for (let i = 0; i < minLen; i++) {
      if (JSON.stringify(arr[i]) === JSON.stringify(target[i])) matched++;
    }
    const rawScore = maxLen === 0 ? 1 : matched / maxLen;
    const score = this.config.maximize === false ? 1 - rawScore : rawScore;

    return {
      score,
      rawScore,
      details: {
        matched,
        total: maxLen,
        arrLen: arr.length,
        targetLen: target.length,
      },
    };
  }

  // 다목적 적합도 (여러 기준 가중합)
  multiObjective(
    values: Record<string, number>,
    targets: Record<string, number>,
    weights?: Record<string, number>
  ): FitnessResult {
    const keys = Object.keys(targets);
    if (keys.length === 0) {
      return { score: 1, rawScore: 1, details: {} };
    }

    const w = weights ?? this.config.weights ?? {};
    const details: Record<string, number> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const key of keys) {
      const val = values[key] ?? 0;
      const tgt = targets[key] ?? 0;
      const weight = w[key] ?? 1;
      const maxVal = Math.max(Math.abs(tgt), Math.abs(val), 1);
      const proximity = Math.max(0, 1 - Math.abs(val - tgt) / maxVal);
      details[key] = proximity;
      weightedSum += proximity * weight;
      totalWeight += weight;
    }

    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const score = this.config.maximize === false ? 1 - rawScore : rawScore;

    return { score, rawScore, details };
  }

  // 제약 만족도 (모든 제약 충족 시 1.0)
  constraintSatisfaction(
    value: unknown,
    constraints: Array<(v: unknown) => boolean>
  ): FitnessResult {
    if (constraints.length === 0) {
      return { score: 1, rawScore: 1, details: { satisfied: 0, total: 0 } };
    }

    let satisfied = 0;
    const details: Record<string, number> = {};
    for (let i = 0; i < constraints.length; i++) {
      const result = constraints[i](value) ? 1 : 0;
      details[`constraint_${i}`] = result;
      satisfied += result;
    }

    const rawScore = satisfied / constraints.length;
    const score = this.config.maximize === false ? 1 - rawScore : rawScore;

    return {
      score,
      rawScore,
      details: { ...details, satisfied, total: constraints.length },
    };
  }

  // 집합에서 랭킹
  rank<T>(items: T[], scorer: (item: T) => number): Array<T & { rank: number; score: number }> {
    const scored = items.map((item, idx) => ({ item, score: scorer(item), idx }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s, rankIdx) => ({
      ...(s.item as any),
      rank: rankIdx + 1,
      score: s.score,
    }));
  }

  // 파레토 최적 (다목적 최적화)
  paretoFront<T>(
    items: T[],
    objectives: Array<(item: T) => number>
  ): T[] {
    if (items.length === 0) return [];

    const dominated = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      if (dominated.has(i)) continue;
      for (let j = 0; j < items.length; j++) {
        if (i === j || dominated.has(j)) continue;
        // i가 j를 지배하는지 확인: 모든 목표에서 i >= j이고 적어도 하나에서 i > j
        const scores_i = objectives.map(f => f(items[i]));
        const scores_j = objectives.map(f => f(items[j]));
        const allGeq = scores_i.every((s, k) => s >= scores_j[k]);
        const someGt = scores_i.some((s, k) => s > scores_j[k]);
        if (allGeq && someGt) {
          dominated.add(j);
        }
      }
    }

    return items.filter((_, i) => !dominated.has(i));
  }
}

export const globalFitness = new FitnessEvaluator();

export function fitnessScore(value: number, target: number): number {
  return globalFitness.proximity(value, target).score;
}

export function rankItems<T>(
  items: T[],
  scores: number[]
): Array<{ item: T; rank: number; score: number }> {
  const paired = items.map((item, i) => ({ item, score: scores[i] ?? 0 }));
  paired.sort((a, b) => b.score - a.score);
  return paired.map((p, rankIdx) => ({ item: p.item, rank: rankIdx + 1, score: p.score }));
}
