// test-phase121-consensus.ts — FreeLang v9 Phase 121: CONSENSUS 여러 에이전트 합의
// 단일 AI 편향을 극복하는 다수결/가중평균/임계값/만장일치 메커니즘
// 최소 25개 PASS 목표

import { ConsensusEngine, globalConsensus, AgentVote, ConsensusResult } from "./consensus";
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

function assertNull(v: any, msg?: string) {
  if (v !== null && v !== undefined) throw new Error(msg ?? `Expected null, got ${JSON.stringify(v)}`);
}

function assertClose(a: number, b: number, tol = 0.0001, msg?: string) {
  if (Math.abs(a - b) > tol) throw new Error(msg ?? `Expected ~${b}, got ${a}`);
}

function assertInRange(v: number, lo: number, hi: number, msg?: string) {
  if (v < lo || v > hi) throw new Error(msg ?? `Expected ${v} in [${lo}, ${hi}]`);
}

console.log("\n=== Phase 121: CONSENSUS 여러 에이전트 합의 ===\n");

// ─── 1. ConsensusEngine 생성 ───────────────────────────────────────────────

test("1. ConsensusEngine 클래스 인스턴스 생성", () => {
  const engine = new ConsensusEngine();
  assertDefined(engine, "ConsensusEngine 인스턴스 없음");
});

// ─── 2. majority() 다수결 ─────────────────────────────────────────────────

test("2. majority() 다수결 winner 선택", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
    { agentId: "a3", answer: "no",  confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertEq(result.answer, "yes", "다수결 winner는 yes여야 함");
});

test("3. majority() 동점 처리 — 첫 번째 최다 그룹이 winner", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "A", confidence: 0.5 },
    { agentId: "a2", answer: "B", confidence: 0.5 },
  ];
  const result = engine.majority(votes);
  // 동점 시 정렬 결과 첫 번째가 winner (A or B)
  assertDefined(result.answer, "동점 시 winner가 있어야 함");
});

test("4. majority() agreement 계산 — 3중 2면 0.666...", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
    { agentId: "a3", answer: "no",  confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertClose(result.agreement, 2/3, 0.001, "agreement는 2/3이어야 함");
});

test("5. majority() dissent 포함", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
    { agentId: "a3", answer: "no",  confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertEq(result.dissent.length, 1, "소수 의견 1개여야 함");
  assertEq(result.dissent[0].answer, "no", "소수 의견은 no여야 함");
});

// ─── 3. weighted() 가중 평균 ──────────────────────────────────────────────

test("6. weighted() 가중 평균 — confidence 비례", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "a1", answer: 10, confidence: 0.5 },
    { agentId: "a2", answer: 20, confidence: 0.5 },
  ];
  const result = engine.weighted(votes);
  assertClose(result.answer, 15, 0.001, "가중 평균은 15여야 함");
});

test("7. weighted() 단일 vote — 그 값이 answer", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "solo", answer: 42, confidence: 1.0 },
  ];
  const result = engine.weighted(votes);
  assertClose(result.answer, 42, 0.001, "단일 vote는 그 값이어야 함");
});

test("8. weighted() confidence 불균등 가중 — 높은 쪽 당김", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "a1", answer: 100, confidence: 0.9 },
    { agentId: "a2", answer: 0,   confidence: 0.1 },
  ];
  const result = engine.weighted(votes);
  // 90/(0.9+0.1) = 90
  assertClose(result.answer, 90, 0.001, "가중 평균은 90이어야 함");
});

// ─── 4. threshold() 임계값 ────────────────────────────────────────────────

test("9. threshold() 임계값 통과", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "ok", confidence: 0.85 },
    { agentId: "a2", answer: "ok", confidence: 0.9 },
  ];
  const result = engine.threshold(votes, 0.8);
  assertDefined(result, "threshold 통과 시 결과 있어야 함");
  assertEq(result!.answer, "ok", "answer는 ok여야 함");
});

test("10. threshold() 임계값 미달 → null", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "ok", confidence: 0.4 },
    { agentId: "a2", answer: "ok", confidence: 0.5 },
  ];
  const result = engine.threshold(votes, 0.8);
  assertNull(result, "임계값 미달 시 null이어야 함");
});

test("11. threshold() 기본 threshold=0.7 동작", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "pass", confidence: 0.75 },
    { agentId: "a2", answer: "pass", confidence: 0.8 },
  ];
  const result = engine.threshold(votes);
  assertDefined(result, "기본 threshold 통과여야 함");
});

// ─── 5. unanimous() 만장일치 ─────────────────────────────────────────────

test("12. unanimous() 만장일치 성공", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
    { agentId: "a3", answer: "yes", confidence: 0.95 },
  ];
  const result = engine.unanimous(votes);
  assertDefined(result, "만장일치 결과 있어야 함");
  assertEq(result!.agreement, 1.0, "agreement는 1.0이어야 함");
});

test("13. unanimous() 불일치 → null", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "no",  confidence: 0.8 },
  ];
  const result = engine.unanimous(votes);
  assertNull(result, "불일치 시 null이어야 함");
});

// ─── 6. 엣지 케이스 ───────────────────────────────────────────────────────

test("14. 빈 votes → majority 예외", () => {
  const engine = new ConsensusEngine();
  let threw = false;
  try {
    engine.majority([]);
  } catch {
    threw = true;
  }
  assert(threw, "빈 votes에서 예외 발생해야 함");
});

test("15. 빈 votes → threshold null", () => {
  const engine = new ConsensusEngine();
  const result = engine.threshold([]);
  assertNull(result, "빈 votes threshold → null이어야 함");
});

test("16. 단일 vote → majority의 winner", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "solo", answer: "only", confidence: 0.8 },
  ];
  const result = engine.majority(votes);
  assertEq(result.answer, "only", "단일 vote winner는 그 값이어야 함");
  assertEq(result.agreement, 1.0, "단일 vote agreement는 1.0이어야 함");
});

test("17. 단일 vote → dissent 비어있음", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "solo", answer: "only", confidence: 0.8 },
  ];
  const result = engine.majority(votes);
  assertEq(result.dissent.length, 0, "단일 vote dissent는 비어야 함");
});

// ─── 7. globalConsensus 싱글톤 ───────────────────────────────────────────

test("18. globalConsensus 싱글톤 존재", () => {
  assertDefined(globalConsensus, "globalConsensus 없음");
  assert(globalConsensus instanceof ConsensusEngine, "ConsensusEngine 인스턴스여야 함");
});

// ─── 8. 내장 함수 테스트 ─────────────────────────────────────────────────

function flEval(code: string): any {
  const interp = new Interpreter();
  const state = interp.run(code);
  return (state as any).lastValue;
}

test("19. consensus-majority 내장함수", () => {
  const code = `(consensus-majority [["a1" "yes" 0.9] ["a2" "yes" 0.8] ["a3" "no" 0.7]])`;
  const result = flEval(code);
  assertEq(result, "yes", "내장함수 majority는 yes여야 함");
});

test("20. consensus-weighted 내장함수", () => {
  const code = `(consensus-weighted [["a1" 10 0.5] ["a2" 20 0.5]])`;
  const result = flEval(code);
  assertClose(Number(result), 15, 0.001, "내장함수 weighted는 15여야 함");
});

test("21. consensus-threshold 내장함수 — 통과", () => {
  const code = `(consensus-threshold [["a1" "ok" 0.85] ["a2" "ok" 0.9]] 0.8)`;
  const result = flEval(code);
  assertEq(result, "ok", "내장함수 threshold 통과 시 ok여야 함");
});

test("22. consensus-threshold 내장함수 — 미달", () => {
  const code = `(consensus-threshold [["a1" "fail" 0.3] ["a2" "fail" 0.4]] 0.8)`;
  const result = flEval(code);
  assertNull(result, "내장함수 threshold 미달 시 null이어야 함");
});

test("23. consensus-agreement 내장함수", () => {
  const code = `(consensus-agreement [["a1" "yes" 0.9] ["a2" "yes" 0.8] ["a3" "no" 0.7]])`;
  const result = flEval(code);
  assertInRange(Number(result), 0, 1, "agreement는 0~1 범위여야 함");
});

// ─── 9. agreement 범위 ────────────────────────────────────────────────────

test("24. agreement 0~1 범위 확인", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "X", confidence: 0.9 },
    { agentId: "a2", answer: "Y", confidence: 0.6 },
    { agentId: "a3", answer: "X", confidence: 0.8 },
  ];
  const r = engine.majority(votes);
  assertInRange(r.agreement, 0, 1, "agreement는 0~1이어야 함");
});

// ─── 10. 3개 에이전트 2:1 ────────────────────────────────────────────────

test("25. 3개 에이전트 2:1 다수결", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "a1", answer: 42, confidence: 0.8 },
    { agentId: "a2", answer: 42, confidence: 0.9 },
    { agentId: "a3", answer: 99, confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertEq(result.answer, 42, "2:1 다수결 winner는 42여야 함");
  assertEq(result.dissent.length, 1, "소수 의견 1개");
});

// ─── 11. confidence 가중 ─────────────────────────────────────────────────

test("26. confidence 높은 쪽이 가중 평균 당김", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "expert",  answer: 90, confidence: 0.9 },
    { agentId: "novice",  answer: 10, confidence: 0.1 },
  ];
  const result = engine.weighted(votes);
  assert(result.answer > 50, `answer(${result.answer})는 50 초과여야 함`);
});

// ─── 12. JSON.stringify 동등성 ────────────────────────────────────────────

test("27. JSON.stringify 동등성 비교 — 객체 answer", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<object>[] = [
    { agentId: "a1", answer: { val: 1 }, confidence: 0.8 },
    { agentId: "a2", answer: { val: 1 }, confidence: 0.7 },
    { agentId: "a3", answer: { val: 2 }, confidence: 0.6 },
  ];
  const result = engine.majority(votes);
  assertEq(JSON.stringify(result.answer), JSON.stringify({ val: 1 }), "객체 동등성 기반 다수결");
});

// ─── 13. 통합: 5개 에이전트 ──────────────────────────────────────────────

test("28. 통합: 5개 에이전트 합의", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "deploy", confidence: 0.85 },
    { agentId: "a2", answer: "deploy", confidence: 0.90 },
    { agentId: "a3", answer: "deploy", confidence: 0.75 },
    { agentId: "a4", answer: "wait",   confidence: 0.60 },
    { agentId: "a5", answer: "wait",   confidence: 0.55 },
  ];
  const result = engine.majority(votes);
  assertEq(result.answer, "deploy", "5개 중 3개 deploy가 winner");
  assertEq(result.dissent.length, 2, "소수 의견 2개");
});

// ─── 14. strategy 필드 ────────────────────────────────────────────────────

test("29. majority strategy 필드 확인", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.8 },
  ];
  const result = engine.majority(votes);
  assertEq(result.strategy, "majority", "strategy는 majority여야 함");
});

test("30. weighted strategy 필드 확인", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<number>[] = [
    { agentId: "a1", answer: 5, confidence: 0.8 },
  ];
  const result = engine.weighted(votes);
  assertEq(result.strategy, "weighted", "strategy는 weighted여야 함");
});

test("31. unanimous strategy 필드 확인", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
  ];
  const result = engine.unanimous(votes);
  assertEq(result!.strategy, "unanimous", "strategy는 unanimous여야 함");
});

test("32. threshold strategy 필드 확인", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "ok", confidence: 0.85 },
    { agentId: "a2", answer: "ok", confidence: 0.9 },
  ];
  const result = engine.threshold(votes, 0.8);
  assertEq(result!.strategy, "threshold", "strategy는 threshold여야 함");
});

// ─── 15. votes 전체 포함 확인 ────────────────────────────────────────────

test("33. majority result.votes에 모든 vote 포함", () => {
  const engine = new ConsensusEngine();
  const votes: AgentVote<string>[] = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "no",  confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertEq(result.votes.length, 2, "votes 배열 2개여야 함");
});

// ─── 결과 출력 ────────────────────────────────────────────────────────────

results.forEach(r => console.log(r));
console.log(`\n총 결과: ${passed} PASS, ${failed} FAIL`);
if (passed >= 25) {
  console.log(`\n✅ Phase 121 완료 — ${passed}/${passed + failed} PASS`);
} else {
  console.log(`\n❌ Phase 121 미완료 — ${passed}/${passed + failed} PASS (25 이상 필요)`);
  process.exit(1);
}
