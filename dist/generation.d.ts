export interface GenerationStats {
    generation: number;
    best: number;
    worst: number;
    average: number;
    diversity: number;
    elites: number;
    improved: boolean;
}
export interface GenerationConfig {
    maxGenerations: number;
    targetFitness?: number;
    stagnationLimit?: number;
    logInterval?: number;
    onGeneration?: (stats: GenerationStats) => void;
}
export interface GenerationResult<T> {
    best: T;
    bestFitness: number;
    totalGenerations: number;
    history: GenerationStats[];
    terminationReason: 'max-generations' | 'target-reached' | 'stagnation';
    improvementRatio: number;
}
export declare class GenerationLoop<T> {
    private config;
    private statsHistory;
    private stagnationCount;
    private currentStats;
    constructor(config: GenerationConfig);
    run(initialPopulation: T[], fitnessFunc: (item: T) => number, nextGenFunc: (population: T[], fitnesses: number[]) => T[]): GenerationResult<T>;
    getCurrentStats(): GenerationStats | null;
    getHistory(): GenerationStats[];
    calculateDiversity(fitnesses: number[]): number;
    hasConverged(): boolean;
    private _computeStats;
}
export declare function runGeneration<T>(population: T[], fitness: (item: T) => number, next: (pop: T[], fits: number[]) => T[], maxGen?: number): GenerationResult<T>;
//# sourceMappingURL=generation.d.ts.map