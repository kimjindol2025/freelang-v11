// FreeLang v9 Phase 89: 벤치마크 프레임워크

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

export class BenchmarkSuite {
  private benchmarks: Array<{
    name: string;
    fn: () => any;
    opts: Required<BenchmarkOptions>;
  }> = [];

  add(name: string, fn: () => any, opts?: BenchmarkOptions): this {
    this.benchmarks.push({
      name,
      fn,
      opts: { iterations: opts?.iterations ?? 100 },
    });
    return this;
  }

  run(): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];

    for (const bench of this.benchmarks) {
      const { name, fn, opts } = bench;
      const { iterations } = opts;

      // warm-up (5회)
      for (let i = 0; i < Math.min(5, iterations); i++) {
        fn();
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        fn();
      }
      const end = performance.now();

      const totalMs = end - start;
      const avgMs = totalMs / iterations;
      const opsPerSec = avgMs === 0 ? Infinity : 1000 / avgMs;

      results.push({ name, opsPerSec, avgMs, iterations, totalMs });
    }

    return results;
  }

  toMarkdown(results?: BenchmarkResult[]): string {
    const data = results ?? this.run();

    const lines: string[] = [
      "| name | ops/sec | avg ms | iterations | total ms |",
      "|------|---------|--------|------------|----------|",
    ];

    for (const r of data) {
      const ops = r.opsPerSec === Infinity ? "∞" : r.opsPerSec.toFixed(0);
      lines.push(
        `| ${r.name} | ${ops} | ${r.avgMs.toFixed(4)} | ${r.iterations} | ${r.totalMs.toFixed(2)} |`
      );
    }

    return lines.join("\n");
  }

  toJSON(results?: BenchmarkResult[]): object {
    const data = results ?? this.run();
    return data;
  }

  findResult(results: BenchmarkResult[], name: string): BenchmarkResult | undefined {
    return results.find((r) => r.name === name);
  }
}
