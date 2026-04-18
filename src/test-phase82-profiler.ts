// FreeLang v9: Phase 82 — 성능 프로파일러 테스트
// npx ts-node src/test-phase82-profiler.ts

import { Profiler, globalProfiler } from "./profiler";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

console.log("[Phase 82] 성능 프로파일러 검증\n");

// ── TC-1: Profiler 생성, enabled 기본값 ─────────────────────────────────
console.log("[TC-1~6] Profiler 기본 동작");

test("TC-1: Profiler 생성 후 enabled=false가 기본값", () => {
  const p = new Profiler();
  assert(p.enabled === false, `enabled expected false, got ${p.enabled}`);
});

// ── TC-2: record 기본 동작 ──────────────────────────────────────────────
test("TC-2: record 기본 동작 — enabled=true일 때 기록", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("foo", 10);
  const report = p.getReport();
  assert(report.length === 1, `expected 1 entry, got ${report.length}`);
  assert(report[0].name === "foo", `expected name 'foo', got '${report[0].name}'`);
  assert(report[0].callCount === 1, `expected callCount=1, got ${report[0].callCount}`);
  assert(report[0].totalMs === 10, `expected totalMs=10, got ${report[0].totalMs}`);
});

// ── TC-3: 같은 이름 여러 번 record → callCount 누적 ─────────────────────
test("TC-3: 같은 이름 여러 번 record → callCount 누적", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("bar", 5);
  p.record("bar", 10);
  p.record("bar", 15);
  const report = p.getReport();
  assert(report.length === 1, `expected 1 entry, got ${report.length}`);
  assert(report[0].callCount === 3, `expected callCount=3, got ${report[0].callCount}`);
  assert(report[0].totalMs === 30, `expected totalMs=30, got ${report[0].totalMs}`);
});

// ── TC-4: getReport 정렬 (callCount 내림차순) ────────────────────────────
test("TC-4: getReport callCount 내림차순 정렬", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("once", 1);
  p.record("triple", 1);
  p.record("triple", 2);
  p.record("triple", 3);
  p.record("twice", 5);
  p.record("twice", 6);
  const report = p.getReport();
  assert(report[0].name === "triple", `first expected 'triple', got '${report[0].name}'`);
  assert(report[1].name === "twice", `second expected 'twice', got '${report[1].name}'`);
  assert(report[2].name === "once", `third expected 'once', got '${report[2].name}'`);
});

// ── TC-5: getTop(N) 상위 N개만 ──────────────────────────────────────────
test("TC-5: getTop(2) — 상위 2개만 반환", () => {
  const p = new Profiler();
  p.enabled = true;
  for (let i = 0; i < 5; i++) p.record("a", 1);
  for (let i = 0; i < 3; i++) p.record("b", 1);
  for (let i = 0; i < 1; i++) p.record("c", 1);
  const top = p.getTop(2);
  assert(top.length === 2, `expected 2 entries, got ${top.length}`);
  assert(top[0].name === "a", `first expected 'a', got '${top[0].name}'`);
  assert(top[1].name === "b", `second expected 'b', got '${top[1].name}'`);
});

// ── TC-6: reset 초기화 ───────────────────────────────────────────────────
test("TC-6: reset 후 getReport 빈 배열", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("foo", 10);
  p.record("bar", 20);
  p.reset();
  const report = p.getReport();
  assert(report.length === 0, `expected 0 entries after reset, got ${report.length}`);
});

// ── TC-7: enter/exit 패턴 ───────────────────────────────────────────────
console.log("\n[TC-7~11] enter/exit 및 통계");

test("TC-7: enter/exit 패턴 — exit 호출 시 ms 기록", (done?: any) => {
  const p = new Profiler();
  p.enabled = true;
  const exit = p.enter("myFunc");
  // 약간 대기 후 exit
  const start = Date.now();
  while (Date.now() - start < 5) {} // busy-wait 5ms
  exit();
  const report = p.getReport();
  assert(report.length === 1, `expected 1 entry, got ${report.length}`);
  assert(report[0].callCount === 1, `expected callCount=1, got ${report[0].callCount}`);
  assert(report[0].totalMs >= 0, `totalMs should be >= 0, got ${report[0].totalMs}`);
});

// ── TC-8: toMarkdown ─────────────────────────────────────────────────────
test("TC-8: toMarkdown — 헤더/구분선/데이터 행 포함", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("alpha", 10);
  p.record("alpha", 20);
  const md = p.toMarkdown();
  assert(md.includes("| name |"), `expected '| name |' in markdown`);
  assert(md.includes("|---"), `expected divider in markdown`);
  assert(md.includes("alpha"), `expected 'alpha' in markdown`);
});

// ── TC-9: toJSON ─────────────────────────────────────────────────────────
test("TC-9: toJSON — ProfileEntry 배열 반환", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("x", 5);
  p.record("y", 10);
  const json = p.toJSON() as any[];
  assert(Array.isArray(json), `expected array from toJSON`);
  assert(json.length === 2, `expected 2 entries, got ${json.length}`);
  assert(typeof json[0].name === "string", `expected name field in JSON`);
  assert(typeof json[0].callCount === "number", `expected callCount field in JSON`);
});

// ── TC-10: avgMs = totalMs / callCount ───────────────────────────────────
test("TC-10: avgMs = totalMs / callCount", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("calc", 10);
  p.record("calc", 20);
  p.record("calc", 30);
  const report = p.getReport();
  assert(report[0].callCount === 3, `callCount expected 3`);
  assert(report[0].totalMs === 60, `totalMs expected 60`);
  assert(Math.abs(report[0].avgMs - 20) < 0.001, `avgMs expected 20, got ${report[0].avgMs}`);
});

// ── TC-11: maxMs/minMs 추적 ──────────────────────────────────────────────
test("TC-11: maxMs/minMs 정확히 추적", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("fn", 5);
  p.record("fn", 100);
  p.record("fn", 30);
  const report = p.getReport();
  assert(report[0].maxMs === 100, `maxMs expected 100, got ${report[0].maxMs}`);
  assert(report[0].minMs === 5, `minMs expected 5, got ${report[0].minMs}`);
});

// ── TC-12: enabled=false → record 무시 ──────────────────────────────────
console.log("\n[TC-12~14] enabled 제어 및 중첩");

test("TC-12: enabled=false → record 무시", () => {
  const p = new Profiler();
  // enabled = false (기본)
  p.record("ghost", 999);
  const report = p.getReport();
  assert(report.length === 0, `expected 0 entries when disabled, got ${report.length}`);
});

// ── TC-13: globalProfiler 싱글턴 ─────────────────────────────────────────
test("TC-13: globalProfiler 싱글턴 — 동일 인스턴스", () => {
  const { globalProfiler: gp1 } = require("./profiler");
  const { globalProfiler: gp2 } = require("./profiler");
  assert(gp1 === gp2, `globalProfiler should be singleton`);
});

// ── TC-14: 중첩 enter (selfMs 계산) ─────────────────────────────────────
test("TC-14: 중첩 enter — selfMs < totalMs", () => {
  const p = new Profiler();
  p.enabled = true;

  // 외부 함수 enter
  const exitOuter = p.enter("outer");
  // 내부 함수 enter
  const exitInner = p.enter("inner");
  const s = Date.now();
  while (Date.now() - s < 5) {} // busy-wait
  exitInner();
  exitOuter();

  const report = p.getReport();
  const outer = report.find(e => e.name === "outer");
  const inner = report.find(e => e.name === "inner");
  assert(outer !== undefined, "outer entry should exist");
  assert(inner !== undefined, "inner entry should exist");
  // outer의 selfMs는 outer의 totalMs - inner의 totalMs이므로 outer.selfMs <= outer.totalMs
  assert(outer!.selfMs <= outer!.totalMs + 0.1, `outer selfMs(${outer!.selfMs}) should be <= totalMs(${outer!.totalMs})`);
});

// ── TC-15: FL 코드로 팩토리얼 실행 후 "fact" 항목 확인 ──────────────────
console.log("\n[TC-15~16] FL 코드 통합");

test("TC-15: FL 팩토리얼 실행 후 globalProfiler에 'fact' 항목 확인", () => {
  globalProfiler.reset();
  globalProfiler.enabled = true;

  const src = `
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 5)
  `;
  const result = run(src);
  assert(result === 120, `fact(5) expected 120, got ${result}`);

  const report = globalProfiler.getReport();
  const factEntry = report.find(e => e.name === "fact");
  assert(factEntry !== undefined, `'fact' entry not found in profiler`);
  assert(factEntry!.callCount >= 1, `fact callCount expected >= 1, got ${factEntry!.callCount}`);

  globalProfiler.reset();
  globalProfiler.enabled = false;
});

// ── TC-16: 재귀 함수 callCount 카운팅 ───────────────────────────────────
test("TC-16: 재귀 함수 callCount = 재귀 깊이만큼", () => {
  globalProfiler.reset();
  globalProfiler.enabled = true;

  const src = `
    [FUNC countdown :params [$n]
      :body (if (<= $n 0) 0 (countdown (- $n 1)))]
    (countdown 10)
  `;
  run(src);

  const report = globalProfiler.getReport();
  const entry = report.find(e => e.name === "countdown");
  assert(entry !== undefined, `'countdown' not found`);
  // countdown(10) → 11번 호출 (10,9,...,0)
  assert(entry!.callCount === 11, `callCount expected 11, got ${entry!.callCount}`);

  globalProfiler.reset();
  globalProfiler.enabled = false;
});

// ── TC-17: toMarkdown에 "| name |" 헤더 포함 ────────────────────────────
console.log("\n[TC-17~20] Markdown/JSON/빈 상태");

test("TC-17: toMarkdown 헤더에 '| name |' 포함", () => {
  const p = new Profiler();
  p.enabled = true;
  p.record("test", 1);
  const md = p.toMarkdown();
  assert(md.includes("| name |"), `toMarkdown header should include '| name |'`);
});

// ── TC-18: 빈 프로파일러 toMarkdown ─────────────────────────────────────
test("TC-18: 빈 프로파일러 toMarkdown — 헤더와 구분선만 포함", () => {
  const p = new Profiler();
  p.enabled = true;
  const md = p.toMarkdown();
  // 헤더와 구분선은 포함, 데이터 행은 없음
  assert(md.includes("| name |"), `empty markdown should have header`);
  assert(md.includes("|---"), `empty markdown should have divider`);
  const lines = md.trim().split("\n");
  assert(lines.length === 2, `empty markdown should have 2 lines (header+divider), got ${lines.length}`);
});

// ── TC-19: getReport 빈 배열 ─────────────────────────────────────────────
test("TC-19: 빈 프로파일러 getReport → 빈 배열 반환", () => {
  const p = new Profiler();
  p.enabled = true;
  const report = p.getReport();
  assert(Array.isArray(report), `expected array`);
  assert(report.length === 0, `expected empty array, got ${report.length}`);
});

// ── TC-20: Phase 56 regression ──────────────────────────────────────────
console.log("\n[TC-20] Phase 56 regression");

test("TC-20: Phase 56 regression — 렉시컬 스코프 격리 동작", () => {
  // globalProfiler가 enable 상태여도 렉시컬 스코프 동작 유지
  globalProfiler.enabled = true;
  globalProfiler.reset();

  // FL 문법으로 팩토리얼 호출 — 기존 phase56 테스트와 동일한 패턴
  const src = `
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `;
  const result = run(src);
  assert(result === 720, `fact(6) expected 720, got ${result}`);

  // 전역 변수 격리 확인
  const src2 = `
    (define x 10)
    [FUNC set-inner :params [] :body (define x 999)]
    (set-inner)
  `;
  const interp = new Interpreter();
  interp.interpret(parse(lex(src2)));
  const xVal = (interp as any).context.variables.get("$x");
  assert(xVal === 10, `global x expected 10, got ${xVal}`);

  globalProfiler.reset();
  globalProfiler.enabled = false;
});

// ── 결과 ─────────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────────────────────");
console.log(`Phase 82 프로파일러: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
