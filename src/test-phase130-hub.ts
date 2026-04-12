// test-phase130-hub.ts — FreeLang v9 Phase 130: 멀티에이전트 협업 통합
// MultiAgentHub — Phase 121~129 모든 협업 시스템 통합 (Tier 8 완성)
// 최소 30개 PASS 목표

import {
  MultiAgentHub,
  globalHub,
  ConsensusEngine,
  globalConsensus,
  DelegationManager,
  globalDelegation,
  VotingSystem,
  globalVoting,
  Negotiator,
  globalNegotiator,
  Swarm,
  globalSwarm,
  Orchestrator,
  globalOrchestrator,
  PeerReviewSystem,
  globalPeerReview,
  AgentChain,
  globalAgentChain,
  Competition,
  globalCompetition,
} from "./multi-agent-hub";
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
  if (v === undefined || v === null) throw new Error(msg ?? `Expected defined, got ${v}`);
}

function assertInRange(v: number, lo: number, hi: number, msg?: string) {
  if (v < lo || v > hi) throw new Error(msg ?? `Expected ${v} in [${lo}, ${hi}]`);
}

console.log("\n=== Phase 130: 멀티에이전트 협업 통합 — MultiAgentHub (Tier 8 완성) ===\n");

// ─── 1. MultiAgentHub 기본 ────────────────────────────────────────────────

test("1. MultiAgentHub 생성", () => {
  const hub = new MultiAgentHub();
  assertDefined(hub, "MultiAgentHub 인스턴스 없음");
});

test("2. stats() 반환 — systems=9, ready=9", () => {
  const hub = new MultiAgentHub();
  const s = hub.stats();
  assertEq(s.systems, 9, "systems는 9여야 함");
  assertEq(s.ready, 9, "ready는 9여야 함");
});

test("3. globalHub 싱글톤 존재", () => {
  assertDefined(globalHub, "globalHub 없음");
  assert(globalHub instanceof MultiAgentHub, "globalHub는 MultiAgentHub 인스턴스여야 함");
});

test("4. systems() 배열 반환 — 9개", () => {
  const hub = new MultiAgentHub();
  const sysList = hub.systems();
  assertEq(sysList.length, 9, "시스템 9개여야 함");
});

test("5. taskTypes() 배열 반환 — 9개", () => {
  const hub = new MultiAgentHub();
  const types = hub.taskTypes();
  assertEq(types.length, 9, "태스크 타입 9개여야 함");
});

// ─── 2. Phase 121: ConsensusEngine 통합 ──────────────────────────────────

test("6. ConsensusEngine 생성 가능", () => {
  const engine = new ConsensusEngine();
  assertDefined(engine, "ConsensusEngine 없음");
});

test("7. consensus majority 동작", () => {
  const engine = new ConsensusEngine();
  const votes = [
    { agentId: "a1", answer: "yes", confidence: 0.9 },
    { agentId: "a2", answer: "yes", confidence: 0.8 },
    { agentId: "a3", answer: "no",  confidence: 0.7 },
  ];
  const result = engine.majority(votes);
  assertEq(result.answer, "yes", "majority는 yes여야 함");
});

// ─── 3. Phase 122: DelegationManager 통합 ────────────────────────────────

test("8. DelegationManager 생성", () => {
  const dm = new DelegationManager();
  assertDefined(dm, "DelegationManager 없음");
});

test("9. delegate 동작", () => {
  const dm = new DelegationManager();
  dm.register({
    id: "agent-a",
    capabilities: ["math"],
    execute: (task: any) => task.input * 2,
  });
  const result = dm.delegate({ id: "t1", description: "test", input: 21, requiredCapability: "math" });
  assertEq(result.output, 42, "delegate 결과는 42여야 함");
});

// ─── 4. Phase 123: VotingSystem 통합 ─────────────────────────────────────

test("10. VotingSystem 생성", () => {
  const vs = new VotingSystem();
  assertDefined(vs, "VotingSystem 없음");
});

test("11. vote plurality 동작", () => {
  const vs = new VotingSystem();
  const ballots = [
    { voterId: "v1", choices: ["A"] },
    { voterId: "v2", choices: ["A"] },
    { voterId: "v3", choices: ["B"] },
  ];
  const result = vs.plurality(ballots, ["A", "B"]);
  assertEq(result.winner, "A", "plurality winner는 A여야 함");
});

// ─── 5. Phase 124: Negotiator 통합 ───────────────────────────────────────

test("12. Negotiator 생성", () => {
  const n = new Negotiator();
  assertDefined(n, "Negotiator 없음");
});

test("13. negotiate 동작 — 합의 가능", () => {
  const n = new Negotiator();
  const positions = [
    { agentId: "a", offer: 0.5, minAccept: 0.4, maxOffer: 0.7, flexibility: 0.8 },
    { agentId: "b", offer: 0.6, minAccept: 0.4, maxOffer: 0.8, flexibility: 0.8 },
  ];
  const result = n.negotiate(positions);
  assertDefined(result, "negotiate 결과 있어야 함");
});

// ─── 6. Phase 125: Swarm 통합 ────────────────────────────────────────────

test("14. Swarm 생성", () => {
  const s = new Swarm();
  assertDefined(s, "Swarm 없음");
});

test("15. swarm optimize 동작", () => {
  const s = new Swarm();
  const result = s.optimize({ objective: (x: number) => -(x - 0.5) * (x - 0.5) });
  assertInRange(result.bestPosition, 0, 1, "최적 위치는 0~1 범위여야 함");
  assert(result.bestScore >= -1, "최적 점수는 합리적이어야 함");
});

// ─── 7. Phase 126: Orchestrator 통합 ─────────────────────────────────────

test("16. Orchestrator 생성", () => {
  const o = new Orchestrator();
  assertDefined(o, "Orchestrator 없음");
});

test("17. orchestrate run 동작", () => {
  const o = new Orchestrator();
  o.register({ id: "t1", run: (x: any) => x * 2 });
  const result = o.run([{ id: "t1", input: 5 }]);
  assert(result.success, "run은 성공해야 함");
  assertEq(result.outputs["t1"], 10, "t1 출력은 10이어야 함");
});

// ─── 8. Phase 127: PeerReviewSystem 통합 ─────────────────────────────────

test("18. PeerReviewSystem 생성", () => {
  const prs = new PeerReviewSystem();
  assertDefined(prs, "PeerReviewSystem 없음");
});

test("19. peer-review 동작", () => {
  const prs = new PeerReviewSystem();
  prs.addReviewer({
    id: "reviewer-1",
    review: (_out: any) => ({ reviewerId: "reviewer-1", aspect: "quality", score: 0.9, comment: "좋음" }),
  });
  const result = prs.review("output-1", { value: 42 });
  assertDefined(result, "리뷰 결과 있어야 함");
  assertInRange(result.averageScore, 0, 1, "평균 점수는 0~1이어야 함");
});

// ─── 9. Phase 128: AgentChain 통합 ───────────────────────────────────────

test("20. AgentChain 생성", () => {
  const ch = new AgentChain();
  assertDefined(ch, "AgentChain 없음");
});

test("21. chain-agents 동작", () => {
  const ch = new AgentChain();
  ch.add({ id: "double", transform: (x: number) => x * 2 });
  ch.add({ id: "addTen", transform: (x: number) => x + 10 });
  const result = ch.run(5);
  assertEq(result.finalOutput, 20, "체인: 5*2+10=20이어야 함");
  assert(result.success, "체인은 성공해야 함");
});

// ─── 10. Phase 129: Competition 통합 ─────────────────────────────────────

test("22. Competition 생성", () => {
  const comp = new Competition();
  assertDefined(comp, "Competition 없음");
});

test("23. compete 동작", () => {
  const comp = new Competition();
  comp.register({ id: "solver-a", solve: (_p: any) => 80 });
  comp.register({ id: "solver-b", solve: (_p: any) => 95 });
  const result = comp.run("problem", (x: any) => Number(x));
  assertEq(result.winner.agentId, "solver-b", "경쟁 winner는 solver-b여야 함");
  assertEq(result.winner.score, 95, "winner 점수는 95여야 함");
});

// ─── 11. hub-route 내장함수 테스트 ───────────────────────────────────────

const interp = new Interpreter();

function flEval(code: string): any {
  const state = interp.run(code);
  return (state as any).lastValue;
}

test("24. hub-route 'consensus' 내장함수", () => {
  const result = flEval(`(hub-route "consensus" "problem")`);
  assertEq(result, "problem", "consensus route passthrough는 problem이어야 함");
});

test("25. hub-route 'vote' 내장함수 — 기본", () => {
  const result = flEval(`(hub-route "vote" "no-ballot")`);
  assertEq(result, "no-ballot", "vote route passthrough는 no-ballot이어야 함");
});

test("26. hub-route 'compete' 내장함수 — 에이전트 없음", () => {
  const result = flEval(`(hub-route "compete" 42)`);
  assertEq(result, 42, "compete route passthrough는 42여야 함");
});

test("27. hub-route unknown taskType — passthrough", () => {
  const result = flEval(`(hub-route "unknown-type" "data")`);
  assertEq(result, "data", "unknown route는 problem 그대로여야 함");
});

test("28. hub-stats 내장함수", () => {
  const result = flEval(`(hub-stats)`);
  assertDefined(result, "hub-stats 결과 있어야 함");
  assert(typeof result === "object" || result instanceof Map, "hub-stats는 객체여야 함");
});

test("29. hub-systems 내장함수", () => {
  const result = flEval(`(hub-systems)`);
  assertDefined(result, "hub-systems 결과 있어야 함");
  assert(Array.isArray(result), "hub-systems는 배열이어야 함");
  assert((result as string[]).length === 9, "시스템 9개여야 함");
});

// ─── 12. 전체 시스템 임포트 및 싱글톤 확인 ──────────────────────────────

test("30. 전체 시스템 임포트 성공 — 9개 글로벌 싱글톤", () => {
  assertDefined(globalConsensus, "globalConsensus 없음");
  assertDefined(globalDelegation, "globalDelegation 없음");
  assertDefined(globalVoting, "globalVoting 없음");
  assertDefined(globalNegotiator, "globalNegotiator 없음");
  assertDefined(globalSwarm, "globalSwarm 없음");
  assertDefined(globalOrchestrator, "globalOrchestrator 없음");
  assertDefined(globalPeerReview, "globalPeerReview 없음");
  assertDefined(globalAgentChain, "globalAgentChain 없음");
  assertDefined(globalCompetition, "globalCompetition 없음");
});

test("31. 각 globalX 싱글톤 타입 확인", () => {
  assert(globalConsensus instanceof ConsensusEngine, "ConsensusEngine 타입 불일치");
  assert(globalDelegation instanceof DelegationManager, "DelegationManager 타입 불일치");
  assert(globalVoting instanceof VotingSystem, "VotingSystem 타입 불일치");
  assert(globalNegotiator instanceof Negotiator, "Negotiator 타입 불일치");
  assert(globalSwarm instanceof Swarm, "Swarm 타입 불일치");
  assert(globalOrchestrator instanceof Orchestrator, "Orchestrator 타입 불일치");
  assert(globalPeerReview instanceof PeerReviewSystem, "PeerReviewSystem 타입 불일치");
  assert(globalCompetition instanceof Competition, "Competition 타입 불일치");
});

// ─── 13. 통합: consensus + compete 순차 사용 ─────────────────────────────

test("32. 통합: consensus + compete 순차 사용", () => {
  // 1) consensus로 에이전트들이 합의한 값을 구함
  const engine = new ConsensusEngine();
  const votes = [
    { agentId: "a1", answer: 100, confidence: 0.9 },
    { agentId: "a2", answer: 100, confidence: 0.8 },
    { agentId: "a3", answer: 50,  confidence: 0.5 },
  ];
  const consensusResult = engine.majority(votes);
  assertEq(consensusResult.answer, 100, "consensus는 100이어야 함");

  // 2) competition으로 최선의 솔버 선택
  const comp = new Competition();
  comp.register({ id: "solver-1", solve: (_p: any) => consensusResult.answer + 10 });
  comp.register({ id: "solver-2", solve: (_p: any) => consensusResult.answer + 50 });
  const compResult = comp.run("consensus-problem", (x: any) => Number(x));
  assertEq(compResult.winner.output, 150, "경쟁 winner 출력은 150이어야 함");
});

test("33. hub route 'consensus' — 에이전트 없을 때 passthrough", () => {
  const hub = new MultiAgentHub();
  const r = hub.route('consensus', 'test-problem', []);
  assertDefined(r, "route 결과 없음");
  assertEq(r.system, 'ConsensusEngine', "시스템은 ConsensusEngine이어야 함");
});

test("34. hub route 'chain' — 에이전트 없을 때 passthrough", () => {
  const hub = new MultiAgentHub();
  const r = hub.route('chain', 42, []);
  assertEq(r.result, 42, "chain passthrough는 42여야 함");
});

test("35. hub route 'chain' — 에이전트 있을 때 변환", () => {
  const hub = new MultiAgentHub();
  const agents = [
    { id: "double", transform: (x: number) => x * 2 },
    { id: "inc",    transform: (x: number) => x + 1 },
  ];
  const r = hub.route('chain', 5, agents);
  assertEq(r.result, 11, "chain 5*2+1=11이어야 함");
});

test("36. hub route 'compete' — 에이전트 있을 때 최선 선택", () => {
  const hub = new MultiAgentHub();
  const agents = [
    { id: "poor",  solve: (_p: any) => 10 },
    { id: "good",  solve: (_p: any) => 99 },
  ];
  const problem = { task: "problem", evaluate: (x: any) => Number(x) };
  const r = hub.route('compete', problem, agents);
  assertEq(r.result, 99, "compete winner 출력은 99여야 함");
});

test("37. hub stats tier=8 확인", () => {
  const hub = new MultiAgentHub();
  const s = hub.stats();
  assertEq(s.tier, 8, "tier는 8이어야 함 (Tier 8 완성)");
});

test("38. hub systems에 모든 시스템 이름 포함", () => {
  const hub = new MultiAgentHub();
  const sysList = hub.systems();
  const names = ['ConsensusEngine', 'DelegationManager', 'VotingSystem', 'Negotiator',
                  'Swarm', 'Orchestrator', 'PeerReviewSystem', 'AgentChain', 'Competition'];
  names.forEach(name => {
    assert(sysList.includes(name), `${name}이 systems 목록에 없음`);
  });
});

// ─── 결과 출력 ────────────────────────────────────────────────────────────

results.forEach(r => console.log(r));
console.log(`\n총 결과: ${passed} PASS, ${failed} FAIL`);
if (passed >= 30) {
  console.log(`\n✅ Phase 130 완료 — ${passed}/${passed + failed} PASS (Tier 8 완성!)`);
} else {
  console.log(`\n❌ Phase 130 미완료 — ${passed}/${passed + failed} PASS (30 이상 필요)`);
  process.exit(1);
}
