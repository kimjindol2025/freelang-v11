"use strict";
// FreeLang v9: Phase 98 — AGENT: AI 에이전트 루프를 언어로
// 최소 24개 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const agent_1 = require("./agent");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 150)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEquals(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
console.log("[Phase 98] AGENT: AI 에이전트 루프를 언어로\n");
// ── TC-1~6: FLAgent 기본 ─────────────────────────────────────────────────────
console.log("[TC-1~6] FLAgent 기본");
test("TC-1: FLAgent 생성", () => {
    const agent = new agent_1.FLAgent({ goal: "테스트 목표", maxSteps: 5 });
    assert(agent instanceof agent_1.FLAgent, "FLAgent 인스턴스");
});
test("TC-2: getState 초기값 (step=0, done=false)", () => {
    const agent = new agent_1.FLAgent({ goal: "초기화 테스트", maxSteps: 8 });
    const state = agent.getState();
    assertEquals(state.step, 0, `step=${state.step}`);
    assertEquals(state.done, false, `done=${state.done}`);
    assertEquals(state.goal, "초기화 테스트", `goal=${state.goal}`);
    assertEquals(state.maxSteps, 8, `maxSteps=${state.maxSteps}`);
    assert(Array.isArray(state.history), "history는 배열");
    assertEquals(state.history.length, 0, "history 비어있음");
    assert(typeof state.memory === "object", "memory는 객체");
});
test("TC-3: step() 추가 + 실행", () => {
    const agent = new agent_1.FLAgent({ goal: "step 테스트", maxSteps: 3 });
    agent.step("숫자 반환", (_state) => 42);
    const state = agent.run();
    assert(state.history.length >= 1, `history.length=${state.history.length}`);
    assertEquals(state.history[0].observation, 42, "observation=42");
});
test("TC-4: 단계 후 step 카운트 증가", () => {
    const agent = new agent_1.FLAgent({ goal: "카운트 테스트", maxSteps: 5 });
    agent
        .step("step1", (_s) => "a")
        .step("step2", (_s) => "b")
        .step("step3", (_s) => "c");
    const state = agent.run();
    assertEquals(state.step, 3, `step=${state.step}`);
});
test("TC-5: setResult → done=true", () => {
    const agent = new agent_1.FLAgent({ goal: "결과 테스트", maxSteps: 10 });
    assertEquals(agent.isDone(), false, "초기 done=false");
    agent.setResult("최종값");
    assertEquals(agent.isDone(), true, "setResult 후 done=true");
    assertEquals(agent.getState().result, "최종값", "result 저장됨");
});
test("TC-6: AgentState 구조 확인", () => {
    const agent = new agent_1.FLAgent({ goal: "구조 확인", maxSteps: 5 });
    const state = agent.getState();
    assert("goal" in state, "goal 필드");
    assert("step" in state, "step 필드");
    assert("maxSteps" in state, "maxSteps 필드");
    assert("memory" in state, "memory 필드");
    assert("history" in state, "history 필드");
    assert("done" in state, "done 필드");
});
// ── TC-7~12: 에이전트 루프 ───────────────────────────────────────────────────
console.log("\n[TC-7~12] 에이전트 루프");
test("TC-7: run() — 1~5 합 계산 (15)", () => {
    const agent = new agent_1.FLAgent({ goal: "1~5 합 계산", maxSteps: 10 });
    const state = agent.run((s) => {
        const n = (0, agent_1.getMemory)(s, "n", 1);
        const sum = (0, agent_1.getMemory)(s, "sum", 0);
        if (n > 5) {
            (0, agent_1.agentDoneSignal)(s, sum);
            return null;
        }
        (0, agent_1.setMemory)(s, "sum", sum + n);
        (0, agent_1.setMemory)(s, "n", n + 1);
        return {
            step: s.step,
            thought: `n=${n} 더하기`,
            action: "add",
            observation: (0, agent_1.getMemory)(s, "sum", 0),
        };
    });
    assertEquals(state.result, 15, `합계=${state.result}`);
});
test("TC-8: maxSteps 초과 시 강제 종료", () => {
    const agent = new agent_1.FLAgent({ goal: "무한 루프 방지", maxSteps: 3 });
    const state = agent.run((_s) => ({
        step: _s.step,
        thought: "계속",
        action: "loop",
        observation: null,
    }));
    assert(state.step <= 3, `step=${state.step} (maxSteps=3)`);
    assertEquals(state.done, true, "maxSteps 후 done=true");
});
test("TC-9: stopWhen 조건 충족 시 종료", () => {
    const agent = new agent_1.FLAgent({
        goal: "3단계 후 종료",
        maxSteps: 100,
        stopWhen: (s) => s.step >= 3,
    });
    const state = agent.run((_s) => ({
        step: _s.step,
        thought: "진행",
        action: "step",
        observation: _s.step,
    }));
    assert(state.step <= 3, `step=${state.step} (stopWhen=3)`);
});
test("TC-10: history 배열 누적", () => {
    const agent = new agent_1.FLAgent({ goal: "history 테스트", maxSteps: 5 });
    agent
        .step("step-a", (_s) => "A")
        .step("step-b", (_s) => "B")
        .step("step-c", (_s) => "C");
    const state = agent.run();
    assertEquals(state.history.length, 3, `history.length=${state.history.length}`);
});
test("TC-11: AgentAction 구조 (step, thought, action, observation)", () => {
    const agent = new agent_1.FLAgent({ goal: "action 구조", maxSteps: 5 });
    const state = agent.run((_s) => {
        (0, agent_1.agentDoneSignal)(_s, "done");
        return {
            step: 0,
            thought: "첫 번째 생각",
            action: "test-action",
            observation: { value: 99 },
        };
    });
    assert(state.history.length >= 1 || state.done, "실행됨");
    // agentDoneSignal 후 run이 null 반환하면 history가 비어도 됨
    // 직접 액션을 history에 확인
    const agent2 = new agent_1.FLAgent({ goal: "action 구조 확인", maxSteps: 5 });
    let callCount = 0;
    const state2 = agent2.run((s) => {
        callCount++;
        if (callCount > 1)
            return null;
        return {
            step: s.step,
            thought: "첫 번째 생각",
            action: "test-action",
            observation: { value: 99 },
        };
    });
    assert(state2.history.length >= 1, "history 있음");
    const act = state2.history[0];
    assert("step" in act, "step 필드");
    assert("thought" in act, "thought 필드");
    assert("action" in act, "action 필드");
    assert("observation" in act, "observation 필드");
});
test("TC-12: memory 읽기/쓰기", () => {
    const agent = new agent_1.FLAgent({ goal: "memory 테스트", maxSteps: 5 });
    const state = agent.getState();
    assertEquals((0, agent_1.getMemory)(state, "x", 0), 0, "기본값 0");
    (0, agent_1.setMemory)(state, "x", 100);
    assertEquals((0, agent_1.getMemory)(state, "x", 0), 100, "x=100 저장됨");
    (0, agent_1.setMemory)(state, "name", "FreeLang");
    assertEquals((0, agent_1.getMemory)(state, "name", ""), "FreeLang", "name 저장됨");
});
// ── TC-13~18: FL 문법 ─────────────────────────────────────────────────────────
console.log("\n[TC-13~18] FL 문법");
test("TC-13: `[AGENT :goal :max-steps ...]` 실행", () => {
    const src = `
    [AGENT my-agent
      :goal "합 계산"
      :max-steps 5
      :step (fn [$state]
        (do
          (define $n (get-memory $state "n" 1))
          (define $sum (get-memory $state "sum" 0))
          (if (> $n 3)
            (agent-done $state $sum)
            (do
              (set-memory $state "n" (+ $n 1))
              (set-memory $state "sum" (+ $sum $n))
              (agent-continue $state)))))]
  `;
    const result = run(src);
    assert(result !== null && result !== undefined, "result 반환됨");
    // AgentState 또는 done=true
    assert(typeof result === "object", `object 반환: ${typeof result}`);
});
test("TC-14: 에이전트가 목표 달성 후 result 반환", () => {
    const agent = new agent_1.FLAgent({ goal: "목표 달성", maxSteps: 10 });
    let counter = 0;
    const state = agent.run((s) => {
        counter++;
        if (counter >= 3) {
            (0, agent_1.agentDoneSignal)(s, "목표달성!");
            return null;
        }
        return { step: s.step, thought: `진행${counter}`, action: "step", observation: counter };
    });
    assertEquals(state.result, "목표달성!", `result=${state.result}`);
    assertEquals(state.done, true, "done=true");
});
test("TC-15: `(agent-done? $agent)` → bool", () => {
    const src = `
    (define $a (agent-new :goal "테스트" :max-steps 5))
    (agent-done? $a)
  `;
    const result = run(src);
    assertEquals(result, false, `agent-done? 초기=false, got=${result}`);
});
test("TC-16: `(agent-result $agent)` → 최종값", () => {
    // TS에서 직접 테스트
    const agent = (0, agent_1.agentNew)({ goal: "결과 확인", maxSteps: 5 });
    agent.setResult(42);
    assertEquals((0, agent_1.agentResult)(agent), 42, `result=${(0, agent_1.agentResult)(agent)}`);
});
test("TC-17: `(agent-history $agent)` → 배열", () => {
    const agent = (0, agent_1.agentNew)({ goal: "history 확인", maxSteps: 5 });
    agent.step("초기화", (_s) => "init");
    (0, agent_1.agentRun)(agent);
    const hist = (0, agent_1.agentHistory)(agent);
    assert(Array.isArray(hist), "배열 반환");
    assert(hist.length >= 1, `history.length=${hist.length}`);
});
test("TC-18: onStep 콜백 실행", () => {
    const stepLog = [];
    const agent = new agent_1.FLAgent({
        goal: "콜백 테스트",
        maxSteps: 5,
        onStep: (s) => { stepLog.push(s.step); },
    });
    agent
        .step("s1", (_s) => 1)
        .step("s2", (_s) => 2)
        .step("s3", (_s) => 3);
    agent.run();
    assert(stepLog.length >= 3, `onStep 호출 횟수=${stepLog.length}`);
});
// ── TC-19~24: 에지 케이스 ────────────────────────────────────────────────────
console.log("\n[TC-19~24] 에지 케이스");
test("TC-19: maxSteps=1 → 1단계만", () => {
    const agent = new agent_1.FLAgent({ goal: "1단계", maxSteps: 1 });
    const state = agent.run((_s) => ({
        step: _s.step,
        thought: "단일 단계",
        action: "single",
        observation: "ok",
    }));
    assert(state.step <= 1, `step=${state.step}`);
});
test("TC-20: 즉시 종료 stopWhen", () => {
    const agent = new agent_1.FLAgent({
        goal: "즉시 종료",
        maxSteps: 100,
        stopWhen: (_s) => true, // 처음부터 종료
    });
    const state = agent.run((_s) => ({
        step: _s.step,
        thought: "실행 안됨",
        action: "none",
        observation: null,
    }));
    assertEquals(state.step, 0, `즉시 종료: step=${state.step}`);
});
test("TC-21: toMarkdown → '## Step' 포함", () => {
    const agent = new agent_1.FLAgent({ goal: "마크다운 테스트", maxSteps: 5 });
    agent.step("단계1", (_s) => "hello");
    agent.run();
    const md = agent.toMarkdown();
    assert(typeof md === "string", "string 반환");
    assert(md.includes("## Step"), `'## Step' 미포함: ${md.slice(0, 100)}`);
});
test("TC-22: 빈 history", () => {
    const agent = new agent_1.FLAgent({ goal: "빈 에이전트", maxSteps: 5 });
    // stepFn 없이 실행 → history 없이 종료
    const state = agent.run();
    assert(Array.isArray(state.history), "history 배열");
    assertEquals(state.history.length, 0, "빈 history");
});
test("TC-23: 중첩 에이전트 (agent 내부에서 새 agent 실행)", () => {
    const outerAgent = new agent_1.FLAgent({ goal: "외부 에이전트", maxSteps: 5 });
    let innerResult = null;
    outerAgent.step("내부 에이전트 실행", (_s) => {
        const innerAgent = new agent_1.FLAgent({ goal: "내부 에이전트", maxSteps: 3 });
        innerAgent.step("내부 계산", (_is) => 99);
        const innerState = innerAgent.run();
        innerResult = innerState.history[0]?.observation;
        return innerResult;
    });
    outerAgent.run();
    assertEquals(innerResult, 99, `innerResult=${innerResult}`);
});
test("TC-24: Phase 56 regression 14/14", () => {
    const { execSync } = require("child_process");
    const out = execSync("npx ts-node src/test-phase56-lexical-scope.ts", { cwd: "/home/kimjin/kim/Desktop/kim/01_Active_Projects/freelang-v9" }).toString();
    const m = out.match(/(\d+) passed, (\d+) failed/);
    if (!m)
        throw new Error("출력 파싱 실패: " + out.slice(-200));
    const p = parseInt(m[1]);
    const f = parseInt(m[2]);
    assert(p >= 14 && f === 0, `Phase56: ${p} passed, ${f} failed`);
});
// ── 최종 결과 ────────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────────────────────────");
console.log(`Phase 98 AGENT: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase98-agent.js.map