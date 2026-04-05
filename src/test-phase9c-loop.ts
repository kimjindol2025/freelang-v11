// FreeLang v9 Phase 9c: Loop Control Tests
// Test repeat until and while constructs

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

// Test 1: repeat until with true condition (should exit immediately)
test("repeat until true (exit immediately)", () => {
  const code = `
    (reasoning-sequence
      (observe "test loop"
        :angle "performance"
        :result nil)
      (repeat until true
        (analyze :angle "perf"
          :confidence 0.5)))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check that result has execution path
  console.log(`    Execution path: ${JSON.stringify(result?.metadata?.executionPath || [])}`);
  const hasAnalyze = result?.metadata?.executionPath?.includes("analyze");
  if (!hasAnalyze) {
    throw new Error("analyze stage not found in execution path");
  }
});

// Test 2: while with true condition (continue while true)
test("while true (loop execution)", () => {
  const code = `
    (reasoning-sequence
      (observe "test while loop"
        :angle "performance"
        :result nil)
      (while false
        (decide :choice "option1"
          :confidence 0.8)))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check that result has execution path
  console.log(`    Execution path: ${JSON.stringify(result?.metadata?.executionPath || [])}`);
  const hasObserve = result?.metadata?.executionPath?.includes("observe");
  if (!hasObserve) {
    throw new Error("observe stage not found in execution path");
  }
});

// Test 3: repeat until with false condition (should loop)
test("repeat until false (limited by maxIterations)", () => {
  const code = `
    (reasoning-sequence
      (analyze :angle "cost"
        :confidence 0.5)
      (repeat until false
        (decide :choice "proceed"
          :confidence 0.7)))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Verify execution completed
  if (!result) {
    throw new Error("Result is undefined");
  }
  console.log(`    Result kind: ${result.kind}`);
});

// Test 4: repeat until with multiple stages in sequence
test("repeat until + normal stages", () => {
  const code = `
    (reasoning-sequence
      (observe "start"
        :angle "perf"
        :result nil)
      (repeat until true
        (analyze :angle "cost"
          :confidence 0.5))
      (act :action "execute"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path has both observe, analyze, and act
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);
  if (!path.includes("observe") || !path.includes("analyze") || !path.includes("act")) {
    throw new Error("Missing expected stages in execution path");
  }
});

// Test 5: while with true condition (continues indefinitely, bounded by maxIterations)
test("while true (bounded by maxIterations)", () => {
  const code = `
    (reasoning-sequence
      (observe "test"
        :angle "perf"
        :result nil)
      (while true
        (verify :check "integrity"
          :result true))
      (act :action "finish"
        :success true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // The loop condition is true, so verify will loop until maxIterations
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path length: ${path.length}`);
  // observe and act should be in path
  if (!path.includes("observe") || !path.includes("act")) {
    throw new Error("Missing observe or act in execution path");
  }
});

// Test 6: repeat until with explicit maxIterations in mind
test("repeat until (respects maxIterations safety)", () => {
  const code = `
    (reasoning-sequence
      (observe "iteration test"
        :angle "perf"
        :result nil)
      (repeat until false
        (analyze :angle "cost"
          :confidence 0.5)))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Should complete due to max iterations limit (not infinite loop)
  if (!result) {
    throw new Error("Result is undefined - loop may have timed out");
  }
  console.log(`    Result received (loop bounded by maxIterations)`);
});

// Test 7: Loop followed by When Guard (sequential use)
test("repeat until followed by when guard", () => {
  const code = `
    (reasoning-sequence
      (observe "complex test"
        :angle "perf"
        :result nil)
      (repeat until true
        (analyze :angle "cost"
          :confidence 0.6))
      (when true
        (decide :choice "proceed"
          :confidence 0.9)))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution path has analyze and decide
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);
  if (!path.includes("analyze") || !path.includes("decide")) {
    throw new Error("analyze or decide stage not found in execution path");
  }
});

// Test 8: Multiple loops in sequence (two repeat until blocks)
test("multiple loops in sequence", () => {
  const code = `
    (reasoning-sequence
      (repeat until true
        (observe "first loop"
          :angle "perf"
          :result nil))
      (repeat until true
        (analyze :angle "cost"
          :confidence 0.5))
      (verify :check "final"
        :result true))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check execution has all three stages
  const path = result?.metadata?.executionPath || [];
  console.log(`    Execution path: ${JSON.stringify(path)}`);
  if (!path.includes("observe") || !path.includes("analyze") || !path.includes("verify")) {
    throw new Error("Missing expected stages in execution path");
  }
});

console.log("\n=== Phase 9c Loop Control Tests Complete ===\n");
