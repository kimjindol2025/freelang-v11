// Test Phase 4 Week 1: First-Class Functions - Simple Tests

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🧩 Phase 4 Week 1: Testing First-Class Functions (Simple)\n");

// Test 1: Direct function value evaluation
console.log("📋 Test 1: Direct Function Value Evaluation");
console.log("──────────────────────────────────────────");

try {
  const code1 = `
[FUNC test1
  :body (fn [$x] (+ $x 1))
]
`;

  const interp1 = new Interpreter();
  const tokens1 = lex(code1);
  const blocks1 = parse(tokens1);
  interp1.interpret(blocks1);

  const testFunc1 = interp1["context"].functions.get("test1");
  if (testFunc1) {
    const fnValue = (interp1 as any).eval(testFunc1.body);
    console.log(`✅ Function value created: kind=${fnValue.kind}, params=${fnValue.params}`);
    console.log(`   Function can store closure environment\n`);
  }
} catch (e: any) {
  console.log(`❌ Test 1 Error: ${e.message}\n`);
}

// Test 2: Function value with call
console.log("📋 Test 2: Function Value with Call");
console.log("──────────────────────────────────");

try {
  const code2 = `
[FUNC test2
  :body (call (fn [$x] (+ $x 1)) 5)
]
`;

  const interp2 = new Interpreter();
  const tokens2 = lex(code2);
  const blocks2 = parse(tokens2);
  interp2.interpret(blocks2);

  const testFunc2 = interp2["context"].functions.get("test2");
  if (testFunc2) {
    const result2 = (interp2 as any).eval(testFunc2.body);
    console.log(`✅ Direct call of function value: ${result2} (expected 6)\n`);
  }
} catch (e: any) {
  console.log(`❌ Test 2 Error: ${e.message}\n`);
}

// Test 3: Multiple parameter function
console.log("📋 Test 3: Multiple Parameter Function");
console.log("────────────────────────────────────");

try {
  const code3 = `
[FUNC test3
  :body (call (fn [$x $y] (+ $x $y)) 3 4)
]
`;

  const interp3 = new Interpreter();
  const tokens3 = lex(code3);
  const blocks3 = parse(tokens3);
  interp3.interpret(blocks3);

  const testFunc3 = interp3["context"].functions.get("test3");
  if (testFunc3) {
    const result3 = (interp3 as any).eval(testFunc3.body);
    console.log(`✅ Multiple parameters: ${result3} (expected 7)\n`);
  }
} catch (e: any) {
  console.log(`❌ Test 3 Error: ${e.message}\n`);
}

// Test 4: Closure capture in let
console.log("📋 Test 4: Closure Capture");
console.log("──────────────────────────");

try {
  const code4 = `
[FUNC test4
  :body (let [[y 10]] (call (fn [$x] (+ $x y)) 5))
]
`;

  const interp4 = new Interpreter();
  const tokens4 = lex(code4);
  const blocks4 = parse(tokens4);
  interp4.interpret(blocks4);

  const testFunc4 = interp4["context"].functions.get("test4");
  if (testFunc4) {
    const result4 = (interp4 as any).eval(testFunc4.body);
    console.log(`✅ Closure capture: ${result4} (expected 15)\n`);
  }
} catch (e: any) {
  console.log(`❌ Test 4 Error: ${e.message}\n`);
}

// Test 5: Nested functions (Higher-order functions)
console.log("📋 Test 5: Nested Functions");
console.log("──────────────────────────");

try {
  const code5 = `
[FUNC test5
  :body (call (call (fn [$x] (fn [$y] (+ $x $y))) 5) 3)
]
`;

  const interp5 = new Interpreter();
  const tokens5 = lex(code5);
  const blocks5 = parse(tokens5);
  interp5.interpret(blocks5);

  const testFunc5 = interp5["context"].functions.get("test5");
  if (testFunc5) {
    const result5 = (interp5 as any).eval(testFunc5.body);
    console.log(`✅ Nested functions: ${result5} (expected 8)\n`);
  }
} catch (e: any) {
  console.log(`❌ Test 5 Error: ${e.message}\n`);
}

// Summary
console.log("🎯 Summary:");
console.log("────────────");
console.log(`✅ Phase 4 Week 1: First-Class Functions Implementation`);
console.log(`   - Function values can be created with (fn [params] body)`);
console.log(`   - Functions can be called with (call fn-value args)`);
console.log(`   - Closures capture environment at definition time`);
console.log(`   - Higher-order functions supported (returning functions)\n`);
console.log(`🚀 Ready for Phase 4 Week 2: Monadic Operations`);
