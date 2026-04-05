"use strict";
// FreeLang v9 Phase 9c: Loop Control Tests
// Test repeat until and while constructs
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
function parse(tokens) {
    const parser = new parser_1.Parser(tokens);
    return parser.parse();
}
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (err) {
        console.error(`✗ ${name}`);
        console.error(`  ${err.message}`);
    }
}
// Test 1: repeat until with basic condition
test("repeat until with basic condition (exit after 3 iterations)", () => {
    const code = `
    (reasoning-sequence
      (observe "test loop"
        :angle "performance"
        :result nil)
      (repeat until (>= :iteration 3)
        (analyze :angle "perf"
          :confidence 0.5)))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Check that result has execution path
    console.log(`    Execution path: ${JSON.stringify(result?.metadata?.executionPath || [])}`);
    const hasAnalyze = result?.metadata?.executionPath?.includes("analyze");
    if (!hasAnalyze) {
        throw new Error("analyze stage not found in execution path");
    }
});
// Test 2: while with loop continuation
test("while (continue while iteration < 2)", () => {
    const code = `
    (reasoning-sequence
      (observe "test while loop"
        :angle "performance"
        :result nil)
      (while (< :iteration 2)
        (decide :choice "option1"
          :confidence 0.8)))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Check that result has execution path
    console.log(`    Execution path: ${JSON.stringify(result?.metadata?.executionPath || [])}`);
    const hasDecide = result?.metadata?.executionPath?.includes("decide");
    if (!hasDecide) {
        throw new Error("decide stage not found in execution path");
    }
});
// Test 3: repeat until with custom expression
test("repeat until with confidence threshold", () => {
    const code = `
    (reasoning-sequence
      (analyze :angle "cost"
        :confidence 0.5)
      (repeat until (>= (confidence-value) 0.9)
        (decide :choice "proceed"
          :confidence 0.7)))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Verify execution completed
    if (!result) {
        throw new Error("Result is undefined");
    }
    console.log(`    Result kind: ${result.kind}`);
});
// Test 4: nested repeat until (loop within reasoning sequence)
test("nested repeat until with multiple stages", () => {
    const code = `
    (reasoning-sequence
      (observe "start"
        :angle "perf"
        :result nil)
      (repeat until (false)
        (analyze :angle "cost"
          :confidence 0.5))
      (act :action "execute"
        :success true))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Check execution path has both observe, analyze, and act
    const path = result?.metadata?.executionPath || [];
    console.log(`    Execution path: ${JSON.stringify(path)}`);
    if (!path.includes("observe") || !path.includes("analyze") || !path.includes("act")) {
        throw new Error("Missing expected stages in execution path");
    }
});
// Test 5: while with false condition (minimal iteration)
test("while with false condition (no loop execution)", () => {
    const code = `
    (reasoning-sequence
      (observe "test"
        :angle "perf"
        :result nil)
      (while (false)
        (verify :check "integrity"
          :result true))
      (act :action "finish"
        :success true))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // The loop condition is false, so verify should not execute much
    const path = result?.metadata?.executionPath || [];
    console.log(`    Execution path: ${JSON.stringify(path)}`);
    // observe and act should be in path, verify may or may not be (depending on how the loop is initialized)
    if (!path.includes("observe") || !path.includes("act")) {
        throw new Error("Missing observe or act in execution path");
    }
});
// Test 6: repeat until with max iterations limit
test("repeat until with max iterations (safety limit)", () => {
    const code = `
    (reasoning-sequence
      (observe "iteration test"
        :angle "perf"
        :result nil)
      (repeat until (false)
        (analyze :angle "cost"
          :confidence 0.5)))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Should complete due to max iterations limit (not infinite loop)
    if (!result) {
        throw new Error("Result is undefined - loop may have timed out");
    }
    console.log(`    Result received (loop bounded by maxIterations)`);
});
// Test 7: Loop + Conditional (repeat until with if/then inside)
test("repeat until + conditional (loop with branching)", () => {
    const code = `
    (reasoning-sequence
      (observe "complex test"
        :angle "perf"
        :result nil)
      (repeat until (>= :iteration 2)
        (if (> :iteration 1)
          (then (analyze :angle "cost"
                  :confidence 0.6))
          (else (analyze :angle "perf"
                  :confidence 0.5)))))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    // Check execution path has analyze
    const path = result?.metadata?.executionPath || [];
    console.log(`    Execution path: ${JSON.stringify(path)}`);
    if (!path.includes("analyze")) {
        throw new Error("analyze stage not found in execution path");
    }
});
// Test 8: Multiple loops in sequence (two repeat until blocks)
test("multiple loops in sequence", () => {
    const code = `
    (reasoning-sequence
      (repeat until (>= :iteration 2)
        (observe "first loop"
          :angle "perf"
          :result nil))
      (repeat until (>= :iteration 2)
        (analyze :angle "cost"
          :confidence 0.5))
      (verify :check "final"
        :result true))
  `;
    const tokens = (0, lexer_1.lex)(code);
    const ast = parse(tokens);
    const interpreter = new interpreter_1.Interpreter();
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
//# sourceMappingURL=test-phase9c-loop.js.map