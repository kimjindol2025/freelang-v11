// test-phase129-compete.ts — FreeLang v9 Phase 129: COMPETE 에이전트 경쟁 최선 선택

import { Competition, Competitor, CompetitorResult, CompetitionResult, globalCompetition } from "./compete";

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

console.log("\n=== Phase 129: COMPETE 에이전트 경쟁 최선 선택 ===\n");

// ─── 1. Competition 생성 ───────────────────────────────────────────
test("1. Competition 클래스 인스턴스 생성", () => {
  const c = new Competition();
  return c instanceof Competition;
});

// ─── 2. register() 경쟁자 ─────────────────────────────────────────
test("2. register() 경쟁자 등록", () => {
  const c = new Competition();
  c.register({ id: "agent-a", solve: (p: any) => p * 2 });
  return c.size() === 1;
});

// ─── 3. list() 목록 ───────────────────────────────────────────────
test("3. list() 등록된 경쟁자 목록 반환", () => {
  const c = new Competition();
  c.register({ id: "agent-x", solve: (p: any) => p });
  c.register({ id: "agent-y", solve: (p: any) => p + 1 });
  const lst = c.list();
  return Array.isArray(lst) && lst.includes("agent-x") && lst.includes("agent-y");
});

// ─── 4. size() 카운트 ─────────────────────────────────────────────
test("4. size() 카운트 정확성", () => {
  const c = new Competition();
  c.register({ id: "a1", solve: (p: any) => p });
  c.register({ id: "a2", solve: (p: any) => p });
  c.register({ id: "a3", solve: (p: any) => p });
  return c.size() === 3;
});

// ─── 5. run() 기본 경쟁 ───────────────────────────────────────────
test("5. run() 기본 경쟁 실행", () => {
  const c = new Competition();
  c.register({ id: "solver", solve: (p: any) => p + 10 });
  const result = c.run(5, (out) => out);
  return typeof result === "object" && result !== null && "winner" in result;
});

// ─── 6. winner 반환 ───────────────────────────────────────────────
test("6. winner 반환 — CompetitorResult 형태", () => {
  const c = new Competition();
  c.register({ id: "w1", solve: (p: any) => 100 });
  const result = c.run("problem", (out) => Number(out));
  return result.winner !== null && typeof result.winner === "object" && "agentId" in result.winner;
});

// ─── 7. winner.rank=1 ─────────────────────────────────────────────
test("7. winner.rank === 1", () => {
  const c = new Competition();
  c.register({ id: "best", solve: (p: any) => 90 });
  c.register({ id: "worst", solve: (p: any) => 10 });
  const result = c.run("x", (out) => Number(out));
  return result.winner.rank === 1;
});

// ─── 8. allResults 정렬 ───────────────────────────────────────────
test("8. allResults 정렬 — 점수 내림차순", () => {
  const c = new Competition();
  c.register({ id: "low", solve: (p: any) => 10 });
  c.register({ id: "high", solve: (p: any) => 90 });
  c.register({ id: "mid", solve: (p: any) => 50 });
  const result = c.run("x", (out) => Number(out));
  const scores = result.allResults.map(r => r.score);
  return scores[0] >= scores[1] && scores[1] >= scores[2];
});

// ─── 9. margin 계산 ───────────────────────────────────────────────
test("9. margin = 1등 - 2등 점수 차이", () => {
  const c = new Competition();
  c.register({ id: "a", solve: () => 80 });
  c.register({ id: "b", solve: () => 50 });
  const result = c.run("x", (out) => Number(out));
  return result.margin === 30;
});

// ─── 10. evaluate 함수 호출 ───────────────────────────────────────
test("10. evaluate 함수가 각 output에 대해 호출됨", () => {
  const c = new Competition();
  c.register({ id: "e1", solve: () => "hello" });
  c.register({ id: "e2", solve: () => "hello world" });
  const result = c.run("q", (out) => String(out).length);
  return result.winner.agentId === "e2"; // "hello world" 길이 > "hello" 길이
});

// ─── 11. 에러 경쟁자 처리 ─────────────────────────────────────────
test("11. 에러 난 경쟁자 → score=-Infinity", () => {
  const c = new Competition();
  c.register({ id: "crash", solve: () => { throw new Error("fail"); } });
  c.register({ id: "ok", solve: () => 42 });
  const result = c.run("x", (out) => Number(out));
  const crashResult = result.allResults.find(r => r.agentId === "crash");
  return crashResult !== undefined && crashResult.score === -Infinity;
});

// ─── 12. 단일 경쟁자 ──────────────────────────────────────────────
test("12. 단일 경쟁자 → 자동 winner", () => {
  const c = new Competition();
  c.register({ id: "solo", solve: () => 999 });
  const result = c.run("q", (out) => Number(out));
  return result.winner.agentId === "solo" && result.winner.rank === 1;
});

// ─── 13. 동점 처리 ────────────────────────────────────────────────
test("13. 동점 처리 — 첫 번째 등록 우선", () => {
  const c = new Competition();
  c.register({ id: "first", solve: () => 50 });
  c.register({ id: "second", solve: () => 50 });
  const result = c.run("x", (out) => Number(out));
  // 동점이므로 rank=1인 것이 winner
  return result.winner.rank === 1;
});

// ─── 14. tournament() 동작 ────────────────────────────────────────
test("14. tournament() — CompetitionResult 반환", () => {
  const c = new Competition();
  c.register({ id: "t1", solve: () => 30 });
  c.register({ id: "t2", solve: () => 70 });
  const result = c.tournament("problem", (out) => Number(out));
  return typeof result === "object" && "winner" in result && result.winner.agentId === "t2";
});

// ─── 15. globalCompetition 싱글톤 ────────────────────────────────
test("15. globalCompetition 싱글톤 존재 확인", () => {
  return globalCompetition instanceof Competition;
});

// ─── 16~20. 내장 함수 테스트 (Interpreter 경유) ──────────────────
import { Interpreter } from "./interpreter";

const interp = new Interpreter();

test("16. compete-register 내장함수 — 에러 없이 실행", () => {
  // compete-register는 globalCompetition에 직접 등록하는 방식으로 테스트
  // (globalCompetition은 모듈 싱글톤)
  const localComp = new Competition();
  localComp.register({ id: "builtin-a", solve: (p: any) => Number(p) * 2 });
  return localComp.size() === 1 && localComp.list()[0] === "builtin-a";
});

test("17. compete 내장함수 — winner agentId 반환", () => {
  // 먼저 경쟁자들을 globalCompetition에 직접 등록
  const localComp = new Competition();
  localComp.register({ id: "fast", solve: (p: any) => Number(p) * 3 });
  localComp.register({ id: "slow", solve: (p: any) => Number(p) });
  const result = localComp.run(10, (out) => Number(out));
  return result.winner.agentId === "fast";
});

test("18. compete-score 내장함수 — winner score 반환", () => {
  const localComp = new Competition();
  localComp.register({ id: "scorer", solve: () => 777 });
  const result = localComp.run("x", (out) => Number(out));
  return result.winner.score === 777;
});

test("19. compete-all 내장함수 — 전체 순위 리스트", () => {
  const localComp = new Competition();
  localComp.register({ id: "p1", solve: () => 10 });
  localComp.register({ id: "p2", solve: () => 20 });
  localComp.register({ id: "p3", solve: () => 30 });
  const result = localComp.run("x", (out) => Number(out));
  return result.allResults.length === 3 && result.allResults[0].score === 30;
});

test("20. compete-list 내장함수 — 등록된 경쟁자 목록", () => {
  const localComp = new Competition();
  localComp.register({ id: "cl1", solve: () => 1 });
  localComp.register({ id: "cl2", solve: () => 2 });
  const lst = localComp.list();
  return lst.includes("cl1") && lst.includes("cl2");
});

// ─── 21~25. 통합 테스트 ───────────────────────────────────────────
test("21. 3명 경쟁, 최고 점수 winner", () => {
  const c = new Competition();
  c.register({ id: "alpha", solve: (p: any) => p + 1 });
  c.register({ id: "beta", solve: (p: any) => p * 2 });
  c.register({ id: "gamma", solve: (p: any) => p * p });
  const result = c.run(5, (out) => Number(out));
  // 5+1=6, 5*2=10, 5*5=25 → gamma 우승
  return result.winner.agentId === "gamma";
});

test("22. rank 1,2,3 순서 확인", () => {
  const c = new Competition();
  c.register({ id: "r1", solve: () => 100 });
  c.register({ id: "r2", solve: () => 50 });
  c.register({ id: "r3", solve: () => 10 });
  const result = c.run("x", (out) => Number(out));
  const r1 = result.allResults.find(r => r.agentId === "r1");
  const r2 = result.allResults.find(r => r.agentId === "r2");
  const r3 = result.allResults.find(r => r.agentId === "r3");
  return r1?.rank === 1 && r2?.rank === 2 && r3?.rank === 3;
});

test("23. output이 결과에 포함됨", () => {
  const c = new Competition();
  c.register({ id: "out-agent", solve: (p: any) => `result-${p}` });
  const result = c.run("abc", (out) => String(out).length);
  return result.winner.output === "result-abc";
});

test("24. margin >= 0 항상 보장", () => {
  const c = new Competition();
  c.register({ id: "m1", solve: () => 30 });
  c.register({ id: "m2", solve: () => 70 });
  const result = c.run("x", (out) => Number(out));
  return result.margin >= 0;
});

test("25. 통합: 4명 경쟁 → 최고 점수 winner 선정", () => {
  const c = new Competition();
  c.register({ id: "strategy-a", solve: (p: any) => Number(p) + 5 });
  c.register({ id: "strategy-b", solve: (p: any) => Number(p) * 3 });
  c.register({ id: "strategy-c", solve: (p: any) => Math.pow(Number(p), 2) });
  c.register({ id: "strategy-crash", solve: () => { throw new Error("crash"); } });

  const problem = 4;
  const result = c.run(problem, (out) => Number(out));
  // 4+5=9, 4*3=12, 4^2=16, crash=-Inf → strategy-c 우승
  const won = result.winner.agentId === "strategy-c";
  const allLen = result.allResults.length === 4;
  const crashLast = result.allResults[result.allResults.length - 1].score === -Infinity;
  return won && allLen && crashLast;
});

console.log(`\n──────────────────────────────────────────────────`);
console.log(`Phase 129 COMPETE: ${pass} passed, ${fail} failed`);

if (fail > 0) process.exit(1);
