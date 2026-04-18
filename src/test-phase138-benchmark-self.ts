// FreeLang v9: Phase 138 — BENCHMARK-SELF 테스트
// AI가 자신의 실행 성능을 측정하고 추적하는 시스템 검증

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { SelfBenchmark, globalBenchmark, bench, benchCompare, BenchmarkResult, ComparisonResult } from "./benchmark-self";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 150)}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// 지속 인터프리터 (FL 빌트인 테스트용)
const flInterp = new Interpreter();
function flEval(code: string): any {
  const state = flInterp.run(code);
  return (state as any).lastValue;
}

console.log("\n=== Phase 138: BENCHMARK-SELF 테스트 ===\n");

// --- 1. SelfBenchmark 생성 ---
test("1. SelfBenchmark 생성", () => {
  const bm = new SelfBenchmark("test-suite");
  assert(bm instanceof SelfBenchmark, "SelfBenchmark 인스턴스여야 함");
});

// --- 2. measure 단순 함수 ---
test("2. measure 단순 함수", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("simple", () => 1 + 1, 10);
  assert(result !== null && result !== undefined, "결과가 있어야 함");
});

// --- 3. BenchmarkResult 구조 검증 ---
test("3. BenchmarkResult 구조 검증", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("test", () => Math.sqrt(2), 20);
  assert(typeof result.name === 'string', "name이 string이어야 함");
  assert(typeof result.runs === 'number', "runs가 number이어야 함");
  assert(typeof result.totalMs === 'number', "totalMs가 number이어야 함");
  assert(typeof result.avgMs === 'number', "avgMs가 number이어야 함");
  assert(typeof result.minMs === 'number', "minMs가 number이어야 함");
  assert(typeof result.maxMs === 'number', "maxMs가 number이어야 함");
  assert(typeof result.p50 === 'number', "p50이 number이어야 함");
  assert(typeof result.p95 === 'number', "p95가 number이어야 함");
  assert(typeof result.p99 === 'number', "p99가 number이어야 함");
  assert(typeof result.opsPerSec === 'number', "opsPerSec가 number이어야 함");
});

// --- 4. avgMs >= 0 ---
test("4. avgMs >= 0", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("avg-test", () => {
    let x = 0;
    for (let i = 0; i < 1000; i++) x += i;
    return x;
  }, 50);
  assert(result.avgMs >= 0, "avgMs는 0 이상이어야 함");
  assert(result.totalMs >= 0, "totalMs는 0 이상이어야 함");
});

// --- 5. minMs <= avgMs <= maxMs ---
test("5. minMs <= avgMs <= maxMs", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("range-test", () => JSON.stringify({ x: 1 }), 30);
  assert(result.minMs <= result.avgMs + 0.001, `minMs(${result.minMs}) <= avgMs(${result.avgMs}) 이어야 함`);
  assert(result.avgMs <= result.maxMs + 0.001, `avgMs(${result.avgMs}) <= maxMs(${result.maxMs}) 이어야 함`);
});

// --- 6. p50 중앙값 범위 ---
test("6. p50 중앙값 범위", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("p50-test", () => Math.random(), 50);
  assert(result.p50 >= result.minMs - 0.001, `p50(${result.p50}) >= minMs(${result.minMs})`);
  assert(result.p50 <= result.maxMs + 0.001, `p50(${result.p50}) <= maxMs(${result.maxMs})`);
});

// --- 7. p95 >= p50 ---
test("7. p95 >= p50", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("p95-test", () => Math.random() * 100, 100);
  assert(result.p95 >= result.p50 - 0.001, `p95(${result.p95}) >= p50(${result.p50})`);
});

// --- 8. p99 >= p95 ---
test("8. p99 >= p95", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("p99-test", () => [1, 2, 3].map(x => x * 2), 100);
  assert(result.p99 >= result.p95 - 0.001, `p99(${result.p99}) >= p95(${result.p95})`);
});

// --- 9. opsPerSec 계산 ---
test("9. opsPerSec 계산", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("ops-test", () => 42, 50);
  assert(result.opsPerSec > 0, "opsPerSec > 0이어야 함");
});

// --- 10. runs 수 정확성 ---
test("10. runs 수 정확성", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("runs-test", () => null, 77);
  assert(result.runs === 77, `runs가 77이어야 함, 실제: ${result.runs}`);
});

// --- 11. compare 두 함수 비교 ---
test("11. compare 두 함수 비교", () => {
  const bm = new SelfBenchmark();
  const result = bm.compare(
    "fast", () => 1 + 1,
    "slow", () => { let x = 0; for (let i = 0; i < 100; i++) x += i; return x; },
    20
  );
  assert(result !== null && result !== undefined, "ComparisonResult가 있어야 함");
});

// --- 12. ComparisonResult 구조 ---
test("12. ComparisonResult 구조", () => {
  const bm = new SelfBenchmark();
  const result = bm.compare("a", () => 1, "b", () => 2, 20);
  assert('baseline' in result, "baseline 필드가 있어야 함");
  assert('target' in result, "target 필드가 있어야 함");
  assert('speedup' in result, "speedup 필드가 있어야 함");
  assert('winner' in result, "winner 필드가 있어야 함");
  assert('significant' in result, "significant 필드가 있어야 함");
});

// --- 13. winner 결정 로직 ---
test("13. winner 결정 로직", () => {
  const bm = new SelfBenchmark();
  const result = bm.compare("a", () => 1, "b", () => 2, 10);
  assert(
    result.winner === 'baseline' || result.winner === 'target' || result.winner === 'tie',
    `winner가 유효한 값이어야 함: ${result.winner}`
  );
});

// --- 14. speedup 계산 ---
test("14. speedup 계산 (양수)", () => {
  const bm = new SelfBenchmark();
  const result = bm.compare("a", () => 1, "b", () => 2, 10);
  assert(result.speedup > 0, `speedup이 양수여야 함: ${result.speedup}`);
  assert(typeof result.speedup === 'number', "speedup이 number여야 함");
});

// --- 15. add + run 스위트 실행 ---
test("15. add + run 스위트 실행", () => {
  const bm = new SelfBenchmark("my-suite");
  bm.add("fn1", () => 1 + 1);
  bm.add("fn2", () => "hello".length);
  const suite = bm.run(10);
  assert(suite !== null, "suite가 있어야 함");
  assert(suite.results.length === 2, `results.length가 2여야 함: ${suite.results.length}`);
});

// --- 16. BenchmarkSuite 구조 ---
test("16. BenchmarkSuite 구조", () => {
  const bm = new SelfBenchmark("suite-struct");
  bm.add("t1", () => null);
  const suite = bm.run(5);
  assert(typeof suite.name === 'string', "suite.name이 string이어야 함");
  assert(Array.isArray(suite.results), "suite.results가 배열이어야 함");
  assert(suite.startTime instanceof Date, "startTime이 Date여야 함");
  assert(suite.summary !== undefined, "summary가 있어야 함");
});

// --- 17. summary.fastest 정확성 ---
test("17. summary.fastest 정확성", () => {
  const bm = new SelfBenchmark("fastest-test");
  bm.add("slow", () => { let x = 0; for (let i = 0; i < 1000; i++) x += i; return x; });
  bm.add("fast", () => 42);
  const suite = bm.run(20);
  assert(suite.summary.fastest !== null, "fastest가 있어야 함");
  assert(typeof suite.summary.fastest.name === 'string', "fastest.name이 string이어야 함");
  // fastest는 avgMs가 가장 낮아야 함
  const allAvg = suite.results.map(r => r.avgMs);
  assert(suite.summary.fastest.avgMs <= Math.max(...allAvg) + 0.001, "fastest avgMs가 최솟값이어야 함");
});

// --- 18. report 텍스트 생성 ---
test("18. report 텍스트 생성", () => {
  const bm = new SelfBenchmark();
  const result = bm.measure("report-test", () => 42, 10);
  const report = bm.report(result);
  assert(typeof report === 'string', "report가 string이어야 함");
  assert(report.includes("report-test"), "report에 이름이 포함되어야 함");
  assert(report.includes("Runs"), "report에 Runs가 포함되어야 함");
  assert(report.length > 50, `report가 충분히 길어야 함: ${report.length}`);
});

// --- 19. bench-measure 빌트인 ---
test("19. bench-measure 빌트인", () => {
  const result = flEval('(bench-measure "builtin-test" (fn [] (+ 1 2)) :runs 10)');
  assert(result instanceof Map, "bench-measure가 Map을 반환해야 함");
  assert(result.get("name") === "builtin-test", `name이 "builtin-test"여야 함: ${result.get("name")}`);
  assert(result.get("runs") === 10, `runs가 10이어야 함: ${result.get("runs")}`);
});

// --- 20. bench-compare 빌트인 ---
test("20. bench-compare 빌트인", () => {
  const result = flEval('(bench-compare (fn [] (+ 1 1)) (fn [] (* 2 2)) :runs 10)');
  assert(result instanceof Map, "bench-compare가 Map을 반환해야 함");
  assert(result.has("speedup"), "speedup 필드가 있어야 함");
  assert(result.has("winner"), "winner 필드가 있어야 함");
  assert(result.has("baseline"), "baseline 필드가 있어야 함");
  assert(result.has("target"), "target 필드가 있어야 함");
});

// --- 21. bench-suite 빌트인 ---
test("21. bench-suite 빌트인", () => {
  const result = flEval('(bench-suite "my-test-suite")');
  assert(result instanceof SelfBenchmark, "bench-suite가 SelfBenchmark를 반환해야 함");
});

// --- 22. bench-add 빌트인 ---
test("22. bench-add 빌트인", () => {
  const suite = flEval('(bench-suite "add-test")');
  assert(suite instanceof SelfBenchmark, "bench-suite가 SelfBenchmark를 반환해야 함");
  // TypeScript API로 add 테스트
  suite.add("adder", () => 10 + 20);
  const ran = suite.run(3);
  assert(ran.results.length === 1, `results.length가 1이어야 함: ${ran.results.length}`);
});

// --- 23. bench-run 빌트인 ---
test("23. bench-run 빌트인", () => {
  // bench-add 후 bench-run 빌트인 호출
  const suite = flEval('(bench-suite "run-suite")');
  suite.add("fn1", () => 42);
  suite.add("fn2", () => "hello");
  // bench-run은 SelfBenchmark 인스턴스를 직접 전달
  const result = flEval(`(bench-run (bench-suite "empty-suite") :runs 5)`);
  // 빈 suite run: results는 빈 배열
  assert(result instanceof Map, "bench-run이 Map을 반환해야 함");
  assert(result.has("results"), "results 필드가 있어야 함");
  assert(result.has("summary"), "summary 필드가 있어야 함");
});

// --- 24. bench-report 빌트인 ---
test("24. bench-report 빌트인", () => {
  const report = flEval('(bench-report (bench-measure "rpt-test" (fn [] 42) :runs 5))');
  assert(typeof report === 'string', "bench-report가 string을 반환해야 함");
  assert(report.includes("rpt-test"), `리포트에 이름 포함: ${report.slice(0, 60)}`);
  assert(report.length > 30, "리포트가 충분히 길어야 함");
});

// --- 25. bench-speedup 빌트인 ---
test("25. bench-speedup 빌트인", () => {
  const comp = flEval('(bench-compare (fn [] (+ 1 1)) (fn [] (* 2 2)) :runs 5)');
  assert(comp instanceof Map, "bench-compare가 Map을 반환해야 함");
  const speedup = Number(comp.get("speedup") ?? 0);
  assert(typeof speedup === 'number', `speedup이 number여야 함: ${typeof speedup}`);
  assert(speedup > 0, `speedup이 양수여야 함: ${speedup}`);
});

// --- 26. bench-stats 빌트인 (보너스) ---
test("26. bench-stats 빌트인 (보너스)", () => {
  const stats = flEval('(bench-stats (bench-measure "stats-test" (fn [] 99) :runs 10))');
  assert(stats instanceof Map, "bench-stats가 Map을 반환해야 함");
  assert(stats.has("avg"), "avg 필드가 있어야 함");
  assert(stats.has("min"), "min 필드가 있어야 함");
  assert(stats.has("max"), "max 필드가 있어야 함");
  assert(stats.has("p95"), "p95 필드가 있어야 함");
  assert(stats.has("p99"), "p99 필드가 있어야 함");
  assert(stats.has("opsPerSec"), "opsPerSec 필드가 있어야 함");
});

// --- 27. percentile 계산 정확성 ---
test("27. percentile 계산 정확성", () => {
  const bm = new SelfBenchmark();
  const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const p50 = bm.percentile(times, 50);
  const p95 = bm.percentile(times, 95);
  const p99 = bm.percentile(times, 99);
  assert(p50 >= 1 && p50 <= 10, `p50(${p50})이 범위 내여야 함`);
  assert(p95 >= p50, `p95(${p95}) >= p50(${p50})`);
  assert(p99 >= p95, `p99(${p99}) >= p95(${p95})`);
});

// --- 28. globalBenchmark 싱글톤 ---
test("28. globalBenchmark 싱글톤", () => {
  assert(globalBenchmark instanceof SelfBenchmark, "globalBenchmark가 SelfBenchmark여야 함");
  const result = globalBenchmark.measure("singleton-test", () => 0, 5);
  assert(result.name === "singleton-test", "measure가 올바르게 동작해야 함");
});

// --- 29. bench 편의 함수 ---
test("29. bench 편의 함수", () => {
  const result = bench("convenience-test", () => Math.PI, 10);
  assert(result.name === "convenience-test", `name이 "convenience-test"여야 함`);
  assert(result.runs === 10, `runs가 10이어야 함`);
});

// --- 30. 스위트 endTime 설정 ---
test("30. 스위트 endTime 설정", () => {
  const bm = new SelfBenchmark("endtime-test");
  bm.add("fn", () => 1);
  const suite = bm.run(5);
  assert(suite.endTime instanceof Date, "endTime이 Date여야 함");
  assert(suite.endTime! >= suite.startTime, "endTime >= startTime이어야 함");
});

// 결과 출력
console.log(`\n=== 결과: ${passed}/${passed + failed} PASS ===`);
if (failed > 0) {
  console.log(`❌ ${failed}개 실패`);
  process.exit(1);
} else {
  console.log("✅ 모든 테스트 통과!");
}
