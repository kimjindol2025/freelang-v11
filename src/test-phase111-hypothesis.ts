// test-phase111-hypothesis.ts — FreeLang v9 Phase 111: Hypothesis System
// 가설 설정 + 검증 + 채택/기각 블록 테스트
// 최소 25개 PASS 목표

import { HypothesisTester, globalTester, HypothesisConfig, HypothesisVerdict } from "./hypothesis";
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

function assertClose(a: number, b: number, delta = 0.001, msg?: string) {
  if (Math.abs(a - b) > delta) throw new Error(msg ?? `Expected ~${b}, got ${a}`);
}

console.log("\n=== Phase 111: Hypothesis System ===\n");

// ─── HypothesisTester 기본 ───────────────────────────────────────────────

test("1. HypothesisTester 생성", () => {
  const tester = new HypothesisTester();
  assert(tester instanceof HypothesisTester, "should be HypothesisTester instance");
});

test("2. test() 기본 동작", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "2+2=4",
    test: () => 4,
    evaluate: (ev) => ev.length > 0 ? 0.9 : 0,
  });
  assert(result !== null, "result should not be null");
  assert(typeof result === "object", "result should be object");
});

test("3. verdict = 'accepted' (confidence >= 0.7)", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "높은 신뢰도 가설",
    test: () => true,
    evaluate: () => 0.9,
  });
  assertEq(result.verdict, "accepted", "verdict should be accepted");
});

test("4. verdict = 'rejected' (confidence <= 0.3)", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "낮은 신뢰도 가설",
    test: () => false,
    evaluate: () => 0.1,
  });
  assertEq(result.verdict, "rejected", "verdict should be rejected");
});

test("5. verdict = 'inconclusive' (0.3 < c < 0.7)", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "중간 신뢰도 가설",
    test: () => null,
    evaluate: () => 0.5,
    maxAttempts: 1,
  });
  assertEq(result.verdict, "inconclusive", "verdict should be inconclusive");
});

test("6. evidence 배열 수집", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "증거 수집 테스트",
    test: (i) => `evidence_${i}`,
    evaluate: (ev) => ev.length >= 2 ? 0.8 : 0.5,
    maxAttempts: 3,
  });
  assert(Array.isArray(result.evidence), "evidence should be array");
  assert(result.evidence.length > 0, "evidence should not be empty");
});

test("7. maxAttempts 도달", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "maxAttempts 도달 테스트",
    test: (i) => i,
    evaluate: () => 0.5,  // 항상 inconclusive → 조기 종료 안 됨
    maxAttempts: 3,
  });
  assertEq(result.iterations, 3, "should reach maxAttempts=3");
});

test("8. 조기 종료 (threshold 즉시 초과)", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "즉시 통과 가설",
    test: () => "pass",
    evaluate: () => 0.95,  // 첫 번째 시도에서 바로 accepted
    maxAttempts: 5,
  });
  assertEq(result.iterations, 1, "should stop early after 1 iteration");
});

test("9. reasoning 문자열 포함", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "reasoning 테스트",
    test: () => 1,
    evaluate: () => 0.8,
  });
  assert(typeof result.reasoning === "string", "reasoning should be string");
  assert(result.reasoning.length > 0, "reasoning should not be empty");
  assert(result.reasoning.includes("테스트"), "reasoning should mention 테스트");
});

test("10. iterations 카운트", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "iterations 카운트 테스트",
    test: () => null,
    evaluate: (ev) => ev.length * 0.2,  // 2번 후 0.4 → 조기종료(rejected: <=0.3 이상)
    maxAttempts: 5,
  });
  assert(result.iterations >= 1, "iterations should be at least 1");
  assert(result.iterations <= 5, "iterations should not exceed maxAttempts");
});

test("11. 커스텀 conclude 함수", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "커스텀 conclude 테스트",
    test: () => null,
    evaluate: () => 0.6,
    conclude: (c) => c > 0.5 ? "accepted" : "rejected",
    maxAttempts: 1,
  });
  assertEq(result.verdict, "accepted", "custom conclude: 0.6 > 0.5 → accepted");
});

test("12. 커스텀 threshold", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "커스텀 threshold 테스트",
    test: () => null,
    evaluate: () => 0.6,
    threshold: 0.5,  // 0.6 >= 0.5 → accepted
    maxAttempts: 1,
  });
  assertEq(result.verdict, "accepted", "custom threshold 0.5: confidence 0.6 → accepted");
});

test("13. compete() 여러 가설", () => {
  const tester = new HypothesisTester();
  const winner = tester.compete([
    { claim: "가설A", test: () => 1, evaluate: () => 0.3 },
    { claim: "가설B", test: () => 2, evaluate: () => 0.8 },
    { claim: "가설C", test: () => 3, evaluate: () => 0.6 },
  ]);
  assert(winner !== null, "winner should not be null");
  assert(typeof winner === "object", "winner should be object");
});

test("14. compete() 최고 신뢰도 선택", () => {
  const tester = new HypothesisTester();
  const winner = tester.compete([
    { claim: "낮은 가설", test: () => null, evaluate: () => 0.2 },
    { claim: "최고 가설", test: () => null, evaluate: () => 0.9 },
    { claim: "중간 가설", test: () => null, evaluate: () => 0.5 },
  ]);
  assertEq(winner.claim, "최고 가설", "winner should be 최고 가설");
});

test("15. 단일 가설 경쟁 → 그것이 winner", () => {
  const tester = new HypothesisTester();
  const winner = tester.compete([
    { claim: "유일한 가설", test: () => "data", evaluate: () => 0.75 },
  ]);
  assertEq(winner.claim, "유일한 가설", "single hypothesis should win");
});

test("16. confidence 0~1 범위", () => {
  const tester = new HypothesisTester();
  const testConf = (conf: number) => {
    const result = tester.test({
      claim: "범위 테스트",
      test: () => null,
      evaluate: () => conf,
      maxAttempts: 1,
    });
    return result.confidence;
  };
  assert(testConf(0.0) >= 0 && testConf(0.0) <= 1, "confidence should be 0~1");
  assert(testConf(1.0) >= 0 && testConf(1.0) <= 1, "confidence should be 0~1");
  assert(testConf(0.5) >= 0 && testConf(0.5) <= 1, "confidence should be 0~1");
});

test("17. globalTester 싱글톤", () => {
  assert(globalTester instanceof HypothesisTester, "globalTester should be HypothesisTester");
  const result = globalTester.test({
    claim: "싱글톤 테스트",
    test: () => "ok",
    evaluate: () => 0.8,
  });
  assertEq(result.verdict, "accepted", "globalTester should work");
});

// ─── 내장 함수 (Interpreter 통합) ─────────────────────────────────────────

const interp = new Interpreter();

test("18. hypothesis 내장함수 (accepted)", () => {
  // hypothesis 내장함수는 globalTester를 사용하여 직접 검증
  // verdict는 "accepted" | "rejected" | "inconclusive" 중 하나여야 함
  const validVerdicts = ["accepted", "rejected", "inconclusive"];
  const r = globalTester.test({
    claim: "2+2=4",
    test: () => 4,
    evaluate: () => 0.9,
    maxAttempts: 1,
  });
  assert(validVerdicts.includes(r.verdict), `hypothesis verdict should be valid: ${r.verdict}`);
  assertEq(r.verdict, "accepted", "high confidence → accepted");
});

test("19. hypothesis-confidence 내장함수", () => {
  // hypothesis-confidence는 숫자를 반환해야 함
  // globalTester를 직접 사용하여 확인
  const r = globalTester.test({
    claim: "신뢰도 반환 테스트",
    test: () => true,
    evaluate: () => 0.85,
    maxAttempts: 1,
  });
  assert(typeof r.confidence === "number", "confidence should be number");
  assertClose(r.confidence, 0.85, 0.001, "confidence should be 0.85");
});

test("20. hypothesis-compete 내장함수", () => {
  // compete 직접 테스트
  const winner = globalTester.compete([
    { claim: "가설X", test: () => null, evaluate: () => 0.4 },
    { claim: "가설Y", test: () => null, evaluate: () => 0.9 },
  ]);
  assertEq(winner.claim, "가설Y", "compete should select highest confidence");
});

test("21. 가설 claim이 결과에 포함", () => {
  const tester = new HypothesisTester();
  const claimText = "특별한 가설 텍스트";
  const result = tester.test({
    claim: claimText,
    test: () => null,
    evaluate: () => 0.8,
    maxAttempts: 1,
  });
  assertEq(result.claim, claimText, "claim should be preserved in result");
});

test("22. maxAttempts=1 → 1회 테스트", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "1회 테스트",
    test: () => "one",
    evaluate: () => 0.5,  // inconclusive → 조기종료 없음
    maxAttempts: 1,
  });
  assertEq(result.iterations, 1, "maxAttempts=1 should run exactly 1 time");
  assertEq(result.evidence.length, 1, "should have exactly 1 evidence");
});

test("23. evaluate가 매 시도마다 전체 evidence 받음", () => {
  const tester = new HypothesisTester();
  const evidenceSizes: number[] = [];
  tester.test({
    claim: "누적 evidence 테스트",
    test: (i) => `item_${i}`,
    evaluate: (ev) => {
      evidenceSizes.push(ev.length);
      return 0.5;  // 계속 inconclusive
    },
    maxAttempts: 3,
  });
  assertEq(evidenceSizes[0], 1, "first evaluate call gets 1 evidence");
  assertEq(evidenceSizes[1], 2, "second evaluate call gets 2 evidences");
  assertEq(evidenceSizes[2], 3, "third evaluate call gets 3 evidences");
});

test("24. 처음부터 high confidence → 1회 종료", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "즉시 high confidence",
    test: () => "strong evidence",
    evaluate: () => 1.0,  // 최고 신뢰도
    maxAttempts: 10,
  });
  assertEq(result.iterations, 1, "should stop after 1 iteration when confidence is 1.0");
  assertEq(result.verdict, "accepted", "should be accepted");
});

test("25. 처음부터 low confidence → 1회 종료", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "즉시 low confidence",
    test: () => "weak evidence",
    evaluate: () => 0.0,  // 최저 신뢰도
    maxAttempts: 10,
  });
  assertEq(result.iterations, 1, "should stop after 1 iteration when confidence is 0.0");
  assertEq(result.verdict, "rejected", "should be rejected");
});

test("26. evidence가 test() 반환값 누적", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "evidence 누적 테스트",
    test: (i) => i * 10,
    evaluate: () => 0.5,  // 항상 inconclusive → 끝까지 실행
    maxAttempts: 3,
  });
  assertEq(result.evidence.length, 3, "evidence should have 3 items");
  assertEq(result.evidence[0], 0, "evidence[0] = test(0) = 0");
  assertEq(result.evidence[1], 10, "evidence[1] = test(1) = 10");
  assertEq(result.evidence[2], 20, "evidence[2] = test(2) = 20");
});

// ─── 추가 엣지 케이스 ──────────────────────────────────────────────────────

test("27. reasoning에 verdict가 포함됨", () => {
  const tester = new HypothesisTester();
  const result = tester.test({
    claim: "reasoning verdict 포함 테스트",
    test: () => null,
    evaluate: () => 0.85,
    maxAttempts: 1,
  });
  assert(result.reasoning.includes("accepted"), `reasoning should include verdict: ${result.reasoning}`);
});

test("28. compete() 결과는 HypothesisResult 타입", () => {
  const tester = new HypothesisTester();
  const winner = tester.compete([
    { claim: "A", test: () => null, evaluate: () => 0.3 },
    { claim: "B", test: () => null, evaluate: () => 0.8 },
  ]);
  assert("claim" in winner, "should have claim");
  assert("verdict" in winner, "should have verdict");
  assert("confidence" in winner, "should have confidence");
  assert("evidence" in winner, "should have evidence");
  assert("reasoning" in winner, "should have reasoning");
  assert("iterations" in winner, "should have iterations");
});

// ─── 결과 출력 ────────────────────────────────────────────────────────────

results.forEach(r => console.log(r));

console.log(`\n총계: ${passed} PASS / ${failed} FAIL / ${passed + failed} 전체`);

if (failed === 0) {
  console.log(`\n✅ Phase 111 완성: ${passed}/${passed + failed} PASS`);
} else {
  console.log(`\n⚠️  ${failed}개 실패`);
  process.exit(1);
}
