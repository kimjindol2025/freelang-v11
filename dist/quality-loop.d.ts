export interface QualityCriterion {
    name: string;
    weight: number;
    evaluate: (output: any) => number;
}
export interface QualityResult {
    score: number;
    passed: boolean;
    breakdown: Record<string, number>;
    feedback: string[];
}
export interface QualityLoopResult<T> {
    output: T;
    rounds: number;
    finalScore: number;
    passed: boolean;
    history: Array<{
        round: number;
        output: T;
        score: number;
    }>;
}
export declare function evaluateQuality(output: any, criteria: QualityCriterion[], threshold?: number): QualityResult;
export declare function qualityLoop<T>(config: {
    generate: (round: number, prevOutput?: T, prevResult?: QualityResult) => T | Promise<T>;
    criteria: QualityCriterion[];
    threshold?: number;
    maxRounds?: number;
}): Promise<QualityLoopResult<T>>;
export declare const defaultCriteria: QualityCriterion[];
//# sourceMappingURL=quality-loop.d.ts.map