export type PruneStrategy = 'threshold' | 'top-k' | 'top-percent' | 'pareto' | 'diversity';
export interface PruneConfig {
    strategy: PruneStrategy;
    threshold?: number;
    k?: number;
    percent?: number;
    minDiversity?: number;
}
export interface PruneResult<T> {
    kept: T[];
    removed: T[];
    keptRatio: number;
    strategy: PruneStrategy;
    stats: {
        originalCount: number;
        keptCount: number;
        removedCount: number;
        avgFitnessKept: number;
        avgFitnessRemoved: number;
    };
}
export declare class Pruner<T> {
    private config;
    constructor(config?: Partial<PruneConfig>);
    pruneByThreshold(items: T[], scorer: (item: T) => number, threshold: number): PruneResult<T>;
    pruneToTopK(items: T[], scorer: (item: T) => number, k: number): PruneResult<T>;
    pruneToTopPercent(items: T[], scorer: (item: T) => number, percent: number): PruneResult<T>;
    pruneForDiversity(items: T[], scorer: (item: T) => number, similarity: (a: T, b: T) => number, minDiversity: number): PruneResult<T>;
    dedup(items: T[], key?: (item: T) => string): PruneResult<T>;
    pruneWeak(items: T[], scorer: (item: T) => number): PruneResult<T>;
    prune(items: T[], scorer: (item: T) => number): PruneResult<T>;
}
export declare const globalPruner: Pruner<unknown>;
export declare function keepBest<T>(items: T[], scorer: (item: T) => number, k: number): T[];
export declare function removeWeak<T>(items: T[], scorer: (item: T) => number): T[];
//# sourceMappingURL=prune.d.ts.map