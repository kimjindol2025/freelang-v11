export interface FitnessResult {
    score: number;
    rawScore: number;
    rank?: number;
    percentile?: number;
    details: Record<string, number>;
}
export interface FitnessConfig {
    weights?: Record<string, number>;
    normalize?: boolean;
    maximize?: boolean;
}
export declare class FitnessEvaluator {
    private config;
    constructor(config?: FitnessConfig);
    proximity(value: number, target: number, tolerance?: number): FitnessResult;
    stringSimilarity(a: string, b: string): FitnessResult;
    arrayMatch<T>(arr: T[], target: T[]): FitnessResult;
    multiObjective(values: Record<string, number>, targets: Record<string, number>, weights?: Record<string, number>): FitnessResult;
    constraintSatisfaction(value: unknown, constraints: Array<(v: unknown) => boolean>): FitnessResult;
    rank<T>(items: T[], scorer: (item: T) => number): Array<T & {
        rank: number;
        score: number;
    }>;
    paretoFront<T>(items: T[], objectives: Array<(item: T) => number>): T[];
}
export declare const globalFitness: FitnessEvaluator;
export declare function fitnessScore(value: number, target: number): number;
export declare function rankItems<T>(items: T[], scores: number[]): Array<{
    item: T;
    rank: number;
    score: number;
}>;
//# sourceMappingURL=fitness.d.ts.map