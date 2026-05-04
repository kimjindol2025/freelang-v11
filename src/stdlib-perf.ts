// FreeLang v11: Performance Profiling Standard Library
// Phase F-2: AI 에이전트 성능 측정 및 병목 감지
//
// 인간 배제 원칙: AI 에이전트 런타임 성능 분석 전용
// IDE/LSP/GUI 없음. JSON 출력만.

interface PerfResult {
  name: string;
  calls: number;
  total_ms: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

interface TraceResult {
  label: string;
  time_ms: number;
  memory_delta_kb: number;
  result: any;
}

interface PerfStats {
  uptime_ms: number;
  total_calls: number;
  memory_used_kb: number;
  memory_peak_kb: number;
  heap_used_kb: number;
}

const START_TIME = Date.now();
let memoryPeak = 0;
let totalCalls = 0;

type CallFnValue = (fn: any, args: any[]) => any;

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function invokeFL(fn: any, args: any[], callFnValue?: CallFnValue): any {
  if (typeof fn === "function") return fn(...args);
  if (fn?.kind === "function-value" && callFnValue) return callFnValue(fn, args);
  throw new Error("profile_fn/trace_expr: 첫 번째 인자는 함수여야 합니다");
}

export function createPerfModule(callFnValue?: CallFnValue) {
  return {
    // profile_fn fn count -> PerfResult
    "profile_fn": (fn: any, count: number = 100): PerfResult => {
      const name = (fn?.name as string) || "anonymous";
      const times: number[] = [];

      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        invokeFL(fn, [], callFnValue);
        times.push(performance.now() - t0);
        totalCalls++;
      }

      times.sort((a, b) => a - b);
      const total_ms = times.reduce((a, b) => a + b, 0);

      return {
        name,
        calls: count,
        total_ms: Math.round(total_ms * 1000) / 1000,
        avg_ms: Math.round((total_ms / count) * 1000) / 1000,
        min_ms: Math.round(times[0] * 1000) / 1000,
        max_ms: Math.round(times[times.length - 1] * 1000) / 1000,
        p50_ms: Math.round(percentile(times, 50) * 1000) / 1000,
        p95_ms: Math.round(percentile(times, 95) * 1000) / 1000,
        p99_ms: Math.round(percentile(times, 99) * 1000) / 1000,
      };
    },

    // trace_expr fn label -> TraceResult
    "trace_expr": (fn: any, label: string = "expr"): TraceResult => {
      const memBefore = process.memoryUsage().heapUsed;
      const t0 = performance.now();
      const result = invokeFL(fn, [], callFnValue);
      const elapsed = performance.now() - t0;
      const memAfter = process.memoryUsage().heapUsed;

      if (memAfter > memoryPeak) memoryPeak = memAfter;
      totalCalls++;

      return {
        label,
        time_ms: Math.round(elapsed * 1000) / 1000,
        memory_delta_kb: Math.round((memAfter - memBefore) / 1024),
        result,
      };
    },

    // perf_stats -> PerfStats
    "perf_stats": (): PerfStats => {
      const mem = process.memoryUsage();
      if (mem.heapUsed > memoryPeak) memoryPeak = mem.heapUsed;
      return {
        uptime_ms: Date.now() - START_TIME,
        total_calls: totalCalls,
        memory_used_kb: Math.round(mem.rss / 1024),
        memory_peak_kb: Math.round(memoryPeak / 1024),
        heap_used_kb: Math.round(mem.heapUsed / 1024),
      };
    },

    // now_ms -> number
    "now_ms": (): number => Date.now(),

    // elapsed_ms start -> number
    "elapsed_ms": (start: number): number => Date.now() - start,

    // bench fn iterations -> {ms, ops_per_sec}
    "bench": (fn: any, iterations: number = 1000): { ms: number; ops_per_sec: number } => {
      const t0 = performance.now();
      for (let i = 0; i < iterations; i++) invokeFL(fn, [], callFnValue);
      const elapsed = performance.now() - t0;
      return {
        ms: Math.round(elapsed * 100) / 100,
        ops_per_sec: Math.round((iterations / elapsed) * 1000),
      };
    },

    // time_fn fn args... -> {result, ms}
    "time_fn": (fn: any, ...args: any[]): { result: any; ms: number } => {
      const t0 = performance.now();
      const result = invokeFL(fn, args, callFnValue);
      return {
        result,
        ms: Math.round((performance.now() - t0) * 1000) / 1000,
      };
    },
  };
}
