// Test stdlib-string.fl functions

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";
import * as fs from "fs";

const stringCode = fs.readFileSync("examples/stdlib-string.fl", "utf-8");
const testCode = fs.readFileSync("examples/stdlib-string-test.fl", "utf-8");

const stringTokens = lex(stringCode);
const stringBlocks = parse(stringTokens);

const testTokens = lex(testCode);
const testBlocks = parse(testTokens);

const allBlocks = [...stringBlocks, ...testBlocks];

class TestInterpreter extends Interpreter {
  public testEval(node: any): any {
    return (this as any).eval(node);
  }
}

const interp = new TestInterpreter();
interp.interpret(allBlocks);
const context = interp.getContext();

console.log("✅ String functions loaded:", Array.from(context.functions.keys()).filter(n => !n.startsWith("test")).length);
console.log("   Functions:", Array.from(context.functions.keys()).filter(n => !n.startsWith("test")).join(", "));

const testFunctions = Array.from(context.functions.keys()).filter(name => name.startsWith("test-") && !name.includes("all"));
console.log("\n🧪 Running string tests:");
let passed = 0;
let failed = 0;

for (const testName of testFunctions) {
  try {
    const result = interp.testEval({
      kind: "sexpr",
      op: testName,
      args: []
    });

    if (result === true) {
      console.log(`  ✅ ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ ${testName} (returned ${result})`);
      failed++;
    }
  } catch (e) {
    console.log(`  ❌ ${testName} (ERROR: ${(e as any).message})`);
    failed++;
  }
}

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);

// Test all-string-tests-pass
try {
  const allPass = interp.testEval({
    kind: "sexpr",
    op: "all-string-tests-pass",
    args: []
  });

  console.log(`\n🎯 all-string-tests-pass: ${allPass ? "✅ PASS" : "❌ FAIL"}`);
} catch (e) {
  console.log(`\n🎯 all-string-tests-pass: ❌ ERROR - ${(e as any).message}`);
}
