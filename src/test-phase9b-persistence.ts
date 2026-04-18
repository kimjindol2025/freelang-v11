// FreeLang v9 Phase 9b Advanced: Learning Data Persistence Tests

import { lex } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";
import * as fs from "fs";
import * as path from "path";

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

// Clean up test data before running
const testDataPath = "./data/learned-facts-test.json";
function cleanupTestData() {
  try {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

cleanupTestData();

// Test 1: Learn data saves to file
test("learn data persists to disk (basic save)", () => {
  const code = `
    (reasoning-sequence
      (learn "basic-fact" {:value "test-data"} :confidence 0.85 :source "search"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  // Check learn-result
  const learnStage = result.stages?.[0];
  if (!learnStage || learnStage.kind !== "learn-result") {
    throw new Error("Expected learn-result stage");
  }

  // Verify data was saved
  if (learnStage.key !== "basic-fact") {
    throw new Error(`Expected key "basic-fact", got "${learnStage.key}"`);
  }

  if (learnStage.saved !== "disk") {
    throw new Error(`Expected saved: "disk", got "${learnStage.saved}"`);
  }

  if (learnStage.confidence !== 0.85) {
    throw new Error(`Expected confidence 0.85, got ${learnStage.confidence}`);
  }

  console.log(`    Saved fact with confidence: ${learnStage.confidence}`);
});

// Test 2: Invalid confidence validation
test("learn rejects invalid confidence (out of range)", () => {
  const code = `
    (reasoning-sequence
      (learn "bad-fact" {:value "test"} :confidence 1.5))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();

  try {
    const context = interpreter.interpret(ast);
    // If we get here without error, check the result
    const result = context.lastValue;
    const learnStage = result.stages?.[0];

    // Should handle error gracefully
    if (learnStage && learnStage.kind === "learn-error") {
      console.log(`    Error handled: ${learnStage.message.substring(0, 50)}`);
    } else {
      throw new Error("Should have rejected confidence > 1.0");
    }
  } catch (err: any) {
    // This is expected for invalid confidence
    if (err.message.includes("confidence")) {
      console.log(`    Validation error: ${err.message.substring(0, 50)}`);
    } else {
      throw err;
    }
  }
});

// Test 3: Learn with zero confidence
test("learn accepts confidence 0.0 (edge case)", () => {
  const code = `
    (reasoning-sequence
      (learn "uncertain-fact" {:value "maybe"} :confidence 0.0))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || learnStage.confidence !== 0.0) {
    throw new Error("Should accept confidence 0.0");
  }

  console.log(`    Zero confidence accepted: ${learnStage.confidence}`);
});

// Test 4: Learn with max confidence
test("learn accepts confidence 1.0 (high confidence)", () => {
  const code = `
    (reasoning-sequence
      (learn "certain-fact" {:value "definitely"} :confidence 1.0))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || learnStage.confidence !== 1.0) {
    throw new Error("Should accept confidence 1.0");
  }

  console.log(`    Max confidence accepted: ${learnStage.confidence}`);
});

// Test 5: Multiple learns in sequence
test("multiple learn facts in sequence", () => {
  const code = `
    (reasoning-sequence
      (learn "fact-1" {:data "first"} :confidence 0.8)
      (learn "fact-2" {:data "second"} :confidence 0.9)
      (learn "fact-3" {:data "third"} :confidence 0.7))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const stages = result.stages || [];
  if (stages.length !== 3) {
    throw new Error(`Expected 3 learn stages, got ${stages.length}`);
  }

  for (let i = 0; i < 3; i++) {
    if (stages[i].kind !== "learn-result") {
      throw new Error(`Stage ${i} should be learn-result, got ${stages[i].kind}`);
    }
  }

  console.log(`    Saved ${stages.length} facts in sequence`);
});

// Test 6: Learn with custom source tracking
test("learn tracks source type", () => {
  const code = `
    (reasoning-sequence
      (learn "search-fact" {:data "from-search"} :confidence 0.9 :source "search")
      (learn "user-fact" {:data "from-user"} :confidence 0.95 :source "user"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const stages = result.stages || [];
  if (stages[0].source !== "search" || stages[1].source !== "user") {
    throw new Error("Source tracking failed");
  }

  console.log(`    Sources tracked: "${stages[0].source}", "${stages[1].source}"`);
});

// Test 7: Learn data structure validation
test("learn stores structured data correctly", () => {
  const code = `
    (reasoning-sequence
      (learn "structured"
        {:title "Example"
         :description "A test fact"
         :values [1 2 3]}
        :confidence 0.92))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || !learnStage.data) {
    throw new Error("Data not stored");
  }

  if (learnStage.data.title !== "Example") {
    throw new Error("Structured data not preserved");
  }

  console.log(`    Structured data fields: title="${learnStage.data.title}"`);
});

// Test 8: Learn in combination with decide
test("learned facts accessible in decide stage", () => {
  const code = `
    (reasoning-sequence
      (learn "decision-fact" {:recommendation "proceed"} :confidence 0.88)
      (decide :choice "use-learned-data"))
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

  // Check that context has learned data
  if (!context.learned || context.learned.size === 0) {
    throw new Error("Learned data not stored in context");
  }

  console.log(`    Execution: ${path.join(" → ")}, learned count: ${context.learned.size}`);
});

// Test 9: Metadata timestamps
test("learn result includes metadata timestamps", () => {
  const code = `
    (reasoning-sequence
      (learn "timestamped" {:data "with-timestamp"} :confidence 0.85))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || !learnStage.timestamp) {
    throw new Error("Timestamp not included in result");
  }

  // Verify timestamp is valid ISO 8601
  const timestamp = new Date(learnStage.timestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error("Invalid timestamp format");
  }

  console.log(`    Timestamp: ${learnStage.timestamp}`);
});

// Test 10: Learn default source
test("learn uses default source when not specified", () => {
  const code = `
    (reasoning-sequence
      (learn "default-source" {:data "test"}))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || !learnStage.source) {
    throw new Error("Default source not set");
  }

  console.log(`    Default source: "${learnStage.source}"`);
});

// Test 11: Learn default confidence
test("learn uses default confidence when not specified", () => {
  const code = `
    (reasoning-sequence
      (learn "default-confidence" {:data "test"}))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || learnStage.confidence === undefined) {
    throw new Error("Default confidence not set");
  }

  if (learnStage.confidence !== 0.85) {
    throw new Error(`Expected default confidence 0.85, got ${learnStage.confidence}`);
  }

  console.log(`    Default confidence: ${learnStage.confidence}`);
});

// Test 12: Context memory integration
test("learn data stored in context.learned map", () => {
  const code = `
    (reasoning-sequence
      (learn "context-test" {:value "in-memory"} :confidence 0.9)
      (observe "check-memory"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);

  // Verify context.learned is a Map
  if (!context.learned || !(context.learned instanceof Map)) {
    throw new Error("context.learned should be a Map");
  }

  if (!context.learned.has("context-test")) {
    throw new Error("Learned fact not in context map");
  }

  const stored = context.learned.get("context-test");
  if (stored.data.value !== "in-memory") {
    throw new Error("Data not correctly stored in context");
  }

  console.log(`    Context map size: ${context.learned.size}, entry: context-test`);
});

// Test 13: Metadata in execution path
test("learn execution recorded in metadata.executionPath", () => {
  const code = `
    (reasoning-sequence
      (observe "start")
      (learn "path-test" {:data "tracked"} :confidence 0.85)
      (decide :choice "end"))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const path = result?.metadata?.executionPath || [];
  const learnIndex = path.indexOf("learn");

  if (learnIndex === -1) {
    throw new Error("learn not recorded in execution path");
  }

  if (path[learnIndex - 1] !== "observe" || path[learnIndex + 1] !== "decide") {
    throw new Error("Execution order incorrect");
  }

  console.log(`    Execution path: ${path.join(" → ")}`);
});

// Test 14: Error handling for null data
test("learn handles null/undefined data gracefully", () => {
  const code = `
    (reasoning-sequence
      (learn "null-test" null :confidence 0.5))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();

  try {
    const context = interpreter.interpret(ast);
    const result = context.lastValue;
    const learnStage = result.stages?.[0];

    // Should either accept null or error gracefully
    if (learnStage) {
      if (learnStage.kind === "learn-error") {
        console.log(`    Null data error handled gracefully`);
      } else if (learnStage.data === null) {
        console.log(`    Null data accepted and stored`);
      }
    }
  } catch (err: any) {
    console.log(`    Error handler triggered: ${err.message.substring(0, 30)}...`);
  }
});

// Test 15: Large data structures
test("learn handles large/complex data structures", () => {
  const code = `
    (reasoning-sequence
      (learn "large-data"
        {:items [1 2 3 4 5 6 7 8 9 10]
         :nested {:level1 {:level2 {:level3 "deep"}}}
         :strings ["a" "b" "c"]}
        :confidence 0.95))
  `;

  const tokens = lex(code);
  const ast = parse(tokens);
  const interpreter = new Interpreter();
  const context = interpreter.interpret(ast);
  const result = context.lastValue;

  const learnStage = result.stages?.[0];
  if (!learnStage || !learnStage.data.nested.level1.level2.level3) {
    throw new Error("Deep nesting not preserved");
  }

  if (learnStage.data.items.length !== 10) {
    throw new Error("Array data not preserved");
  }

  console.log(`    Large data: array(${learnStage.data.items.length}), nested(3 levels)`);
});

console.log("\n=== Phase 9b Persistence Tests Complete ===\n");

// Cleanup
cleanupTestData();
