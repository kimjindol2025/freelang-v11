// test-phase134-fitness.ts — Phase 134: [FITNESS] 적합도 함수 테스트
// 최소 25 PASS

import {
  FitnessEvaluator,
  globalFitness,
  fitnessScore,
  rankItems,
  FitnessResult,
} from "./fitness";
import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

console.log("\n=== Phase 134: FITNESS ===\n");

// 1. FitnessEvaluator 생성
test("FitnessEvaluator 생성", () => {
  const fe = new FitnessEvaluator();
  assert(fe instanceof FitnessEvaluator);
});

// 2. proximity 완벽 일치 → 1.0
test("proximity 완벽 일치 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.proximity(5.0, 5.0, 1.0);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

// 3. proximity 범위 밖 → 0.0
test("proximity 범위 밖 → 0.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.proximity(10.0, 5.0, 1.0);
  assert(approx(r.score, 0.0), `score=${r.score}`);
});

// 4. proximity 중간값
test("proximity 중간값", () => {
  const fe = new FitnessEvaluator();
  const r = fe.proximity(4.5, 5.0, 1.0);
  assert(r.score > 0 && r.score < 1, `score=${r.score}`);
  assert(approx(r.score, 0.5), `expected 0.5, got ${r.score}`);
});

// 5. stringSimilarity 동일 문자열 → 1.0
test("stringSimilarity 동일 문자열 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.stringSimilarity("hello", "hello");
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

// 6. stringSimilarity 완전 다름 → 0.0
test("stringSimilarity 완전 다름 → 0.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.stringSimilarity("abc", "xyz");
  assert(approx(r.score, 0.0), `score=${r.score}`);
});

// 7. stringSimilarity 부분 유사
test("stringSimilarity 부분 유사", () => {
  const fe = new FitnessEvaluator();
  const r = fe.stringSimilarity("hello", "hella");
  assert(r.score > 0 && r.score < 1, `score=${r.score}`);
});

// 8. arrayMatch 완전 일치 → 1.0
test("arrayMatch 완전 일치 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.arrayMatch([1, 2, 3], [1, 2, 3]);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

// 9. arrayMatch 부분 일치
test("arrayMatch 부분 일치", () => {
  const fe = new FitnessEvaluator();
  const r = fe.arrayMatch([1, 2, 3], [1, 2, 4]);
  assert(r.score > 0 && r.score < 1, `score=${r.score}`);
  // 2/3 일치
  assert(approx(r.rawScore, 2 / 3, 0.01), `rawScore=${r.rawScore}`);
});

// 10. multiObjective 가중치 적용
test("multiObjective 가중치 적용", () => {
  const fe = new FitnessEvaluator();
  const r = fe.multiObjective(
    { speed: 0.8, accuracy: 0.9 },
    { speed: 1.0, accuracy: 1.0 },
    { speed: 2.0, accuracy: 1.0 }
  );
  assert(r.score >= 0 && r.score <= 1, `score=${r.score}`);
  assert(r.details.speed !== undefined, "details.speed missing");
  assert(r.details.accuracy !== undefined, "details.accuracy missing");
});

// 11. constraintSatisfaction 모두 만족 → 1.0
test("constraintSatisfaction 모두 만족 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.constraintSatisfaction(4, [
    (v) => typeof v === "number" && v > 0,
    (v) => typeof v === "number" && (v as number) % 2 === 0,
  ]);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

// 12. constraintSatisfaction 일부 불만족
test("constraintSatisfaction 일부 불만족", () => {
  const fe = new FitnessEvaluator();
  const r = fe.constraintSatisfaction(3, [
    (v) => typeof v === "number" && v > 0,
    (v) => typeof v === "number" && (v as number) % 2 === 0,
  ]);
  assert(approx(r.score, 0.5), `score=${r.score}`);
});

// 13. rank() 정렬
test("rank() 정렬", () => {
  const fe = new FitnessEvaluator();
  const items = [{ name: "c", val: 3 }, { name: "a", val: 10 }, { name: "b", val: 7 }];
  const ranked = fe.rank(items, (item) => item.val);
  assert(ranked[0].rank === 1, `first rank=${ranked[0].rank}`);
  assert(ranked[0].score === 10, `first score=${ranked[0].score}`);
  assert(ranked[ranked.length - 1].rank === 3, `last rank=${ranked[ranked.length - 1].rank}`);
});

// 14. paretoFront() 파레토 최적
test("paretoFront() 파레토 최적", () => {
  const fe = new FitnessEvaluator();
  const items = [
    { speed: 10, accuracy: 5 },
    { speed: 5, accuracy: 10 },
    { speed: 3, accuracy: 3 }, // 두 목표 모두 열등
  ];
  const front = fe.paretoFront(items, [
    (i) => i.speed,
    (i) => i.accuracy,
  ]);
  assert(front.length === 2, `front.length=${front.length}`);
  // 열등한 항목은 제거됨
  assert(!front.some(i => i.speed === 3 && i.accuracy === 3), "dominated item in front");
});

// 15. FitnessResult 구조 확인
test("FitnessResult 구조 확인", () => {
  const fe = new FitnessEvaluator();
  const r = fe.proximity(5, 5, 1);
  assert(typeof r.score === "number", "score missing");
  assert(typeof r.rawScore === "number", "rawScore missing");
  assert(typeof r.details === "object", "details missing");
});

// 16~23: 빌트인 함수 테스트
const interp = new Interpreter();

function evalFL(code: string): any {
  const state = interp.run(code);
  return (state as any).lastValue;
}

// 16. fitness-proximity 빌트인
test("fitness-proximity 빌트인", () => {
  const r = evalFL("(fitness-proximity 5.0 5.0 1.0)");
  assert(r instanceof Map, "result is not Map");
  const score = r.get("score");
  assert(approx(score, 1.0), `score=${score}`);
});

// 17. fitness-string 빌트인
test("fitness-string 빌트인", () => {
  const r = evalFL('(fitness-string "hello" "hello")');
  assert(r instanceof Map, "result is not Map");
  const score = r.get("score");
  assert(approx(score, 1.0), `score=${score}`);
});

// 18. fitness-array 빌트인
test("fitness-array 빌트인", () => {
  const r = evalFL("(fitness-array [1 2 3] [1 2 3])");
  assert(r instanceof Map, "result is not Map");
  const score = r.get("score");
  assert(approx(score, 1.0), `score=${score}`);
});

// 19. fitness-multi 빌트인
test("fitness-multi 빌트인", () => {
  const r = evalFL("(fitness-multi {:speed 1.0 :accuracy 1.0} {:speed 1.0 :accuracy 1.0})");
  assert(r instanceof Map, "result is not Map");
  const score = r.get("score");
  assert(approx(score, 1.0, 0.01), `score=${score}`);
});

// 20. fitness-constraint 빌트인 (키워드 제약)
test("fitness-constraint 빌트인 (positive, even)", () => {
  const r = evalFL('(fitness-constraint 4 ["positive" "even"])');
  assert(r instanceof Map, "result is not Map");
  const score = r.get("score");
  assert(approx(score, 1.0), `score=${score}`);
});

// 21. fitness-rank 빌트인
test("fitness-rank 빌트인", () => {
  const r = evalFL("(fitness-rank [1 2 3] (fn [$x] $x))");
  assert(Array.isArray(r), "result is not array");
  assert(r.length === 3, `length=${r.length}`);
  const first = r[0];
  assert(first instanceof Map, "element is not Map");
});

// 22. fitness-pareto 빌트인
test("fitness-pareto 빌트인", () => {
  const r = evalFL("(fitness-pareto [1 2 3] [(fn [$x] $x)])");
  assert(Array.isArray(r), "result is not array");
  assert(r.length > 0, "pareto front empty");
});

// 23. fitness-score 빌트인 — score 추출
test("fitness-score 빌트인", () => {
  const r = evalFL("(fitness-score (fitness-proximity 5.0 5.0 1.0))");
  assert(approx(Number(r), 1.0), `score=${r}`);
});

// 24. normalize=false 원점수 반환
test("normalize=false 원점수 반환 (rawScore)", () => {
  const fe = new FitnessEvaluator({ normalize: false });
  const r = fe.proximity(4.5, 5.0, 1.0);
  assert(typeof r.rawScore === "number", "rawScore is not number");
  assert(approx(r.rawScore, 0.5), `rawScore=${r.rawScore}`);
});

// 25. maximize=false 역전 (낮을수록 좋음)
test("maximize=false 역전 (낮을수록 좋음)", () => {
  const fe = new FitnessEvaluator({ maximize: false });
  const r = fe.proximity(5.0, 5.0, 1.0);
  // 완벽히 일치해도 maximize=false이면 점수가 역전 (1 - 1 = 0)
  assert(approx(r.score, 0.0), `score=${r.score}`);

  const r2 = fe.proximity(10.0, 5.0, 1.0);
  // 범위 밖이면 rawScore=0, maximize=false → 1 - 0 = 1
  assert(approx(r2.score, 1.0), `score2=${r2.score}`);
});

// 보너스 테스트
test("globalFitness 인스턴스 사용", () => {
  const r = globalFitness.proximity(3.0, 3.0);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

test("fitnessScore 헬퍼 함수", () => {
  const s = fitnessScore(7.0, 7.0);
  assert(approx(s, 1.0), `score=${s}`);
});

test("rankItems 헬퍼 함수", () => {
  const items = ["c", "a", "b"];
  const scores = [3, 10, 7];
  const ranked = rankItems(items, scores);
  assert(ranked[0].item === "a", `first=${ranked[0].item}`);
  assert(ranked[0].rank === 1);
});

test("stringSimilarity 빈 문자열 처리", () => {
  const fe = new FitnessEvaluator();
  const r = fe.stringSimilarity("", "");
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

test("arrayMatch 빈 배열 처리", () => {
  const fe = new FitnessEvaluator();
  const r = fe.arrayMatch([], []);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

test("constraintSatisfaction 빈 제약 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.constraintSatisfaction(42, []);
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

test("multiObjective 빈 목표 → 1.0", () => {
  const fe = new FitnessEvaluator();
  const r = fe.multiObjective({}, {});
  assert(approx(r.score, 1.0), `score=${r.score}`);
});

// 결과 요약
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL ===\n`);
if (failed > 0) process.exit(1);
