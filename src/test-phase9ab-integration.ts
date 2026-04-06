// FreeLang v9 Phase 9a/9b Integration Tests
// Search → Analyze → Learn → Decide complete workflow

import { lex } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";

function parse(tokens: any[]) {
  const parser = new Parser(tokens);
  return parser.parse();
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err: any) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

// Test 1: Search + Analyze (Phase 9a)
test("search data flows to analyze stage", () => {
  const code = `
    (reasoning-sequence
      (search "AI trends 2026")
      (analyze :angle "overview"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const path = result?.metadata?.executionPath || [];
  if (!path.includes("search") || !path.includes("analyze")) {
    throw new Error("search/analyze not in execution path");
  }

  if (!context.currentSearches || context.currentSearches.size === 0) {
    throw new Error("Search results not captured in context");
  }

  console.log(`    Execution: ${path.join(" → ")}, searches: ${context.currentSearches.size}`);
});

// Test 2: Learn + Decide (Phase 9b)
test("learned data flows to decide stage", () => {
  const code = `
    (reasoning-sequence
      (learn "ai-insight" {:trend "multimodal"} :confidence 0.9)
      (decide :choice "implement-multimodal"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const path = result?.metadata?.executionPath || [];
  if (!path.includes("learn") || !path.includes("decide")) {
    throw new Error("learn/decide not in execution path");
  }

  if (!context.currentLearned || context.currentLearned.size === 0) {
    throw new Error("Learned data not captured in context");
  }

  console.log(`    Execution: ${path.join(" → ")}, learned: ${context.currentLearned.size}`);
});

// Test 3: Full pipeline
test("complete search→analyze→learn→decide pipeline", () => {
  const code = `
    (reasoning-sequence
      (search "2026 technology trends" :limit 3)
      (analyze :angle "technology")
      (learn "tech-insights" {:trends "from-search"} :confidence 0.85 :source "search")
      (decide :choice "plan-action"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const path = result?.metadata?.executionPath || [];
  const expected = ["search", "analyze", "learn", "decide"];

  for (const stage of expected) {
    if (!path.includes(stage)) {
      throw new Error(`${stage} not in execution path: ${path.join(" → ")}`);
    }
  }

  if (!context.currentSearches || context.currentSearches.size === 0) {
    throw new Error("Search results not available");
  }

  if (!context.currentLearned || context.currentLearned.size === 0) {
    throw new Error("Learned facts not available");
  }

  console.log(`    Full pipeline: ${path.join(" → ")}`);
});

// Test 4: Multiple searches + learns
test("multiple search and learn stages", () => {
  const code = `
    (reasoning-sequence
      (search "React performance")
      (search "Vue performance")
      (analyze :angle "framework-comparison")
      (learn "react-facts" {:library "React"} :confidence 0.9)
      (learn "vue-facts" {:library "Vue"} :confidence 0.85)
      (decide :choice "select-framework"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const path = result?.metadata?.executionPath || [];
  const searchCount = path.filter((s: string) => s === "search").length;
  const learnCount = path.filter((s: string) => s === "learn").length;

  if (searchCount !== 2 || learnCount !== 2) {
    throw new Error(`Expected 2 searches and 2 learns`);
  }

  console.log(`    Multiple stages: ${searchCount} searches, ${learnCount} learns`);
});

console.log("\n=== Phase 9a/9b Integration Tests Complete ===\n");
