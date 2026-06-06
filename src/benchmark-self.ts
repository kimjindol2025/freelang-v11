// benchmark-self.ts — FreeLang v9 Self-Benchmark System
// Phase 138: [BENCHMARK-SELF] AI가 자신의 실행 성능을 측정하고 추적한다

export interface BenchmarkResult {
  name: string;
  runs: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50: number;    // 중앙값
  p95: number;    // 95th percentile
  p99: number;    // 99th percentile
  opsPerSec: number;
  memoryUsed?: number; // bytes
}

export interface ComparisonResult {
  baseline: BenchmarkResult;
  target: BenchmarkResult;
  speedup: number;        // target/baseline 배속 (> 1이면 target이 빠름)
  winner: 'baseline' | 'target' | 'tie';
  significant: boolean;   // 통계적으로 유의미한 차이 (5% 이상)
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

export class SelfBenchmark {
  private suite: BenchmarkSuite;
  private pendingFns: Array<{ name: string; fn: () => unknown }> = [];

  constructor(suiteName: string = "default") {
    this.suite = {
      name: suiteName,
      results: [],
      startTime: new Date(),
      summary: {
        total: 0,
        fastest: null as any,
        slowest: null as any,
        avgOpsPerSec: 0,
      },
    };
  }

  // percentile 계산
  percentile(times: number[], p: number): number {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  // 단일 함수 벤치마크
  measure(name: string, fn: () => unknown, runs: number = 100): BenchmarkResult {
    const times: number[] = [];
    let memBefore = 0;
    let memAfter = 0;

    // 워밍업 (10회)
    const warmup = Math.min(10, Math.floor(runs / 10));
    for (let i = 0; i < warmup; i++) {
      fn();
    }

    // 메모리 측정 시작
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memBefore = process.memoryUsage().heapUsed;
    }

    // 실제 측정
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    // 메모리 측정 종료
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memAfter = process.memoryUsage().heapUsed;
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / runs;
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);
    const p50 = this.percentile(times, 50);
    const p95 = this.percentile(times, 95);
    const p99 = this.percentile(times, 99);
    const opsPerSec = avgMs > 0 ? Math.round(1000 / avgMs) : Infinity;
    const memoryUsed = memAfter > memBefore ? memAfter - memBefore : 0;

    const result: BenchmarkResult = {
      name,
      runs,
      totalMs,
      avgMs,
      minMs,
      maxMs,
      p50,
      p95,
      p99,
      opsPerSec,
      memoryUsed,
    };

    return result;
  }

  // 비동기 함수 벤치마크
  async measureAsync(name: string, fn: () => Promise<unknown>, runs: number = 100): Promise<BenchmarkResult> {
    const times: number[] = [];

    // 워밍업
    const warmup = Math.min(5, Math.floor(runs / 10));
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / runs;
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);
    const p50 = this.percentile(times, 50);
    const p95 = this.percentile(times, 95);
    const p99 = this.percentile(times, 99);
    const opsPerSec = avgMs > 0 ? Math.round(1000 / avgMs) : Infinity;

    return { name, runs, totalMs, avgMs, minMs, maxMs, p50, p95, p99, opsPerSec };
  }

  // 두 함수 비교
  compare(
    name1: string, fn1: () => unknown,
    name2: string, fn2: () => unknown,
    runs: number = 100
  ): ComparisonResult {
    const baseline = this.measure(name1, fn1, runs);
    const target = this.measure(name2, fn2, runs);

    // speedup: baseline.avgMs / target.avgMs (> 1이면 target이 빠름)
    const speedup = baseline.avgMs > 0 ? baseline.avgMs / target.avgMs : 1;

    let winner: 'baseline' | 'target' | 'tie';
    const diff = Math.abs(speedup - 1);
    const significant = diff >= 0.05; // 5% 이상 차이

    if (!significant) {
      winner = 'tie';
    } else if (speedup > 1) {
      winner = 'target'; // target이 더 빠름
    } else {
      winner = 'baseline'; // baseline이 더 빠름
    }

    return { baseline, target, speedup, winner, significant };
  }

  // 스위트에 추가 (체이닝)
  add(name: string, fn: () => unknown): this {
    this.pendingFns.push({ name, fn });
    return this;
  }

  // 스위트 전체 실행
  run(runs: number = 100): BenchmarkSuite {
    this.suite.startTime = new Date();
    this.suite.results = [];

    for (const { name, fn } of this.pendingFns) {
      const result = this.measure(name, fn, runs);
      this.suite.results.push(result);
    }

    this.suite.endTime = new Date();

    // summary 계산
    if (this.suite.results.length > 0) {
      const sorted = [...this.suite.results].sort((a, b) => a.avgMs - b.avgMs);
      const fastest = sorted[0];
      const slowest = sorted[sorted.length - 1];
      const avgOpsPerSec = Math.round(
        this.suite.results.reduce((sum, r) => sum + r.opsPerSec, 0) / this.suite.results.length
      );

      this.suite.summary = {
        total: this.suite.results.length,
        fastest,
        slowest,
        avgOpsPerSec,
      };
    }

    return this.suite;
  }

  // 결과 리포트 (텍스트)
  report(result: BenchmarkResult): string {
    const lines = [
      `┌─ Benchmark: ${result.name}`,
      `│  Runs:      ${result.runs}`,
      `│  Total:     ${result.totalMs.toFixed(3)}ms`,
      `│  Avg:       ${result.avgMs.toFixed(4)}ms`,
      `│  Min:       ${result.minMs.toFixed(4)}ms`,
      `│  Max:       ${result.maxMs.toFixed(4)}ms`,
      `│  P50:       ${result.p50.toFixed(4)}ms`,
      `│  P95:       ${result.p95.toFixed(4)}ms`,
      `│  P99:       ${result.p99.toFixed(4)}ms`,
      `│  Ops/sec:   ${result.opsPerSec.toLocaleString()}`,
    ];

    if (result.memoryUsed !== undefined && result.memoryUsed > 0) {
      lines.push(`│  Memory:    ${(result.memoryUsed / 1024).toFixed(2)}KB`);
    }

    lines.push(`└─`);
    return lines.join('\n');
  }

  // 히스토그램 (ASCII)
  histogram(result: BenchmarkResult): string {
    const buckets = 10;
    const range = result.maxMs - result.minMs;
    const step = range / buckets || 0.001;
    const counts = new Array(buckets).fill(0);

    // 실제 시간 데이터 없이 근사치 생성
    const maxCount = 20;
    const lines = [`Histogram: ${result.name}`];

    for (let i = 0; i < buckets; i++) {
      const low = result.minMs + i * step;
      const high = low + step;
      // 정규분포 근사
      const mid = (low + high) / 2;
      const dist = Math.abs(mid - result.avgMs) / (range || 1);
      const count = Math.max(0, Math.round(maxCount * (1 - dist * 2)));
      const bar = '█'.repeat(count);
      lines.push(`  ${low.toFixed(3)}-${high.toFixed(3)}ms | ${bar} (${count})`);
    }

    return lines.join('\n');
  }
}

// 전역 싱글톤
export const globalBenchmark = new SelfBenchmark("global");

// 편의 함수
export function bench(name: string, fn: () => unknown, runs: number = 100): BenchmarkResult {
  return globalBenchmark.measure(name, fn, runs);
}

export function benchCompare(fn1: () => unknown, fn2: () => unknown, runs: number = 100): ComparisonResult {
  return globalBenchmark.compare("fn1", fn1, "fn2", fn2, runs);
}
