export interface EvolutionCycleConfig {
    target: unknown;
    populationSize: number;
    generations: number;
    mutationRate: number;
    eliteRatio: number;
    pruneThreshold: number;
    enableVersioning: boolean;
    enableBenchmark: boolean;
    enableRefactor: boolean;
}
export declare const DEFAULT_CYCLE_CONFIG: EvolutionCycleConfig;
export interface EvolutionCycleResult {
    best: unknown;
    bestFitness: number;
    generations: number;
    improvements: number;
    prunedCount: number;
    benchmarkMs?: number;
    versionId?: string;
    report: string;
}
export interface SelfEvolutionReport {
    timestamp: Date;
    cycles: number;
    totalGenerations: number;
    fitnessProgress: number[];
    refactorSuggestions: number;
    versions: number;
    summary: string;
}
export declare class SelfEvolutionHub {
    private fitnessEval;
    private pruner;
    private refactorer;
    private benchmark;
    private versioning;
    private _cycleCount;
    private _totalGenerations;
    private _refactorSuggestions;
    private _versionCount;
    private _fitnessHistory;
    constructor();
    runCycle(population: unknown[], fitnessFunc: (item: unknown) => number, mutateFunc: (item: unknown) => unknown, crossoverFunc: (a: unknown, b: unknown) => unknown, config?: Partial<EvolutionCycleConfig>): EvolutionCycleResult;
    evolveNumbers(target: number[], config?: Partial<EvolutionCycleConfig>): EvolutionCycleResult;
    evolveString(target: string, config?: Partial<EvolutionCycleConfig>): EvolutionCycleResult;
    generateReport(results: EvolutionCycleResult[]): SelfEvolutionReport;
    selfImprove(baseConfig: Partial<EvolutionCycleConfig>): {
        optimized: EvolutionCycleConfig;
        improvement: number;
    };
    private _emptyResult;
    private _buildReport;
    get cycleCount(): number;
    get totalGenerations(): number;
    get refactorSuggestions(): number;
    get versionCount(): number;
    get fitnessHistory(): number[];
}
export declare const globalSelfEvolution: SelfEvolutionHub;
//# sourceMappingURL=self-evolution-hub.d.ts.map