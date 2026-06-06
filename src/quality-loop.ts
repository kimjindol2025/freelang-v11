// FreeLang v9 Quality Evaluation Loop
// Phase 106: 자동 품질 평가 루프
// (quality-check output criteria-list) → QualityResult
// (quality-loop :generate fn :evaluate fn :threshold 0.8 :max-rounds 3)

export interface QualityCriterion {
  name: string;
  weight: number;           // 0.0~1.0
  evaluate: (output: any) => number; // 0.0~1.0
}

export interface QualityResult {
  score: number;            // 가중 평균
  passed: boolean;
  breakdown: Record<string, number>;  // 기준별 점수
  feedback: string[];
}

export interface QualityLoopResult<T> {
  output: T;
  rounds: number;
  finalScore: number;
  passed: boolean;
  history: Array<{ round: number; output: T; score: number }>;
}

// 품질 평가
export function evaluateQuality(output: any, criteria: QualityCriterion[], threshold = 0.7): QualityResult {
  let totalWeight = 0;
  let weightedScore = 0;
  const breakdown: Record<string, number> = {};
  const feedback: string[] = [];

  for (const c of criteria) {
    const score = Math.max(0, Math.min(1, c.evaluate(output)));
    breakdown[c.name] = score;
    weightedScore += score * c.weight;
    totalWeight += c.weight;
    if (score < threshold) {
      feedback.push(`${c.name}: ${(score * 100).toFixed(0)}% (기준 미달)`);
    }
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return {
    score: finalScore,
    passed: finalScore >= threshold,
    breakdown,
    feedback
  };
}

// 품질 루프: 기준 충족할 때까지 재생성
export async function qualityLoop<T>(config: {
  generate: (round: number, prevOutput?: T, prevResult?: QualityResult) => T | Promise<T>;
  criteria: QualityCriterion[];
  threshold?: number;
  maxRounds?: number;
}): Promise<QualityLoopResult<T>> {
  const { generate, criteria, threshold = 0.7, maxRounds = 3 } = config;
  const history: QualityLoopResult<T>['history'] = [];
  let output!: T;
  let finalScore = 0;
  let passed = false;
  let prevOutput: T | undefined;
  let prevResult: QualityResult | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    output = await Promise.resolve(generate(round, prevOutput, prevResult));
    const result = evaluateQuality(output, criteria, threshold);
    finalScore = result.score;
    passed = result.passed;
    history.push({ round, output, score: finalScore });

    if (passed) break;
    prevOutput = output;
    prevResult = result;
  }

  return { output, rounds: history.length, finalScore, passed, history };
}

// 기본 품질 기준들
export const defaultCriteria: QualityCriterion[] = [
  {
    name: 'length',
    weight: 0.3,
    evaluate: (v) => {
      const s = String(v);
      if (s.length < 10) return 0.3;
      if (s.length < 50) return 0.7;
      return 1.0;
    }
  },
  {
    name: 'non-empty',
    weight: 0.4,
    evaluate: (v) => (v !== null && v !== undefined && v !== '') ? 1.0 : 0.0
  },
  {
    name: 'no-error',
    weight: 0.3,
    evaluate: (v) => (v instanceof Error || (typeof v === 'object' && v?._tag === 'Err')) ? 0.0 : 1.0
  }
];
