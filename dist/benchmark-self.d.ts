export interface BenchmarkResult {
    name: string;
    runs: number;
    totalMs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50: number;
    p95: number;
    p99: number;
    opsPerSec: number;
    memoryUsed?: number;
}
export interface ComparisonResult {
    baseline: BenchmarkResult;
    target: BenchmarkResult;
    speedup: number;
    winner: 'baseline' | 'target' | 'tie';
    significant: boolean;
}
export interface BenchmarkSuite {
    name: string;
    results: BenchmarkResult[];
    startTime: Date;
    endTime?: Date;
    summary: {
        total: number;
        fastest: BenchmarkResult;
        slowest: BenchmarkResult;
        avgOpsPerSec: number;
    };
}
export declare class SelfBenchmark {
    private suite;
    private pendingFns;
    constructor(suiteName?: string);
    percentile(times: number[], p: number): number;
    measure(name: string, fn: () => unknown, runs?: number): BenchmarkResult;
    measureAsync(name: string, fn: () => Promise<unknown>, runs?: number): Promise<BenchmarkResult>;
    compare(name1: string, fn1: () => unknown, name2: string, fn2: () => unknown, runs?: number): ComparisonResult;
    add(name: string, fn: () => unknown): this;
    run(runs?: number): BenchmarkSuite;
    report(result: BenchmarkResult): string;
    histogram(result: BenchmarkResult): string;
}
export declare const globalBenchmark: SelfBenchmark;
export declare function bench(name: string, fn: () => unknown, runs?: number): BenchmarkResult;
export declare function benchCompare(fn1: () => unknown, fn2: () => unknown, runs?: number): ComparisonResult;
//# sourceMappingURL=benchmark-self.d.ts.map