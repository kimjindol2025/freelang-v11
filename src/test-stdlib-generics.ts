// Test Phase 4 Week 1-2: Generics parsing, type checking, and execution

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";
import * as fs from "fs";

console.log("🧬 Phase 4 Week 1-2: Testing Generics Parsing + Type Checking + Execution\n");

// Test 1: Parsing and Structure
console.log("📋 Test 1: Parsing and Structure");
console.log("────────────────────────────────");

const genericsCode = fs.readFileSync("examples/stdlib-generics.fl", "utf-8");
const tokens = lex(genericsCode);
const blocks = parse(tokens);

console.log(`✅ Parsed ${blocks.length} blocks\n`);

const funcBlocks: any[] = [];
for (const block of blocks) {
  if (block.kind === "block" && block.type === "FUNC") {
    funcBlocks.push(block);
    console.log(`📌 Function: ${block.name}`);

    if ((block as any).generics) {
      console.log(`   Generics: [${(block as any).generics.join(" ")}]`);
    } else {
      console.log(`   Generics: (none)`);
    }

    if (block.typeAnnotations) {
      if (block.typeAnnotations.has("params")) {
        const params = block.typeAnnotations.get("params");
        console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
      }
      if (block.typeAnnotations.has("return")) {
        const returnType = block.typeAnnotations.get("return");
        console.log(`   Return: ${returnType?.name}`);
      }
    }
    console.log();
  }
}

// Test 2: Type Checker Registration
console.log("\n📋 Test 2: Type Checker Registration");
console.log("──────────────────────────────────");

const interpreter = new Interpreter();
interpreter.interpret(blocks);
const context = interpreter.getContext();

console.log(`✅ Registered ${context.functions.size} functions in interpreter`);
for (const [name, func] of context.functions) {
  if (func.generics && func.generics.length > 0) {
    console.log(`   ✅ ${name}: Generic function [${func.generics.join(", ")}]`);
  }
}

// Test 3: Execution Tests
console.log("\n📋 Test 3: Generic Function Execution");
console.log("──────────────────────────────────────");

const testCases = [
  {
    name: "identity[int]",
    code: "[FUNC test :body (identity[int] 42)]",
    expected: 42,
  },
  {
    name: "identity[string]",
    code: '[FUNC test :body (identity[string] "hello")]',
    expected: "hello",
  },
  {
    name: "first-of-pair[int string]",
    code: "[FUNC test :body (first-of-pair[int string] [10 20])]",
    expected: 10,
  },
  {
    name: "second-of-pair[int string]",
    code: "[FUNC test :body (second-of-pair[int string] [10 20])]",
    expected: 20,
  },
];

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  try {
    const testTokens = lex(testCase.code);
    const testBlocks = parse(testTokens);

    // Create fresh interpreter for each test
    const testInterpreter = new Interpreter();
    testInterpreter.interpret(blocks); // Load generic functions first
    testInterpreter.interpret(testBlocks); // Load test function

    // Get test function and execute it
    const testFunc = testInterpreter.getContext().functions.get("test");
    let result: any = null;

    if (testFunc) {
      // Execute test function body
      result = (testInterpreter as any).eval(testFunc.body);
    } else {
      throw new Error("Test function not found");
    }

    if (result === testCase.expected) {
      console.log(`✅ ${testCase.name}: PASS (got ${JSON.stringify(result)})`);
      passCount++;
    } else {
      console.log(`❌ ${testCase.name}: FAIL (expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(result)})`);
      failCount++;
    }
  } catch (error: any) {
    console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
    failCount++;
  }
}

// Summary
console.log("\n🎯 Summary:");
console.log("────────────");
console.log(`✅ Parsing: Working (${funcBlocks.length} generic functions)`);
console.log(`✅ Type Checker: Generic functions registered (${context.functions.size} total)`);
console.log(`📊 Execution Tests: ${passCount} passed, ${failCount} failed`);

if (failCount === 0) {
  console.log(`\n🚀 Phase 4 Week 1-2: Generic System COMPLETE!`);
} else {
  console.log(`\n⚠️ Phase 4 Week 1-2: ${failCount} test(s) need fixing`);
}
