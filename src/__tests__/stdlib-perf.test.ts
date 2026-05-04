// stdlib-perf.test.ts — Phase F-2 성능 프로파일링 테스트

import { Interpreter } from "../interpreter";

describe("stdlib-perf: 성능 프로파일링", () => {
  let interp: Interpreter;

  beforeEach(() => {
    interp = new Interpreter();
  });

  const run = (code: string) => {
    const { lex } = require("../lexer");
    const { parse } = require("../parser");
    return interp.interpret(parse(lex(code)));
  };

  it("now_ms: 타임스탬프 반환", () => {
    const result = run("(now_ms)") as number;
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("elapsed_ms: 경과 시간 계산", () => {
    const result = run(`
      (let [[$t (now_ms)]]
        (elapsed_ms $t))
    `) as number;
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1000);
  });

  it("perf_stats: 전역 통계 반환", () => {
    const result = run("(perf_stats)") as any;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("uptime_ms")).toBeGreaterThan(0);
    expect(result.get("heap_used_kb")).toBeGreaterThan(0);
    expect(result.get("memory_used_kb")).toBeGreaterThan(0);
  });

  it("trace_expr: 함수 실행 추적", () => {
    const result = run(`
      (trace_expr (fn [] (+ 1 2 3)) "test-add")
    `) as any;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("label")).toBe("test-add");
    expect(result.get("result")).toBe(6);
    expect(result.get("time_ms")).toBeGreaterThanOrEqual(0);
    expect(typeof result.get("memory_delta_kb")).toBe("number");
  });

  it("trace_expr: 루프 성능 측정", () => {
    const result = run(`
      (trace_expr
        (fn []
          (loop [i 0 acc 0]
            (if (>= i 1000) acc
              (recur (+ i 1) (+ acc i)))))
        "loop-1k")
    `) as any;
    expect(result.get("result")).toBe(499500);
    expect(result.get("time_ms")).toBeLessThan(5000);
  });

  it("profile_fn: 반복 성능 측정", () => {
    const result = run(`
      (profile_fn (fn [] (* 2 3)) 100)
    `) as any;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("calls")).toBe(100);
    expect(result.get("avg_ms")).toBeGreaterThanOrEqual(0);
    expect(result.get("min_ms")).toBeLessThanOrEqual(result.get("max_ms"));
    expect(result.get("p99_ms")).toBeGreaterThanOrEqual(result.get("p50_ms"));
  });

  it("bench: ops/s 측정", () => {
    const result = run(`
      (bench (fn [] (+ 1 1)) 1000)
    `) as any;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("ms")).toBeGreaterThanOrEqual(0);
    expect(result.get("ops_per_sec")).toBeGreaterThan(0);
  });

  it("time_fn: 함수 실행 시간 측정", () => {
    const result = run(`
      (time_fn (fn [] (str "hello" " " "world")))
    `) as any;
    expect(result).toBeInstanceOf(Map);
    expect(result.get("result")).toBe("hello world");
    expect(result.get("ms")).toBeGreaterThanOrEqual(0);
  });

  it("성능: trace_expr 오버헤드 < 5ms", () => {
    const start = Date.now();
    run(`(trace_expr (fn [] 42) "noop")`);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
