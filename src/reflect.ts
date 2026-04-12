// reflect.ts — FreeLang v9 Phase 94: REFLECT 자기 평가/반성 시스템
// AI가 자신의 출력을 스스로 평가하고 개선하는 네이티브 언어 사이클

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ReflectionCriteria {
  name: string;
  check: (output: any) => number; // 0~1 점수
  weight?: number;                 // 가중치 (기본 1)
}

export interface ReflectionResult {
  output: any;                       // 원본 출력
  scores: Record<string, number>;    // 기준별 점수
  totalScore: number;                // 가중 평균
  passed: boolean;                   // threshold 통과 여부
  feedback: string[];                // 개선 제안
  revised?: any;                     // 수정된 출력 (있으면)
}

// ─── 기본 기준들 ─────────────────────────────────────────────────────────────

export const CRITERIA: Record<string, ReflectionCriteria> = {
  "not-null": {
    name: "not-null",
    check: (v: any) => (v != null ? 1 : 0),
    weight: 1,
  },
  "not-empty": {
    name: "not-empty",
    check: (v: any) => (v != null && String(v).length > 0 ? 1 : 0),
    weight: 1,
  },
  "is-number": {
    name: "is-number",
    check: (v: any) => (typeof v === "number" && !isNaN(v) ? 1 : 0),
    weight: 1,
  },
  "positive": {
    name: "positive",
    check: (v: any) => (typeof v === "number" && v > 0 ? 1 : 0),
    weight: 1,
  },
  "confidence": {
    name: "confidence",
    check: (v: any) => {
      if (v?._tag === "Maybe" && typeof v.confidence === "number") {
        return v.confidence;
      }
      return 1;
    },
    weight: 1,
  },
};

// ─── Reflector 클래스 ────────────────────────────────────────────────────────

export class Reflector {
  private criteriaList: ReflectionCriteria[] = [];

  addCriteria(c: ReflectionCriteria): this {
    this.criteriaList.push(c);
    return this;
  }

  reflect(output: any, threshold: number = 0.7): ReflectionResult {
    const scores: Record<string, number> = {};
    const feedback: string[] = [];

    // criteria가 없으면 바로 통과
    if (this.criteriaList.length === 0) {
      return {
        output,
        scores: {},
        totalScore: 1,
        passed: true,
        feedback: [],
      };
    }

    let totalWeight = 0;
    let weightedSum = 0;

    for (const c of this.criteriaList) {
      let score: number;
      try {
        score = c.check(output);
        // 0~1 범위 클리핑
        score = Math.max(0, Math.min(1, score));
      } catch {
        score = 0;
      }
      scores[c.name] = score;

      const weight = c.weight ?? 1;
      totalWeight += weight;
      weightedSum += score * weight;

      // 점수가 낮으면 피드백 생성
      if (score < threshold) {
        feedback.push(`[${c.name}] score=${score.toFixed(2)} — 기준 미달 (threshold=${threshold})`);
      }
    }

    const totalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = totalScore >= threshold;

    return {
      output,
      scores,
      totalScore,
      passed,
      feedback,
    };
  }

  revise(result: ReflectionResult, reviseFn: (r: ReflectionResult) => any): ReflectionResult {
    const revised = reviseFn(result);
    return {
      ...result,
      revised,
    };
  }

  toMarkdown(): string {
    const lines: string[] = [];
    lines.push("# Reflector 평가 기준");
    lines.push("");
    if (this.criteriaList.length === 0) {
      lines.push("- (기준 없음)");
    } else {
      for (const c of this.criteriaList) {
        lines.push(`- **${c.name}** (weight=${c.weight ?? 1})`);
      }
    }
    return lines.join("\n");
  }

  // 현재 기준 목록 반환 (테스트용)
  getCriteriaList(): ReflectionCriteria[] {
    return this.criteriaList;
  }
}

// ─── FL 인터프리터용 REFLECT 폼 평가 ────────────────────────────────────────

export interface ReflectFormOptions {
  output: any;
  criteria: Array<(v: any) => number>;
  threshold?: number;
  onFail?: (result: ReflectionResult) => any;
  revise?: (result: ReflectionResult) => any;
}

export function evalReflectForm(opts: ReflectFormOptions): ReflectionResult {
  const { output, criteria, threshold = 0.7, onFail, revise } = opts;

  const reflector = new Reflector();

  // 인라인 함수들을 기준으로 등록
  criteria.forEach((fn, i) => {
    reflector.addCriteria({
      name: `criteria-${i}`,
      check: fn,
      weight: 1,
    });
  });

  let result = reflector.reflect(output, threshold);

  // threshold 미달 시 on-fail 실행
  if (!result.passed && onFail) {
    const failResult = onFail(result);
    result = {
      ...result,
      revised: failResult,
    };
  }

  // revise 함수 실행 (통과 여부와 관계없이)
  if (revise) {
    result = reflector.revise(result, revise);
  }

  return result;
}
