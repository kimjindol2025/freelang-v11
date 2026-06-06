// test-phase127-peer-review.ts — FreeLang v9 Phase 127: PEER-REVIEW
// 에이전트 간 피어 리뷰 시스템 테스트
// 최소 25개 PASS 목표

import { PeerReviewSystem, globalPeerReview, ReviewComment, Reviewer } from "./peer-review";
import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    results.push(`  ✅ PASS: ${name}`);
  } catch (e: any) {
    failed++;
    results.push(`  ❌ FAIL: ${name} — ${e.message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(a: T, b: T, msg?: string) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertDefined(v: any, msg?: string) {
  if (v === undefined || v === null) throw new Error(msg ?? `Expected defined value, got ${v}`);
}

function assertClose(a: number, b: number, tol = 0.0001, msg?: string) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `Expected ${b} ± ${tol}, got ${a}`);
}

console.log("\n=== Phase 127: PEER-REVIEW — 에이전트 피어 리뷰 ===\n");

// ─── 헬퍼: Interpreter 실행 ─────────────────────────────────────────────────
// 단일 Interpreter 인스턴스로 state 공유 (globalPeerReview 싱글톤 활용)
const interp = new Interpreter();

function run(code: string): any {
  const ctx = (interp as any).run(code);
  return (ctx as any).lastValue;
}

// ─── 1. 기본 클래스 테스트 ──────────────────────────────────────────────────

test("1. PeerReviewSystem 생성", () => {
  const prs = new PeerReviewSystem();
  assertDefined(prs, "PeerReviewSystem 인스턴스 없음");
});

test("2. addReviewer() 등록", () => {
  const prs = new PeerReviewSystem();
  const r: Reviewer = {
    id: "r1",
    review: (output: any) => ({
      reviewerId: "r1",
      aspect: "quality",
      score: 0.8,
      comment: "좋음",
    }),
  };
  prs.addReviewer(r);
  assertEq(prs.size(), 1, "리뷰어 1명 등록");
});

test("3. list() 목록", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "a", review: () => ({ reviewerId: "a", aspect: "x", score: 0.9, comment: "" }) });
  prs.addReviewer({ id: "b", review: () => ({ reviewerId: "b", aspect: "x", score: 0.8, comment: "" }) });
  const list = prs.list();
  assert(list.includes("a"), "a 포함");
  assert(list.includes("b"), "b 포함");
});

test("4. size() 카운트", () => {
  const prs = new PeerReviewSystem();
  assertEq(prs.size(), 0, "초기 0");
  prs.addReviewer({ id: "x", review: () => ({ reviewerId: "x", aspect: "q", score: 1, comment: "" }) });
  assertEq(prs.size(), 1, "1명 후 1");
});

test("5. review() 기본 동작", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.8, comment: "ok" }) });
  const result = prs.review("t1", "output");
  assertDefined(result, "review 결과 없음");
  assertEq(result.targetId, "t1", "targetId");
});

test("6. comments 배열", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.8, comment: "ok" }) });
  const result = prs.review("t1", "output");
  assert(Array.isArray(result.comments), "comments는 배열이어야 함");
  assertEq(result.comments.length, 1, "comments 1개");
});

test("7. averageScore 계산", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.8, comment: "" }) });
  prs.addReviewer({ id: "r2", review: () => ({ reviewerId: "r2", aspect: "clarity", score: 0.6, comment: "" }) });
  const result = prs.review("t1", "output");
  assertClose(result.averageScore, 0.7, 0.0001, "평균 0.7이어야 함");
});

test("8. approved=true (임계값 초과)", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.9, comment: "" }) });
  const result = prs.review("t1", "output");
  assert(result.approved === true, "0.9 >= 0.7 이므로 approved=true");
});

test("9. approved=false (임계값 미달)", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.4, comment: "" }) });
  const result = prs.review("t1", "output");
  assert(result.approved === false, "0.4 < 0.7 이므로 approved=false");
});

test("10. summary 문자열", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.9, comment: "" }) });
  const result = prs.review("t1", "output");
  assert(typeof result.summary === "string", "summary는 문자열이어야 함");
  assert(result.summary.length > 0, "summary 비어있으면 안 됨");
});

test("11. 특정 reviewerIds 선택", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.9, comment: "" }) });
  prs.addReviewer({ id: "r2", review: () => ({ reviewerId: "r2", aspect: "clarity", score: 0.3, comment: "" }) });
  const result = prs.review("t1", "output", ["r1"]);
  assertEq(result.comments.length, 1, "r1만 선택");
  assertEq(result.comments[0].reviewerId, "r1", "r1의 코멘트");
});

test("12. 전체 리뷰어 사용", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.8, comment: "" }) });
  prs.addReviewer({ id: "r2", review: () => ({ reviewerId: "r2", aspect: "clarity", score: 0.7, comment: "" }) });
  const result = prs.review("t1", "output");
  assertEq(result.comments.length, 2, "전체 2명");
});

test("13. 빈 리뷰어 → averageScore=0", () => {
  const prs = new PeerReviewSystem();
  const result = prs.review("t1", "output");
  assertEq(result.averageScore, 0, "리뷰어 없으면 0");
});

test("14. approvalThreshold 커스텀", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.6, comment: "" }) });
  const result = prs.review("t1", "output", undefined, 0.5);
  assert(result.approved === true, "threshold 0.5: 0.6 >= 0.5 이므로 approved");
});

test("15. comment.score 0~1", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "quality", score: 0.75, comment: "" }) });
  const result = prs.review("t1", "output");
  const score = result.comments[0].score;
  assert(score >= 0 && score <= 1, `score ${score} is in [0,1]`);
});

test("16. suggestion 포함 comment", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({
    id: "r1",
    review: () => ({
      reviewerId: "r1",
      aspect: "quality",
      score: 0.6,
      comment: "개선 필요",
      suggestion: "더 자세하게 작성할 것",
    }),
  });
  const result = prs.review("t1", "output");
  assertEq(result.comments[0].suggestion, "더 자세하게 작성할 것", "suggestion 포함");
});

test("17. aspect 필드 확인", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "r1", review: () => ({ reviewerId: "r1", aspect: "correctness", score: 0.9, comment: "" }) });
  const result = prs.review("t1", "output");
  assertEq(result.comments[0].aspect, "correctness", "aspect=correctness");
});

test("18. globalPeerReview 싱글톤", () => {
  assertDefined(globalPeerReview, "globalPeerReview 없음");
  assert(globalPeerReview instanceof PeerReviewSystem, "PeerReviewSystem 인스턴스여야 함");
});

// ─── 2. 내장 함수 테스트 ────────────────────────────────────────────────────

test("19. peer-review-add 내장함수", () => {
  run(`
    (peer-review-add "builtin-r1"
      (fn [output]
        {:aspect "quality" :score 0.85 :comment "looks good"}))
  `);
  // 에러 없이 실행되면 PASS
  assert(true, "peer-review-add 실행 성공");
});

test("20. peer-review 내장함수", () => {
  run(`
    (peer-review-add "builtin-r2"
      (fn [output]
        {:aspect "quality" :score 0.9 :comment "excellent"}))
  `);
  const result = run(`(peer-review "target-1" "my output")`);
  assert(typeof result === "boolean", "peer-review 결과는 boolean이어야 함");
});

test("21. peer-review-score 내장함수", () => {
  run(`
    (peer-review-add "builtin-r3"
      (fn [output]
        {:aspect "clarity" :score 0.75 :comment "clear"}))
  `);
  const result = run(`(peer-review-score "target-2" "my output")`);
  assert(typeof result === "number", "peer-review-score 결과는 숫자여야 함");
  assert(result >= 0 && result <= 1, `score ${result} in [0,1]`);
});

test("22. peer-review-comments 내장함수", () => {
  run(`
    (peer-review-add "builtin-r4"
      (fn [output]
        {:aspect "style" :score 0.8 :comment "clean code"}))
  `);
  const result = run(`(peer-review-comments "target-3" "my output")`);
  assert(Array.isArray(result), "peer-review-comments 결과는 배열이어야 함");
});

test("23. peer-review-list 내장함수", () => {
  run(`
    (peer-review-add "builtin-r5"
      (fn [output]
        {:aspect "performance" :score 0.7 :comment "fast"}))
  `);
  const result = run(`(peer-review-list)`);
  assert(Array.isArray(result), "peer-review-list 결과는 배열이어야 함");
  assert(result.length > 0, "리뷰어가 있어야 함");
});

// ─── 3. 추가 시나리오 테스트 ────────────────────────────────────────────────

test("24. 3명 리뷰어, 평균 계산", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "a", review: () => ({ reviewerId: "a", aspect: "quality", score: 0.6, comment: "" }) });
  prs.addReviewer({ id: "b", review: () => ({ reviewerId: "b", aspect: "clarity", score: 0.8, comment: "" }) });
  prs.addReviewer({ id: "c", review: () => ({ reviewerId: "c", aspect: "style", score: 1.0, comment: "" }) });
  const result = prs.review("t1", "output");
  assertClose(result.averageScore, 0.8, 0.0001, "평균 (0.6+0.8+1.0)/3 = 0.8");
  assertEq(result.comments.length, 3, "코멘트 3개");
});

test("25. 통합: add → review → approved", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({ id: "qa1", review: () => ({ reviewerId: "qa1", aspect: "correctness", score: 0.9, comment: "correct" }) });
  prs.addReviewer({ id: "qa2", review: () => ({ reviewerId: "qa2", aspect: "efficiency", score: 0.85, comment: "efficient" }) });
  const result = prs.review("integration-target", { code: "fn x => x * 2" });
  assert(result.approved === true, "평균 >= 0.7 이므로 approved");
  assert(result.summary.includes("승인"), "summary에 '승인' 포함");
});

// ─── 결과 출력 ──────────────────────────────────────────────────────────────

console.log(results.join("\n"));
console.log(`\n총 ${passed + failed}개 테스트: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
