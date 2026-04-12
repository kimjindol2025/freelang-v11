export interface Scenario {
    id: string;
    name: string;
    variables: Record<string, unknown>;
    outcome: unknown;
}
export interface Counterfactual {
    id: string;
    baseScenario: Scenario;
    intervention: Record<string, unknown>;
    counterfactualOutcome: unknown;
    delta: Record<string, unknown>;
    probability: number;
    explanation: string;
}
export interface CounterfactualAnalysis {
    original: Scenario;
    counterfactuals: Counterfactual[];
    mostLikelyAlternative: Counterfactual;
    keyFactors: string[];
    sensitivity: Record<string, number>;
}
export declare class CounterfactualReasoner {
    private scenarios;
    registerScenario(scenario: Scenario): void;
    createCounterfactual(scenarioId: string, intervention: Record<string, unknown>, outcomeFunc: (vars: Record<string, unknown>) => unknown): Counterfactual;
    analyze(scenarioId: string, interventions: Array<Record<string, unknown>>, outcomeFunc: (vars: Record<string, unknown>) => unknown): CounterfactualAnalysis;
    whatIf(variables: Record<string, unknown>, change: Record<string, unknown>, outcomeFunc: (vars: Record<string, unknown>) => unknown): Counterfactual;
    findMinimalIntervention(scenarioId: string, targetOutcome: unknown, outcomeFunc: (vars: Record<string, unknown>) => unknown): Record<string, unknown> | null;
    sensitivityAnalysis(variables: Record<string, unknown>, outcomeFunc: (vars: Record<string, unknown>) => number): Record<string, number>;
}
export declare const globalCounterfactual: CounterfactualReasoner;
//# sourceMappingURL=counterfactual.d.ts.map