// test-phase136-prune.ts — FreeLang v9 Phase 136: PRUNE 쓸모없는 것 자동 제거

import { Pruner, globalPruner, keepBest, removeWeak, PruneResult } from "./prune";
import { Interpreter } from "./interpreter";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`  PASS  ${name}`);
      pass++;
    } else {
      console.log(`  FAIL  ${name}`);
      fail++;
    }
  } catch (e: any) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    fail++;
  }
}

console.log("\n=== Phase 136: PRUNE 쓸모없는 것 자동 제거 ===\n");

const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const scorer = (x: number) => x / 10;

// ─── 1. Pruner 생성 ───────────────────────────────────────────────
test("1. Pruner 인스턴스 생성", () => {
  const p = new Pruner<number>();
  return p instanceof Pruner;
});

// ─── 2. pruneByThreshold 임계값 제거 ──────────────────────────────
test("2. pruneByThreshold — score < threshold 제거", () => {
  const p = new Pruner<number>();
  const result = p.pruneByThreshold(nums, scorer, 0.5);
  // score >= 0.5 → 5,6,7,8,9,10 유지
  return result.kept.length === 6 && result.removed.length === 4;
});

// ─── 3. pruneToTopK 상위 K개 ──────────────────────────────────────
test("3. pruneToTopK — 상위 3개만 유지", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 3);
  return result.kept.length === 3 && result.removed.length === 7;
});

// ─── 4. pruneToTopPercent 상위 50% ────────────────────────────────
test("4. pruneToTopPercent — 상위 50% 유지 (ceil(10*0.5)=5)", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopPercent(nums, scorer, 0.5);
  return result.kept.length === 5 && result.removed.length === 5;
});

// ─── 5. pruneWeak 평균 이하 제거 ──────────────────────────────────
test("5. pruneWeak — 평균 이하 제거 (avg=0.55, score>=0.55 유지)", () => {
  const p = new Pruner<number>();
  const result = p.pruneWeak(nums, scorer);
  // avg = (0.1+0.2+...+1.0)/10 = 5.5/10 = 0.55
  // score >= 0.55 → 6,7,8,9,10 유지
  return result.kept.length === 5 && result.removed.length === 5;
});

// ─── 6. dedup 중복 제거 ────────────────────────────────────────────
test("6. dedup — 중복 제거", () => {
  const p = new Pruner<number>();
  const withDups = [1, 2, 2, 3, 3, 3, 4];
  const result = p.dedup(withDups);
  return result.kept.length === 4 && result.removed.length === 3;
});

// ─── 7. PruneResult 구조 검증 ────────────────────────────────────
test("7. PruneResult — kept/removed/keptRatio/stats 구조", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 3);
  return (
    Array.isArray(result.kept) &&
    Array.isArray(result.removed) &&
    typeof result.keptRatio === "number" &&
    typeof result.strategy === "string" &&
    typeof result.stats === "object"
  );
});

// ─── 8. keptRatio = kept.length / total ───────────────────────────
test("8. keptRatio = kept/(kept+removed)", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 4);
  const expected = 4 / 10;
  return Math.abs(result.keptRatio - expected) < 1e-10;
});

// ─── 9. stats.originalCount 정확성 ───────────────────────────────
test("9. stats.originalCount = 원본 배열 길이", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 5);
  return result.stats.originalCount === 10;
});

// ─── 10. avgFitnessKept > avgFitnessRemoved ───────────────────────
test("10. avgFitnessKept > avgFitnessRemoved (항상)", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 5);
  return result.stats.avgFitnessKept > result.stats.avgFitnessRemoved;
});

// ─── 11. threshold=0 → 모두 제거 ─────────────────────────────────
test("11. threshold=0 → 모두 유지 (score >= 0 항상 true)", () => {
  // 0 이상이면 모두 유지 (실제 scorer 범위 0.1~1.0)
  const p = new Pruner<number>();
  const result = p.pruneByThreshold(nums, scorer, 0);
  return result.kept.length === 10 && result.removed.length === 0;
});

// ─── 12. threshold=1.1 → 모두 제거 ───────────────────────────────
test("12. threshold=1.1 → 모두 제거 (score는 최대 1.0)", () => {
  const p = new Pruner<number>();
  const result = p.pruneByThreshold(nums, scorer, 1.1);
  return result.kept.length === 0 && result.removed.length === 10;
});

// ─── 13. topK > items.length → 모두 유지 ─────────────────────────
test("13. topK > items.length → 모두 유지", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopK(nums, scorer, 100);
  return result.kept.length === 10;
});

// ─── 14. dedup 빈 배열 ───────────────────────────────────────────
test("14. dedup 빈 배열 → kept=[], removed=[]", () => {
  const p = new Pruner<number>();
  const result = p.dedup([]);
  return result.kept.length === 0 && result.removed.length === 0;
});

// ─── 15~21. 빌트인 함수 테스트 ────────────────────────────────────
const interp = new Interpreter();

function runFL(code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

test("15. prune-threshold 빌트인", () => {
  const result = runFL(`(prune-threshold [1 2 3 4 5 6 7 8 9 10] (fn [$x] (/ $x 10)) :min 0.5)`);
  if (!(result instanceof Map)) return false;
  const kept = result.get("kept");
  return Array.isArray(kept) && kept.length === 6;
});

test("16. prune-top-k 빌트인", () => {
  const result = runFL(`(prune-top-k [1 2 3 4 5 6 7 8 9 10] (fn [$x] (/ $x 10)) :k 3)`);
  if (!(result instanceof Map)) return false;
  const kept = result.get("kept");
  return Array.isArray(kept) && kept.length === 3;
});

test("17. prune-top-percent 빌트인", () => {
  const result = runFL(`(prune-top-percent [1 2 3 4 5 6 7 8 9 10] (fn [$x] (/ $x 10)) :percent 0.5)`);
  if (!(result instanceof Map)) return false;
  const kept = result.get("kept");
  return Array.isArray(kept) && kept.length === 5;
});

test("18. prune-weak 빌트인", () => {
  const result = runFL(`(prune-weak [1 2 3 4 5 6 7 8 9 10] (fn [$x] (/ $x 10)))`);
  if (!(result instanceof Map)) return false;
  const kept = result.get("kept");
  return Array.isArray(kept) && kept.length === 5;
});

test("19. prune-dedup 빌트인", () => {
  const result = runFL(`(prune-dedup [1 2 2 3 3 3])`);
  if (!(result instanceof Map)) return false;
  const kept = result.get("kept");
  return Array.isArray(kept) && kept.length === 3;
});

test("20. keep-best 빌트인", () => {
  const result = runFL(`(keep-best [1 2 3 4 5 6 7 8 9 10] (fn [$x] (/ $x 10)) :k 3)`);
  return Array.isArray(result) && result.length === 3;
});

test("21. prune-stats 빌트인", () => {
  const result = runFL(`(prune-stats (prune-top-k [1 2 3 4 5] (fn [$x] (/ $x 5)) :k 3))`);
  return result instanceof Map && result.has("originalCount");
});

// ─── 22. 원본 배열 불변 ───────────────────────────────────────────
test("22. 원본 배열 불변 (pruneToTopK 후 원본 배열 그대로)", () => {
  const original = [1, 2, 3, 4, 5];
  const copy = [...original];
  const p = new Pruner<number>();
  p.pruneToTopK(original, scorer, 2);
  return original.every((v, i) => v === copy[i]);
});

// ─── 23. kept + removed = original ───────────────────────────────
test("23. kept + removed = original (length 합산)", () => {
  const p = new Pruner<number>();
  const result = p.pruneByThreshold(nums, scorer, 0.3);
  return result.kept.length + result.removed.length === nums.length;
});

// ─── 24. pruneForDiversity 다양성 보존 ───────────────────────────
test("24. pruneForDiversity — 유사 항목 제거 (완전 동일 similarity)", () => {
  const p = new Pruner<number>();
  // 동일 similarity → 이미 kept에 있는 것과 같으면 제거
  const items = [10, 10, 10, 5, 1]; // 10이 3개 중복
  const simFn = (a: number, b: number) => (a === b ? 1.0 : 0.0);
  const result = p.pruneForDiversity(items, scorer, simFn, 0.0001);
  // 10, 5, 1 → 3개 유지 (중복 제거)
  return result.kept.length <= 3;
});

// ─── 25. topPercent=0.1 → 최소 1개 유지 ─────────────────────────
test("25. topPercent=0.1 → 최소 1개 유지 (ceil(10*0.1)=1)", () => {
  const p = new Pruner<number>();
  const result = p.pruneToTopPercent(nums, scorer, 0.1);
  return result.kept.length >= 1;
});

// ─── Summary ─────────────────────────────────────────────────────
console.log(`\n결과: ${pass} PASS / ${fail} FAIL / 총 ${pass + fail}\n`);
if (fail > 0) process.exit(1);
