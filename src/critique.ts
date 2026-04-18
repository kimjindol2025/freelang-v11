// FreeLang v9 Critique — 자기 출력 비판 에이전트
// Phase 118: [CRITIQUE :output $x :find-weaknesses fn :find-counterexamples fn :severity fn]

export type Severity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface CritiquePoint {
  type: 'weakness' | 'counterexample' | 'assumption' | 'missing';
  description: string;
  severity: Severity;
  suggestion?: string;
}

export interface CritiqueResult {
  output: any;
  points: CritiquePoint[];
  overallRisk: number;      // 0~1, 높을수록 위험
  approved: boolean;        // critical/major가 없으면 true
  summary: string;
}

export interface CritiqueConfig {
  finders: Array<(output: any) => CritiquePoint[]>;  // 문제 찾는 함수들
  riskThreshold?: number;  // 이 이상이면 approved=false (default: 0.5)
}

export function severityWeight(s: Severity): number {
  return { critical: 1.0, major: 0.7, minor: 0.3, suggestion: 0.1 }[s];
}

export class CritiqueAgent {
  run(output: any, config: CritiqueConfig): CritiqueResult {
    const { finders, riskThreshold = 0.5 } = config;
    const points: CritiquePoint[] = finders.flatMap(f => {
      try { return f(output); } catch { return []; }
    });

    const totalRisk = points.length === 0 ? 0
      : points.reduce((s, p) => s + severityWeight(p.severity), 0) / (points.length * 1.0);
    const overallRisk = Math.min(1, totalRisk);
    const approved = overallRisk < riskThreshold && !points.some(p => p.severity === 'critical');

    const criticals = points.filter(p => p.severity === 'critical').length;
    const majors = points.filter(p => p.severity === 'major').length;
    const summary = points.length === 0
      ? '비판할 점 없음 — 통과'
      : `${points.length}개 문제 발견 (critical: ${criticals}, major: ${majors}), 위험도: ${(overallRisk*100).toFixed(0)}%`;

    return { output, points, overallRisk, approved, summary };
  }
}

// 기본 비판 파인더들
export const defaultFinders: Array<(output: any) => CritiquePoint[]> = [
  // 빈 출력
  (output: any): CritiquePoint[] => {
    if (output === null || output === undefined || output === '') {
      return [{ type: 'missing', description: '출력이 비어있음', severity: 'critical' }];
    }
    return [];
  },
  // 너무 짧은 출력
  (output: any): CritiquePoint[] => {
    if (typeof output === 'string' && output.length > 0 && output.length < 5) {
      return [{ type: 'weakness', description: '출력이 너무 짧음', severity: 'minor', suggestion: '더 구체적으로 서술' }];
    }
    return [];
  },
  // 에러 객체
  (output: any): CritiquePoint[] => {
    if (output instanceof Error || (typeof output === 'object' && output !== null && output?._tag === 'Err')) {
      return [{ type: 'weakness', description: '에러 값이 출력됨', severity: 'major' }];
    }
    return [];
  },
];

export const globalCritique = new CritiqueAgent();
