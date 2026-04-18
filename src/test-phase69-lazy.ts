// Phase 69: 레이지 시퀀스 테스트
// iterate / range (lazy) / filter-lazy / map-lazy / drop / take

import { Interpreter } from "./interpreter";
import { isLazySeq, take, drop, iterate, rangeSeq, filterLazy, mapLazy } from "./lazy-seq";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEqual"}: expected ${e}, got ${a}`);
}

function run(interp: Interpreter, src: string): any {
  const ctx = interp.run(src);
  return ctx.lastValue;
}

// ─────────────────────────────────────────────
console.log("\n=== Phase 69: 레이지 시퀀스 테스트 ===\n");

// ── TC-1: TypeScript 레벨 iterate ──
test("TC-1: [TS] iterate — 무한 자연수, take 5", () => {
  const naturals = iterate((n: number) => n + 1, 0);
  assert(isLazySeq(naturals), "iterate should return LazySeq");
  const result = take(5, naturals);
  assertEqual(result, [0, 1, 2, 3, 4], "take 5 naturals");
});

// ── TC-2: TypeScript 레벨 rangeSeq ──
test("TC-2: [TS] rangeSeq(0, 10), take 5", () => {
  const r = rangeSeq(0, 10);
  assert(r !== null, "rangeSeq should not be null");
  const result = take(5, r!);
  assertEqual(result, [0, 1, 2, 3, 4], "take 5 from range(0,10)");
});

test("TC-2b: [TS] rangeSeq drop+take", () => {
  const r = rangeSeq(0, 20);
  const d = drop(5, r);
  assert(d !== null, "after drop should not be null");
  const result = take(3, d!);
  assertEqual(result, [5, 6, 7], "drop 5 then take 3");
});

// ── TC-3: TypeScript 레벨 filterLazy ──
test("TC-3: [TS] filterLazy 짝수, take 5", () => {
  const naturals = iterate((n: number) => n + 1, 0);
  const evens = filterLazy((n: number) => n % 2 === 0, naturals);
  assert(evens !== null, "filterLazy should not be null");
  const result = take(5, evens!);
  assertEqual(result, [0, 2, 4, 6, 8], "first 5 even numbers");
});

// ── TC-4: TypeScript 레벨 mapLazy ──
test("TC-4: [TS] mapLazy ×2, take 5", () => {
  const naturals = iterate((n: number) => n + 1, 1);
  const doubled = mapLazy((n: number) => n * 2, naturals);
  assert(doubled !== null, "mapLazy should not be null");
  const result = take(5, doubled!);
  assertEqual(result, [2, 4, 6, 8, 10], "first 5 doubled from 1");
});

// ── TC-5: 무한 시퀀스가 메모리 폭발 안 함 ──
test("TC-5: [TS] 무한 iterate take 100 (메모리 폭발 없음)", () => {
  const naturals = iterate((n: number) => n + 1, 0);
  const result = take(100, naturals);
  assert(result.length === 100, `expected 100 elements, got ${result.length}`);
  assert(result[99] === 99, `last element should be 99, got ${result[99]}`);
});

// ── TC-6: drop + take 조합 ──
test("TC-6: [TS] drop(5, range) + take(3)", () => {
  const bigRange = rangeSeq(0); // 무한 자연수
  const dropped = drop(5, bigRange);
  const result = take(3, dropped!);
  assertEqual(result, [5, 6, 7], "drop 5 from infinite range, take 3");
});

// ── TC-7: FreeLang 코드에서 iterate + take ──
console.log("\n--- FL 코드 테스트 ---\n");

test("TC-7: [FL] iterate 무한 자연수 (take 5)", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define naturals (iterate (fn [$n] (+ $n 1)) 0))
    (take 5 naturals)
  `);
  assertEqual(result, [0, 1, 2, 3, 4], "FL iterate + take");
});

test("TC-8: [FL] range(10) take 3", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define r (range 10))
    (take 3 r)
  `);
  assertEqual(result, [0, 1, 2], "FL range take 3");
});

test("TC-9: [FL] range take drop 조합", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define big-range (range 1000000))
    (take 3 (drop 5 big-range))
  `);
  assertEqual(result, [5, 6, 7], "FL range drop take");
});

test("TC-10: [FL] filter-lazy 짝수 take 5", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define naturals (iterate (fn [$n] (+ $n 1)) 0))
    (define evens (filter-lazy (fn [$x] (= (% $x 2) 0)) naturals))
    (take 5 evens)
  `);
  assertEqual(result, [0, 2, 4, 6, 8], "FL filter-lazy evens");
});

test("TC-11: [FL] map-lazy ×2 take 5", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define naturals (iterate (fn [$n] (+ $n 1)) 1))
    (define doubled (map-lazy (fn [$x] (* $x 2)) naturals))
    (take 5 doubled)
  `);
  assertEqual(result, [2, 4, 6, 8, 10], "FL map-lazy doubled");
});

test("TC-12: [FL] lazy? predicate", () => {
  const interp = new Interpreter();
  const r1 = run(interp, `(lazy? (range 100))`);
  assert(r1 === true, "range should be lazy");
  const r2 = run(interp, `(lazy? [1 2 3])`);
  assert(r2 === false, "array should not be lazy");
});

test("TC-13: [FL] toDisplayString lazy-seq 미리보기", () => {
  const interp = new Interpreter();
  // print 없이 lastValue가 LazySeq일 때 toDisplayString 확인
  const ctx = interp.run(`(iterate (fn [$n] (+ $n 1)) 0)`);
  const disp = (interp as any).toDisplayString(ctx.lastValue);
  assert(disp.startsWith("<lazy-seq:"), `display should start with <lazy-seq:, got: ${disp}`);
  assert(disp.includes("0"), `display should contain 0, got: ${disp}`);
});

// ── TC-14: Phase 56 Regression (lexical scope) ──
console.log("\n--- Phase 56 Regression ---\n");

test("TC-14a: [Regression] 클로저 캡처", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define make-adder (fn [$x] (fn [$y] (+ $x $y))))
    (define add5 (make-adder 5))
    (add5 3)
  `);
  assert(result === 8, `closure expected 8, got ${result}`);
});

test("TC-14b: [Regression] let 바인딩 (FL 문법: [[$x 10][$y 20]])", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (let [[$x 10] [$y 20]] (+ $x $y))
  `);
  assert(result === 30, `let expected 30, got ${result}`);
});

test("TC-14c: [Regression] 재귀 함수", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define fact (fn [$n] (if (<= $n 1) 1 (* $n (fact (- $n 1))))))
    (fact 5)
  `);
  assert(result === 120, `factorial expected 120, got ${result}`);
});

test("TC-14d: [Regression] map 3-arg form", () => {
  const interp = new Interpreter();
  // FL map 문법: (map arr [params] body)
  const result = run(interp, `
    (map (map [1 2 3 4 5] [$x] (* $x 2)) [$x] (if (> $x 3) $x null))
  `);
  // filter 특수 폼 없이 map으로 대체 — 짝수 배열 직접 생성으로 테스트
  const result2 = run(interp, `
    (map [1 2 3 4 5] [$x] (* $x 2))
  `);
  assertEqual(result2, [2, 4, 6, 8, 10], "map 3-arg form");
});

test("TC-14e: [Regression] cond 분기 (FL 문법: [pred val])", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (define classify (fn [$n]
      (cond
        [(< $n 0) "negative"]
        [(= $n 0) "zero"]
        [true "positive"])))
    (classify 5)
  `);
  assert(result === "positive", `cond expected positive, got ${result}`);
});

test("TC-14f: [Regression] map 3-arg 고차 함수", () => {
  const interp = new Interpreter();
  const result = run(interp, `
    (map [1 2 3 4] [$x] (* $x 2))
  `);
  assertEqual(result, [2, 4, 6, 8], "map 3-arg doubled");
});

// ── 결과 요약 ──
console.log(`\n${"─".repeat(45)}`);
const total = passed + failed;
console.log(`결과: ${passed}/${total} PASS`);
if (failed > 0) {
  console.log(`실패: ${failed}개`);
  process.exit(1);
} else {
  console.log("모든 테스트 통과!");
}
