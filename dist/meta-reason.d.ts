export type ReasoningStrategy = 'COT' | 'TOT' | 'REFLECT' | 'HYPOTHESIS' | 'DEBATE' | 'DIRECT';
export interface StrategyScore {
    strategy: ReasoningStrategy;
    score: number;
    reason: string;
}
export interface MetaReasonResult {
    problem: string;
    selected: ReasoningStrategy;
    scores: StrategyScore[];
    rationale: string;
}
export declare class MetaReasoner {
    private strategies;
    constructor(strategies?: ReasoningStrategy[]);
    analyze(problem: string): MetaReasonResult;
    addStrategy(strategy: ReasoningStrategy): void;
    getStrategies(): ReasoningStrategy[];
}
export declare const globalMetaReasoner: MetaReasoner;
//# sourceMappingURL=meta-reason.d.ts.map