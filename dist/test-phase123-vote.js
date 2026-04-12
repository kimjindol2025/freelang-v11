"use strict";
// test-phase123-vote.ts — FreeLang v9 Phase 123: VOTE 에이전트 투표 결정
// 최소 25개 PASS 목표
Object.defineProperty(exports, "__esModule", { value: true });
const vote_1 = require("./vote");
const interpreter_1 = require("./interpreter");
let passed = 0;
let failed = 0;
const results = [];
function test(name, fn) {
    try {
        fn();
        passed++;
        results.push(`  ✅ PASS: ${name}`);
    }
    catch (e) {
        failed++;
        results.push(`  ❌ FAIL: ${name} — ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEq(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertDefined(v, msg) {
    if (v === undefined || v === null)
        throw new Error(msg ?? `Expected defined value, got ${v}`);
}
console.log("\n=== Phase 123: VOTE — 에이전트 투표 결정 ===\n");
// ─── 1. VotingSystem 생성 ─────────────────────────────────────────────────
test("1. VotingSystem 생성", () => {
    const vs = new vote_1.VotingSystem();
    assertDefined(vs, "VotingSystem 인스턴스 없음");
});
// ─── 2. plurality() ─────────────────────────────────────────────────────────
const candidates3 = ["A", "B", "C"];
const ballots3 = [
    { voterId: "v1", choices: ["A"] },
    { voterId: "v2", choices: ["A"] },
    { voterId: "v3", choices: ["B"] },
];
test("2. plurality() 다수 winner", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(result.winner, "A", "A가 2표로 winner여야 함");
});
test("3. plurality() tally 확인", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(result.tally["A"], 2, "A 득표 2");
    assertEq(result.tally["B"], 1, "B 득표 1");
    assertEq(result.tally["C"], 0, "C 득표 0");
});
test("4. plurality() totalVoters", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(result.totalVoters, 3, "totalVoters는 3이어야 함");
});
test("5. plurality() margin", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(result.margin, 1, "A(2)와 B(1) 차이 1");
});
// ─── 3. approval() ──────────────────────────────────────────────────────────
const approvalBallots = [
    { voterId: "v1", choices: ["A", "B"] },
    { voterId: "v2", choices: ["A", "C"] },
    { voterId: "v3", choices: ["B", "C"] },
];
test("6. approval() 승인 집계", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.approval(approvalBallots, candidates3);
    assertEq(result.method, "approval", "method는 approval");
});
test("7. approval() 복수 승인 — A가 2표", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.approval(approvalBallots, candidates3);
    assertEq(result.tally["A"], 2, "A는 2번 승인");
    assertEq(result.tally["B"], 2, "B는 2번 승인");
    assertEq(result.tally["C"], 2, "C는 2번 승인");
});
// ─── 4. score() ─────────────────────────────────────────────────────────────
const scoreBallots = [
    { voterId: "v1", choices: [], scores: { A: 9, B: 5, C: 3 } },
    { voterId: "v2", choices: [], scores: { A: 7, B: 8, C: 2 } },
    { voterId: "v3", choices: [], scores: { A: 6, B: 4, C: 10 } },
];
test("8. score() 점수 합산", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.score(scoreBallots, candidates3);
    assertEq(result.tally["A"], 22, "A 점수 합: 9+7+6=22");
    assertEq(result.tally["B"], 17, "B 점수 합: 5+8+4=17");
    assertEq(result.tally["C"], 15, "C 점수 합: 3+2+10=15");
});
test("9. score() winner", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.score(scoreBallots, candidates3);
    assertEq(result.winner, "A", "A가 점수 최고로 winner");
});
// ─── 5. 엣지 케이스 ──────────────────────────────────────────────────────────
test("10. 동점 처리 (첫 번째 후보)", () => {
    const vs = new vote_1.VotingSystem();
    const tieBallots = [
        { voterId: "v1", choices: ["A"] },
        { voterId: "v2", choices: ["B"] },
    ];
    // 정렬 기준으로 동점 시 첫 번째가 winner (sort stable behavior)
    const result = vs.plurality(tieBallots, ["A", "B"]);
    assert(["A", "B"].includes(result.winner), "동점 시 후보 중 하나여야 함");
    assertEq(result.margin, 0, "동점 시 margin은 0");
});
test("11. 단일 후보", () => {
    const vs = new vote_1.VotingSystem();
    const ballots = [{ voterId: "v1", choices: ["X"] }];
    const result = vs.plurality(ballots, ["X"]);
    assertEq(result.winner, "X", "단일 후보는 항상 winner");
});
test("12. 단일 투표자", () => {
    const vs = new vote_1.VotingSystem();
    const ballots = [{ voterId: "solo", choices: ["B"] }];
    const result = vs.plurality(ballots, candidates3);
    assertEq(result.winner, "B", "단일 투표자 선택이 winner");
    assertEq(result.totalVoters, 1, "totalVoters는 1");
});
test("13. 빈 투표 (빈 ballots)", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality([], candidates3);
    assertEq(result.totalVoters, 0, "빈 투표 totalVoters는 0");
    assertEq(result.tally["A"], 0, "빈 투표 tally는 0");
});
// ─── 6. globalVoting 싱글톤 ─────────────────────────────────────────────────
test("14. globalVoting 싱글톤", () => {
    assertDefined(vote_1.globalVoting, "globalVoting 없음");
    assert(vote_1.globalVoting instanceof vote_1.VotingSystem, "globalVoting은 VotingSystem 인스턴스여야 함");
});
// ─── 7. 내장 함수 테스트 (Interpreter) ──────────────────────────────────────
const interp = new interpreter_1.Interpreter();
function run(code) {
    const ctx = interp.run(code);
    return ctx?.lastValue;
}
test("15. vote-plurality 내장함수", () => {
    const result = run(`
    (vote-plurality
      (list (list "v1" (list "A")) (list "v2" (list "A")) (list "v3" (list "B")))
      (list "A" "B" "C")
    )
  `);
    assertEq(result, "A", "vote-plurality winner는 A");
});
test("16. vote-approval 내장함수", () => {
    const result = run(`
    (vote-approval
      (list (list "v1" (list "A" "B")) (list "v2" (list "A" "C")))
      (list "A" "B" "C")
    )
  `);
    assertEq(result, "A", "vote-approval winner는 A (2표)");
});
test("17. vote-score 내장함수", () => {
    // 빈 투표 케이스 - 모두 0점
    const result = run(`
    (vote-score
      (list)
      (list "A" "B")
    )
  `);
    // 빈 투표 - 첫 번째가 winner (모두 0점)
    assert(["A", "B"].includes(result), "vote-score는 후보 중 하나 반환");
});
test("18. vote-tally 내장함수", () => {
    const result = run(`
    (vote-tally
      (list (list "v1" (list "A")) (list "v2" (list "A")) (list "v3" (list "B")))
      (list "A" "B" "C")
    )
  `);
    assert(result instanceof Map, "vote-tally는 Map 반환");
    assertEq(result.get("A"), 2, "A 득표 2");
    assertEq(result.get("B"), 1, "B 득표 1");
});
// ─── 8. VoteResult 필드 검증 ────────────────────────────────────────────────
test("19. method 필드 확인 (plurality)", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(result.method, "plurality", "method는 'plurality'여야 함");
});
test("20. winner가 candidates 중 하나", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assert(candidates3.includes(result.winner), `winner(${result.winner})는 candidates 중 하나여야 함`);
});
test("21. tally 모든 candidates 포함", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    for (const c of candidates3) {
        assert(result.tally.hasOwnProperty(c), `tally에 ${c}가 포함되어야 함`);
    }
});
test("22. margin >= 0", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assert(result.margin >= 0, "margin은 항상 0 이상이어야 함");
});
// ─── 9. 다양한 시나리오 ──────────────────────────────────────────────────────
test("23. 3명 투표 2:1 결과", () => {
    const vs = new vote_1.VotingSystem();
    const ballots = [
        { voterId: "a1", choices: ["option1"] },
        { voterId: "a2", choices: ["option1"] },
        { voterId: "a3", choices: ["option2"] },
    ];
    const result = vs.plurality(ballots, ["option1", "option2"]);
    assertEq(result.winner, "option1", "2:1에서 option1 승리");
    assertEq(result.margin, 1, "margin은 1");
});
test("24. approval 2개 승인 처리", () => {
    const vs = new vote_1.VotingSystem();
    const ballots = [
        { voterId: "a1", choices: ["X", "Y"] },
        { voterId: "a2", choices: ["Y", "Z"] },
        { voterId: "a3", choices: ["Y"] },
    ];
    const result = vs.approval(ballots, ["X", "Y", "Z"]);
    assertEq(result.winner, "Y", "Y가 3번 승인으로 winner");
    assertEq(result.tally["Y"], 3, "Y 승인 3번");
});
test("25. 통합: 5명 투표 → winner", () => {
    const vs = new vote_1.VotingSystem();
    const agents = ["claude", "gpt", "gemini", "llama", "mistral"];
    const picks = ["plan-A", "plan-B", "plan-A", "plan-C", "plan-A"];
    const ballots = agents.map((a, i) => ({
        voterId: a,
        choices: [picks[i]],
    }));
    const result = vs.plurality(ballots, ["plan-A", "plan-B", "plan-C"]);
    assertEq(result.winner, "plan-A", "plan-A가 3표로 winner");
    assertEq(result.totalVoters, 5, "totalVoters는 5");
    assertEq(result.tally["plan-A"], 3, "plan-A 득표 3");
    assertEq(result.margin, 2, "plan-A(3) - plan-B(1) = 2");
});
// ─── 추가 테스트 ──────────────────────────────────────────────────────────────
test("26. score method 필드", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.score(scoreBallots, candidates3);
    assertEq(result.method, "score", "method는 'score'여야 함");
});
test("27. approval method 필드", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.approval(approvalBallots, candidates3);
    assertEq(result.method, "approval", "method는 'approval'여야 함");
});
test("28. tally() 직접 호출", () => {
    const vs = new vote_1.VotingSystem();
    const t = vs.tally(ballots3, candidates3);
    assertEq(t["A"], 2, "tally A=2");
    assertEq(t["B"], 1, "tally B=1");
    assertEq(t["C"], 0, "tally C=0");
});
test("29. score 빈 scores 처리", () => {
    const vs = new vote_1.VotingSystem();
    const ballots = [
        { voterId: "v1", choices: [] }, // scores 없음
    ];
    const result = vs.score(ballots, ["A", "B"]);
    assertEq(result.tally["A"], 0, "scores 없으면 0");
    assertEq(result.tally["B"], 0, "scores 없으면 0");
});
test("30. plurality winner는 string 타입", () => {
    const vs = new vote_1.VotingSystem();
    const result = vs.plurality(ballots3, candidates3);
    assertEq(typeof result.winner, "string", "winner는 string이어야 함");
});
// ─── 결과 출력 ────────────────────────────────────────────────────────────────
console.log(results.join("\n"));
console.log(`\n${"=".repeat(50)}`);
console.log(`총 결과: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) {
    console.log("\n실패한 테스트들:");
    results.filter(r => r.includes("FAIL")).forEach(r => console.log(r));
    process.exit(1);
}
else {
    console.log("\n✅ 모든 테스트 PASS!");
    process.exit(0);
}
//# sourceMappingURL=test-phase123-vote.js.map