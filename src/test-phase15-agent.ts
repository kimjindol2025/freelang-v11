// FreeLang v9: Phase 15 AI Agent State Machine Tests
// The culminating phase: agent_create → tools → loop → goal

import { createAgentModule } from "./stdlib-agent";
import { createCollectionModule } from "./stdlib-collection";
import { createDataModule } from "./stdlib-data";
import { createHttpModule } from "./stdlib-http";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err: any) {
    console.log(`✗ ${name}`);
    console.log(`  ${err.message}`);
  }
}

const A = createAgentModule();
const C = createCollectionModule();
const D = createDataModule();

console.log("=== Phase 15: AI Agent State Machine Tests ===\n");

// ── Agent Lifecycle ───────────────────────────────────────────

test("agent_create", () => {
  const agent = A.agent_create("claude");
  if (agent.name !== "claude") throw new Error("Wrong name");
  if (agent.steps !== 0) throw new Error("Steps should be 0");
  if (agent.status !== "running") throw new Error("Status should be running");
  if (Object.keys(agent.tools).length !== 0) throw new Error("Should have no tools");
});

test("agent_set / agent_get", () => {
  let agent = A.agent_create("test");
  agent = A.agent_set(agent, "goal", "find answer");
  agent = A.agent_set(agent, "confidence", 0.9);
  if (A.agent_get(agent, "goal") !== "find answer") throw new Error("Wrong goal");
  if (A.agent_get(agent, "confidence") !== 0.9) throw new Error("Wrong confidence");
});

test("agent_set immutable", () => {
  const original = A.agent_create("test");
  const updated = A.agent_set(original, "x", 42);
  if (A.agent_get(original, "x") !== null) throw new Error("Original mutated");
  if (A.agent_get(updated, "x") !== 42) throw new Error("Update not applied");
});

test("agent_update multi-key", () => {
  let agent = A.agent_create("test");
  agent = A.agent_update(agent, { goal: "search", phase: 15, active: true });
  if (A.agent_get(agent, "goal") !== "search") throw new Error("goal missing");
  if (A.agent_get(agent, "phase") !== 15) throw new Error("phase missing");
  if (A.agent_get(agent, "active") !== true) throw new Error("active missing");
});

test("agent_get missing returns null", () => {
  const agent = A.agent_create("test");
  if (A.agent_get(agent, "nonexistent") !== null) throw new Error("Expected null");
});

// ── Tool Registry ─────────────────────────────────────────────

test("agent_add_tool / agent_call_tool", () => {
  let agent = A.agent_create("tool-test");
  agent = A.agent_add_tool(agent, "double", (x: number) => x * 2);
  agent = A.agent_add_tool(agent, "greet", (name: string) => `hello ${name}`);

  if (A.agent_call_tool(agent, "double", 5) !== 10) throw new Error("double failed");
  if (A.agent_call_tool(agent, "greet", "ai") !== "hello ai") throw new Error("greet failed");
});

test("agent_tools lists all tools", () => {
  let agent = A.agent_create("test");
  agent = A.agent_add_tool(agent, "a", () => 1);
  agent = A.agent_add_tool(agent, "b", () => 2);
  const tools = A.agent_tools(agent);
  if (!tools.includes("a") || !tools.includes("b")) throw new Error(`Expected [a,b], got ${tools}`);
});

test("agent_call_tool unknown throws", () => {
  const agent = A.agent_create("test");
  let threw = false;
  try { A.agent_call_tool(agent, "nonexistent"); }
  catch { threw = true; }
  if (!threw) throw new Error("Expected error for unknown tool");
});

// ── History ───────────────────────────────────────────────────

test("agent_push_history / agent_history", () => {
  let agent = A.agent_create("test");
  agent = A.agent_push_history(agent, { type: "message", data: "started" });
  agent = A.agent_push_history(agent, { type: "tool_call", data: { tool: "search", args: ["ai"] } });

  const history = A.agent_history(agent);
  if (history.length !== 2) throw new Error(`Expected 2 entries, got ${history.length}`);
  if (history[0].type !== "message") throw new Error("Wrong type");
  if (typeof history[0].timestamp !== "number") throw new Error("Missing timestamp");
});

test("agent_history_last", () => {
  let agent = A.agent_create("test");
  for (let i = 0; i < 5; i++) {
    agent = A.agent_push_history(agent, { type: "message", data: `step-${i}` });
  }
  const last2 = A.agent_history_last(agent, 2);
  if (last2.length !== 2) throw new Error(`Expected 2, got ${last2.length}`);
  if (last2[1].data !== "step-4") throw new Error("Wrong last entry");
});

test("agent_history_type filter", () => {
  let agent = A.agent_create("test");
  agent = A.agent_push_history(agent, { type: "tool_call", data: "a" });
  agent = A.agent_push_history(agent, { type: "message", data: "b" });
  agent = A.agent_push_history(agent, { type: "tool_call", data: "c" });

  const calls = A.agent_history_type(agent, "tool_call");
  if (calls.length !== 2) throw new Error(`Expected 2 tool_calls, got ${calls.length}`);
});

// ── Loop Execution ────────────────────────────────────────────

test("agent_loop terminates on goal", () => {
  let agent = A.agent_create("counter");
  agent = A.agent_set(agent, "count", 0);

  const result = A.agent_loop(
    agent,
    (state) => state.count >= 5,              // goal: count reaches 5
    (a) => A.agent_set(a, "count", A.agent_get(a, "count") + 1),  // step: increment
    20                                         // max steps
  );

  if (result.status !== "done") throw new Error(`Expected done, got ${result.status}`);
  if (A.agent_get(result, "count") !== 5) throw new Error(`Expected count=5, got ${A.agent_get(result, "count")}`);
});

test("agent_loop max_steps limit", () => {
  const agent = A.agent_create("infinite");
  const result = A.agent_loop(
    agent,
    (_) => false,                             // goal never met
    (a) => a,                                  // no-op step
    5                                          // max 5 steps
  );
  if (result.status !== "max_steps") throw new Error(`Expected max_steps, got ${result.status}`);
  if (result.steps !== 5) throw new Error(`Expected 5 steps, got ${result.steps}`);
});

test("agent_loop error handling", () => {
  const agent = A.agent_create("error-test");
  const result = A.agent_loop(
    agent,
    (_) => false,
    (_) => { throw new Error("step failed"); },
    10
  );
  if (result.status !== "error") throw new Error(`Expected error, got ${result.status}`);
  if (!A.agent_get(result, "_error")) throw new Error("Error not captured in state");
});

test("agent_done reflects terminal status", () => {
  const agent = A.agent_create("test");
  const done = A.agent_loop(agent, (_) => true, (a) => a, 5);
  if (!A.agent_done(done)) throw new Error("Should be done");
  if (A.agent_done(agent)) throw new Error("Fresh agent should not be done");
});

test("agent_run_until simple", () => {
  const result = A.agent_run_until(
    0,
    (n: number) => n >= 10,
    (n: number) => n + 3,
    20
  );
  if (result !== 12) throw new Error(`Expected 12, got ${result}`); // 0→3→6→9→12
});

// ── Plan Tracking ─────────────────────────────────────────────

test("plan_create / plan_next / plan_advance", () => {
  let plan = A.plan_create(["search", "analyze", "decide", "act"]);
  if (A.plan_next(plan) !== "search") throw new Error("Expected first step");
  plan = A.plan_advance(plan, { found: 3 });
  if (A.plan_next(plan) !== "analyze") throw new Error("Expected second step");
  if (A.plan_done(plan)) throw new Error("Should not be done yet");
});

test("plan completes when all steps done", () => {
  let plan = A.plan_create(["a", "b"]);
  plan = A.plan_advance(plan, "result-a");
  plan = A.plan_advance(plan, "result-b");
  if (!A.plan_done(plan)) throw new Error("Should be done");
  if (A.plan_next(plan) !== null) throw new Error("Next should be null when done");
});

test("plan_progress", () => {
  let plan = A.plan_create(["a", "b", "c", "d"]);
  if (A.plan_progress(plan) !== 0) throw new Error("Expected 0 progress");
  plan = A.plan_advance(plan, "r");
  plan = A.plan_advance(plan, "r");
  if (A.plan_progress(plan) !== 0.5) throw new Error(`Expected 0.5, got ${A.plan_progress(plan)}`);
});

test("plan_results", () => {
  let plan = A.plan_create(["search", "analyze"]);
  plan = A.plan_advance(plan, { hits: 5 });
  plan = A.plan_advance(plan, { score: 0.9 });
  const results = A.plan_results(plan);
  if (!results["search"] || results["search"].hits !== 5) throw new Error("search result missing");
  if (!results["analyze"] || results["analyze"].score !== 0.9) throw new Error("analyze result missing");
});

// ── Observation / Context ─────────────────────────────────────

test("observe accumulates", () => {
  let ctx = A.context_create();
  ctx = A.observe("query", "what is AI", ctx);
  ctx = A.observe("results", 5, ctx);
  ctx = A.observe("confidence", 0.85, ctx);
  if (ctx["query"] !== "what is AI") throw new Error("query missing");
  if (ctx["results"] !== 5) throw new Error("results missing");
});

test("summarize", () => {
  const ctx = { goal: "search", step: 3, found: true };
  const summary = A.summarize(ctx);
  if (!summary.includes("goal: search")) throw new Error("goal missing from summary");
  if (!summary.includes("step: 3")) throw new Error("step missing from summary");
});

test("context_merge", () => {
  const a = { x: 1, y: 0 };
  const b = { y: 99, z: 3 };
  const merged = A.context_merge(a, b);
  if (merged.x !== 1 || merged.y !== 99 || merged.z !== 3)
    throw new Error(`Merge failed: ${JSON.stringify(merged)}`);
});

// ── Integration: Full AI agent workflow ──────────────────────

test("full agent: search → analyze → decide pipeline", () => {
  // Simulate an AI reasoning agent with tools
  let agent = A.agent_create("reasoning-agent");

  // Register tools
  agent = A.agent_add_tool(agent, "fetch_data", () => [
    { id: 1, score: 0.9, category: "A" },
    { id: 2, score: 0.4, category: "B" },
    { id: 3, score: 0.8, category: "A" },
    { id: 4, score: 0.2, category: "B" },
  ]);
  agent = A.agent_add_tool(agent, "filter_high", (items: any[]) =>
    items.filter((x: any) => x.score >= 0.7)
  );
  agent = A.agent_add_tool(agent, "pick_best", (items: any[]) =>
    C.arr_sort_by_desc(items, "score")[0]
  );

  // Initialize plan
  let plan = A.plan_create(["fetch", "filter", "decide"]);
  agent = A.agent_set(agent, "plan", plan);

  // Run agent loop
  const result = A.agent_loop(
    agent,
    (state) => A.plan_done(state.plan),
    (a) => {
      const currentPlan: any = A.agent_get(a, "plan");
      const step = A.plan_next(currentPlan);
      let stepResult: any;

      if (step === "fetch") {
        stepResult = A.agent_call_tool(a, "fetch_data");
        a = A.agent_set(a, "data", stepResult);
      } else if (step === "filter") {
        const data = A.agent_get(a, "data");
        stepResult = A.agent_call_tool(a, "filter_high", data);
        a = A.agent_set(a, "filtered", stepResult);
      } else if (step === "decide") {
        const filtered = A.agent_get(a, "filtered");
        stepResult = A.agent_call_tool(a, "pick_best", filtered);
        a = A.agent_set(a, "decision", stepResult);
      }

      a = A.agent_push_history(a, { type: "tool_call", data: { step, result: stepResult } });
      a = A.agent_set(a, "plan", A.plan_advance(currentPlan, stepResult));
      return a;
    },
    10
  );

  if (result.status !== "done") throw new Error(`Expected done, got ${result.status}`);
  const decision = A.agent_get(result, "decision");
  if (!decision || decision.id !== 1) throw new Error(`Expected best item (id=1), got ${JSON.stringify(decision)}`);
  if (result.steps !== 3) throw new Error(`Expected 3 steps, got ${result.steps}`);

  console.log(`    → decision: id=${decision.id} score=${decision.score} category=${decision.category}`);
  console.log(`    → steps: ${result.steps}, history: ${A.agent_history(result).length} entries`);
});

test("agent + retry: resilient tool execution", () => {
  let agent = A.agent_create("resilient");
  let attempts = 0;

  agent = A.agent_add_tool(agent, "flaky_api", () => {
    attempts++;
    if (attempts < 3) throw new Error("API unavailable");
    return { data: "success", attempt: attempts };
  });

  const result = C.retry(3, () => A.agent_call_tool(agent, "flaky_api"));
  if (result.data !== "success") throw new Error(`Expected success, got ${result.data}`);
  if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
  console.log(`    → succeeded on attempt ${attempts}`);
});

console.log("\n=== Phase 15 Tests Complete ===");
