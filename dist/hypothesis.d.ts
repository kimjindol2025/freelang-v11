export type HypothesisVerdict = 'accepted' | 'rejected' | 'inconclusive';
export interface HypothesisResult {
    claim: string;
    verdict: HypothesisVerdict;
    confidence: number;
    evidence: any[];
    reasoning: string;
    iterations: number;
}
export interface HypothesisConfig {
    claim: string;
    test: (attempt: number) => any;
    evaluate: (evidence: any[]) => number;
    conclude?: (confidence: number) => HypothesisVerdict;
    maxAttempts?: number;
    threshold?: number;
}
export declare class HypothesisTester {
    test(config: HypothesisConfig): HypothesisResult;
    compete(hypotheses: HypothesisConfig[]): HypothesisResult;
}
export declare const globalTester: HypothesisTester;
//# sourceMappingURL=hypothesis.d.ts.map