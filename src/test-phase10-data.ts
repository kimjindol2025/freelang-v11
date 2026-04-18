// FreeLang v9: Phase 10 — v9-data 데이터분석 테스트 (30 tests)

import { createTableModule } from "./stdlib-table";
import { createStatsModule } from "./stdlib-stats";
import { createPlotModule } from "./stdlib-plot";

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    testsPassed++;
    console.log(`  ✅  ${name}`);
  } catch (err: any) {
    testsFailed++;
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEquals(a: any, b: any, msg?: string): void {
  if (Math.abs(a - b) > 0.001) throw new Error(msg || `Expected ${b}, got ${a}`);
}

console.log("\n🧪 Phase 10 — v9-data 데이터분석 테스트\n");

const sampleData = {
  headers: ["id", "value", "name"],
  rows: [
    { id: 1, value: 10, name: "A" },
    { id: 2, value: 20, name: "B" },
    { id: 3, value: 30, name: "C" }
  ]
};

// ─────────────────────────────────────────
// Table Tests (10)
// ─────────────────────────────────────────

test("Table 1: 테이블 모듈 생성", () => {
  const table = createTableModule();
  assert(table !== null, "Should create module");
});

test("Table 2: 테이블 선택 (열)", () => {
  const table = createTableModule();
  const result = (table.table_select as Function).call(table, sampleData, ["id", "value"]);
  assert(result.headers.length === 2, "Should have 2 headers");
  assert(result.rows.length === 3, "Should have 3 rows");
});

test("Table 3: 테이블 필터링", () => {
  const table = createTableModule();
  const result = (table.table_filter as Function).call(table, sampleData,
    (row: any) => row.value > 15);
  assert(result.rows.length === 2, "Should have 2 rows");
});

test("Table 4: 테이블 정렬", () => {
  const table = createTableModule();
  const result = (table.table_sort as Function).call(table, sampleData, "value", "desc");
  assert(result.rows[0].value === 30, "First should be 30");
});

test("Table 5: 그룹화", () => {
  const table = createTableModule();
  const grouped = (table.table_group_by as Function).call(table, sampleData, "name");
  assert(Object.keys(grouped).length === 3, "Should have 3 groups");
});

test("Table 6: 집계", () => {
  const table = createTableModule();
  const sum = (table.table_aggregate as Function).call(table, sampleData, "value", "sum");
  assertEquals(sum, 60, "Sum should be 60");
});

test("Table 7: 평균", () => {
  const table = createTableModule();
  const mean = (table.table_aggregate as Function).call(table, sampleData, "value", "mean");
  assertEquals(mean, 20, "Mean should be 20");
});

test("Table 8: Head", () => {
  const table = createTableModule();
  const result = (table.table_head as Function).call(table, sampleData, 2);
  assert(result.rows.length === 2, "Should have 2 rows");
});

test("Table 9: Tail", () => {
  const table = createTableModule();
  const result = (table.table_tail as Function).call(table, sampleData, 2);
  assert(result.rows.length === 2, "Should have 2 rows");
});

test("Table 10: Shape", () => {
  const table = createTableModule();
  const shape = (table.table_shape as Function).call(table, sampleData);
  assertEquals(shape.rows, 3, "Should have 3 rows");
  assertEquals(shape.cols, 3, "Should have 3 columns");
});

// ─────────────────────────────────────────
// Statistics Tests (10)
// ─────────────────────────────────────────

test("Stats 1: 통계 모듈 생성", () => {
  const stats = createStatsModule();
  assert(stats !== null, "Should create module");
});

test("Stats 2: 평균", () => {
  const stats = createStatsModule();
  const mean = (stats.stats_mean as Function).call(stats, [1, 2, 3, 4, 5]);
  assertEquals(mean, 3, "Mean should be 3");
});

test("Stats 3: 중앙값", () => {
  const stats = createStatsModule();
  const median = (stats.stats_median as Function).call(stats, [1, 2, 3, 4, 5]);
  assertEquals(median, 3, "Median should be 3");
});

test("Stats 4: 최솟값", () => {
  const stats = createStatsModule();
  const min = (stats.stats_min as Function).call(stats, [5, 2, 8, 1]);
  assertEquals(min, 1, "Min should be 1");
});

test("Stats 5: 최댓값", () => {
  const stats = createStatsModule();
  const max = (stats.stats_max as Function).call(stats, [5, 2, 8, 1]);
  assertEquals(max, 8, "Max should be 8");
});

test("Stats 6: 표준편차", () => {
  const stats = createStatsModule();
  const stddev = (stats.stats_stddev as Function).call(stats, [1, 2, 3, 4, 5]);
  assert(stddev > 0, "Stddev should be positive");
});

test("Stats 7: 분산", () => {
  const stats = createStatsModule();
  const variance = (stats.stats_variance as Function).call(stats, [1, 2, 3, 4, 5]);
  assert(variance > 0, "Variance should be positive");
});

test("Stats 8: 백분위수", () => {
  const stats = createStatsModule();
  const p75 = (stats.stats_percentile as Function).call(stats, [1, 2, 3, 4, 5], 75);
  assert(p75 > 3, "75th percentile should be > 3");
});

test("Stats 9: 정규화", () => {
  const stats = createStatsModule();
  const norm = (stats.stats_normalize as Function).call(stats, [1, 5, 10]);
  assert(norm[0] === 0, "Min should be 0");
  assert(norm[2] === 1, "Max should be 1");
});

test("Stats 10: 상관계수", () => {
  const stats = createStatsModule();
  const corr = (stats.stats_correlation as Function).call(stats, [1, 2, 3], [1, 2, 3]);
  assertEquals(corr, 1, "Perfect correlation should be 1");
});

// ─────────────────────────────────────────
// Plot Tests (10)
// ─────────────────────────────────────────

test("Plot 1: 시각화 모듈 생성", () => {
  const plot = createPlotModule();
  assert(plot !== null, "Should create module");
});

test("Plot 2: 히스토그램", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_histogram as Function).call(plot, [1, 2, 3, 4, 5], {
    title: "Test"
  });
  assert(typeof chart === "string", "Should return string");
  assert(chart.includes("Test"), "Should include title");
});

test("Plot 3: 막대 차트", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_bar as Function).call(plot, ["A", "B", "C"], [10, 20, 30], {
    title: "Bar"
  });
  assert(chart.includes("Bar"), "Should include title");
});

test("Plot 4: 선 차트", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_line as Function).call(plot, [1, 2, 3], [10, 20, 15], {
    title: "Line"
  });
  assert(chart.includes("Line"), "Should include title");
});

test("Plot 5: 산점도", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_scatter as Function).call(plot, [1, 2, 3], [10, 20, 15], {
    title: "Scatter"
  });
  assert(chart.includes("Scatter"), "Should include title");
});

test("Plot 6: 히트맵", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_heatmap as Function).call(plot, [[1, 2], [3, 4]]);
  assert(typeof chart === "string", "Should return string");
});

test("Plot 7: 차트 저장", () => {
  const plot = createPlotModule();
  const result = (plot.plot_save as Function).call(plot, "test", ".test-chart.txt");
  assertEquals(result, true, "Should save successfully");
});

test("Plot 8: 빈 데이터 히스토그램", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_histogram as Function).call(plot, []);
  assert(chart.includes("no data"), "Should show no data");
});

test("Plot 9: 빈 데이터 막대 차트", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_bar as Function).call(plot, [], []);
  assert(chart.includes("invalid") || chart.includes("no data"), "Should show invalid or no data");
});

test("Plot 10: 히스토그램 bins 옵션", () => {
  const plot = createPlotModule();
  const chart = (plot.plot_histogram as Function).call(plot, [1, 2, 3, 4, 5], {
    bins: 5,
    title: "Custom"
  });
  assert(chart.includes("Custom"), "Should include title");
});

// ─────────────────────────────────────────
// Results
// ─────────────────────────────────────────

console.log("\n" + "─".repeat(50));
console.log(`\n📊 Test Results: ${testsPassed}/${testsPassed + testsFailed} PASS\n`);

if (testsFailed > 0) {
  console.error(`❌ ${testsFailed} tests failed\n`);
  process.exit(1);
} else {
  console.log(`✅ All tests passed!\n`);
  process.exit(0);
}
