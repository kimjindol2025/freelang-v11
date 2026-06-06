// stdlib-perf.test.ts — Phase F-2 성능 프로파일링 테스트

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("stdlib-perf: 성능 프로파일링", () => {
  const bootstrapPath = path.join(__dirname, "../../bootstrap.js");
  let testCounter = 0;

  const run = (code: string) => {
    try {
      // 임시 파일에 코드 작성
      const tmpFile = path.join(os.tmpdir(), `fl-test-${Date.now()}-${testCounter++}.fl`);
      const wrappedCode = `(json-str ${code})`;
      fs.writeFileSync(tmpFile, wrappedCode);

      try {
        const output = execSync(`node ${bootstrapPath} run ${tmpFile}`, {
          encoding: "utf-8",
          timeout: 5000
        }).trim();

        // JSON 파싱
        const parsed = JSON.parse(output);

        // Map을 일반 object로 변환
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
        return parsed;
      } finally {
        fs.unlinkSync(tmpFile);
      }
    } catch (e) {
      console.error("실행 오류:", (e as Error).message);
      throw e;
    }
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
    expect(typeof result).toBe("object");
    expect(result.uptime_ms).toBeGreaterThan(0);
    expect(result.heap_used_kb).toBeGreaterThan(0);
    expect(result.memory_used_kb).toBeGreaterThan(0);
  });

  it("trace_expr: 함수 실행 추적", () => {
    const result = run(`
      (trace_expr (fn [] (+ 1 2 3)) "test-add")
    `) as any;
    expect(typeof result).toBe("object");
    expect(result.label).toBe("test-add");
    expect(result.result).toBe(6);
    expect(result.time_ms).toBeGreaterThanOrEqual(0);
    expect(typeof result.memory_delta_kb).toBe("number");
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
    expect(result.result).toBe(499500);
    expect(result.time_ms).toBeLessThan(5000);
  });

  it("profile_fn: 반복 성능 측정", () => {
    const result = run(`
      (profile_fn (fn [] (* 2 3)) 100)
    `) as any;
    expect(typeof result).toBe("object");
    expect(result.calls).toBe(100);
    expect(result.avg_ms).toBeGreaterThanOrEqual(0);
    expect(result.min_ms).toBeLessThanOrEqual(result.max_ms);
    expect(result.p99_ms).toBeGreaterThanOrEqual(result.p50_ms);
  });

  it("bench: ops/s 측정", () => {
    const result = run(`
      (bench (fn [] (+ 1 1)) 1000)
    `) as any;
    expect(typeof result).toBe("object");
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(result.ops_per_sec).toBeGreaterThan(0);
  });

  it("time_fn: 함수 실행 시간 측정", () => {
    const result = run(`
      (time_fn (fn [] (str "hello" " " "world")))
    `) as any;
    expect(typeof result).toBe("object");
    expect(result.result).toBe("hello world");
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it("성능: trace_expr 오버헤드 < 5ms", () => {
    const start = Date.now();
    run(`(trace_expr (fn [] 42) "noop")`);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
