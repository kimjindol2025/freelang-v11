// FreeLang v9 Hypothesis — 가설 검증 시스템
// Phase 111: [HYPOTHESIS] 가설 설정 + 검증 + 채택/기각 블록
// [HYPOTHESIS :claim "..." :test fn :evidence fn :conclude fn]

export type HypothesisVerdict = 'accepted' | 'rejected' | 'inconclusive';

export interface HypothesisResult {
  claim: string;
  verdict: HypothesisVerdict;
  confidence: number;     // 0.0~1.0
  evidence: any[];        // 수집된 증거
  reasoning: string;
  iterations: number;
}

export interface HypothesisConfig {
  claim: string;                              // 가설 문장
  test: (attempt: number) => any;             // 테스트 함수 (증거 수집)
  evaluate: (evidence: any[]) => number;      // 증거 → 신뢰도 (0~1)
  conclude?: (confidence: number) => HypothesisVerdict;  // 기본: 0.7↑=accepted, 0.3↓=rejected
  maxAttempts?: number;                       // 최대 시도 (default: 3)
  threshold?: number;                         // 채택 기준 (default: 0.7)
}

export class HypothesisTester {
  test(config: HypothesisConfig): HypothesisResult {
    const {
      claim,
      test,
      evaluate,
      maxAttempts = 3,
      threshold = 0.7,
      conclude = (c) => c >= threshold ? 'accepted' : c <= (1 - threshold) ? 'rejected' : 'inconclusive'
    } = config;

    const evidence: any[] = [];
    let confidence = 0;
    let iterations = 0;

    for (let i = 0; i < maxAttempts; i++) {
      iterations++;
      const result = test(i);
      evidence.push(result);
      confidence = evaluate(evidence);
      // 조기 종료: 이미 명확하면
      if (confidence >= threshold || confidence <= 1 - threshold) break;
    }

    const verdict = conclude(confidence);
    const reasoning = `${iterations}회 테스트, 신뢰도 ${(confidence * 100).toFixed(0)}% → ${verdict}`;

    return { claim, verdict, confidence, evidence, reasoning, iterations };
  }

  // 여러 가설 중 가장 신뢰도 높은 것 선택
  compete(hypotheses: HypothesisConfig[]): HypothesisResult {
    const results = hypotheses.map(h => this.test(h));
    return results.reduce((best, curr) => curr.confidence > best.confidence ? curr : best);
  }
}

export const globalTester = new HypothesisTester();
