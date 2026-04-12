export interface FeatureImportance {
    feature: string;
    importance: number;
    direction: 'positive' | 'negative';
    description: string;
}
export interface DecisionExplanation {
    decision: unknown;
    reasoning: string[];
    features: FeatureImportance[];
    confidence: number;
    alternatives: Array<{
        decision: unknown;
        reason: string;
        probability: number;
    }>;
    summary: string;
    audience: 'technical' | 'general';
}
export interface LocalExplanation {
    input: Record<string, unknown>;
    output: unknown;
    topFactors: FeatureImportance[];
    counterfactual: string;
    confidence: number;
}
export declare class Explainer {
    /**
     * 결정 설명 — factors로부터 reasoning, features, alternatives를 생성
     */
    explain(decision: unknown, factors: Record<string, number>, context?: string): DecisionExplanation;
    /**
     * 특성 중요도 계산 (SHAP-like 방식)
     * baseline과의 차이로 각 입력 특성의 기여도를 계산
     */
    featureImportance(inputs: Record<string, number>, outputs: Record<string, number>, baselineOutputs?: Record<string, number>): FeatureImportance[];
    /**
     * 로컬 설명 — 단일 예측에 대한 설명
     */
    localExplain(input: Record<string, unknown>, output: unknown, model: (input: Record<string, unknown>) => unknown): LocalExplanation;
    /**
     * 자연어 설명 생성
     */
    toNaturalLanguage(explanation: DecisionExplanation, audience?: 'technical' | 'general'): string;
    /**
     * 대조 설명 ("A가 아니라 B인 이유")
     */
    contrastiveExplain(decision: unknown, alternative: unknown, factors: Record<string, number>): string;
    /**
     * 규칙 추출 — 입력/출력 예시에서 간단한 if-then 규칙 추출
     */
    extractRules(examples: Array<{
        input: Record<string, unknown>;
        output: unknown;
    }>): Array<{
        condition: string;
        outcome: unknown;
        support: number;
    }>;
}
export declare const globalExplainer: Explainer;
//# sourceMappingURL=explain.d.ts.map