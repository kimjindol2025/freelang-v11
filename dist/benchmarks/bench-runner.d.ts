export interface BenchmarkResult {
    name: string;
    opsPerSec: number;
    avgMs: number;
    iterations: number;
    totalMs: number;
}
export interface BenchmarkOptions {
    iterations?: number;
}
export declare class BenchmarkSuite {
    private benchmarks;
    add(name: string, fn: () => any, opts?: BenchmarkOptions): this;
    run(): BenchmarkResult[];
    toMarkdown(results?: BenchmarkResult[]): string;
    toJSON(results?: BenchmarkResult[]): object;
    findResult(results: BenchmarkResult[], name: string): BenchmarkResult | undefined;
}
//# sourceMappingURL=bench-runner.d.ts.map