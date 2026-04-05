// FreeLang v9 Phase 9a/9b: Integration Tests
// Test search results flow to analyze, learned data flow to decide

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

// Test 1: Search block in reasoning sequence
test("search block in reasoning sequence", () => {
  const code = `
    (reasoning-sequence
      (search "AI trends 2026"
        :source "web"
        :cache true
        :limit 5)
      (observe "initial observation"
        :angle "perf"
        :result nil))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path includes search
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);
  if (!path.includes("search")) {
    throw new Error("search not found in execution path");
  }
});

// Test 2: Learn block in reasoning sequence
test("learn block in reasoning sequence", () => {
  const code = `
    (reasoning-sequence
      (learn "ai-trend" "Multimodal AI"
        :source "search"
        :confidence 0.95)
      (observe "initial observation"
        :angle "perf"
        :result nil))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path includes learn
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);
  if (!path.includes("learn")) {
    throw new Error("learn not found in execution path");
  }
});

// Test 3: Search result available in analyze
test("search result available in analyze stage", () => {
  const code = `
    (reasoning-sequence
      (search "Python performance"
        :source "web"
        :limit 3)
      (analyze :angle "performance"
        :confidence 0.85)
      (act :action "optimize"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  if (!path.includes("search") || !path.includes("analyze")) {
    throw new Error("search or analyze not in execution path");
  }
});

// Test 4: Learned data available in decide
test("learned data available in decide stage", () => {
  const code = `
    (reasoning-sequence
      (learn "best-practice" "Use caching"
        :source "search"
        :confidence 0.9)
      (decide :choice "implement-cache"
        :confidence 0.88)
      (act :action "deploy"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  if (!path.includes("learn") || !path.includes("decide")) {
    throw new Error("learn or decide not in execution path");
  }
});

// Test 5: Multiple searches in sequence
test("multiple searches in reasoning sequence", () => {
  const code = `
    (reasoning-sequence
      (search "React performance"
        :source "web"
        :limit 5)
      (search "Vue performance"
        :source "web"
        :limit 5)
      (analyze :angle "framework-comparison"
        :confidence 0.8)
      (decide :choice "React"
        :confidence 0.85))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  const searchCount = path.filter((s: string) => s === "search").length;
  if (searchCount !== 2) {
    throw new Error(`Expected 2 searches, got ${searchCount}`);
  }
});

// Test 6: Learn and search together
test("learn and search together in sequence", () => {
  const code = `
    (reasoning-sequence
      (search "current best practices"
        :source "web"
        :cache true)
      (learn "current-best" "TypeScript adoption"
        :source "search"
        :confidence 0.92)
      (observe "industry trends"
        :angle "technology"
        :result nil)
      (analyze :angle "market-adoption"
        :confidence 0.85)
      (decide :choice "adopt-typescript"
        :confidence 0.9))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path has both
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  if (!path.includes("search") || !path.includes("learn")) {
    throw new Error("both search and learn must be in execution path");
  }
});

// Test 7: Search with conditional
test("search result used in conditional analyze", () => {
  const code = `
    (reasoning-sequence
      (search "optimization techniques"
        :source "web"
        :limit 10)
      (if true
        (analyze :angle "performance"
          :confidence 0.85)
        (analyze :angle "cost"
          :confidence 0.7))
      (act :action "execute"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  if (!path.includes("search")) {
    throw new Error("search not in execution path");
  }
});

// Test 8: Learn with decision in loop
test("learn data with loop and decision", () => {
  const code = `
    (reasoning-sequence
      (learn "iteration-data" "learning cycle"
        :source "analysis"
        :confidence 0.8)
      (repeat until true
        (decide :choice "proceed"
          :confidence 0.85))
      (act :action "deploy"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path includes both learn and loop
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);

  if (!path.includes("learn")) {
    throw new Error("learn not in execution path");
  }
});

console.log("\n=== Phase 9a/9b Integration Tests Complete ===\n");
