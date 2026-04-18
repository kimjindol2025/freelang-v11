// Phase 5 Week 1: Function Composition Tests
// 함수 합성 (compose + pipe) 검증

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🚀 Phase 5 Week 1: Function Composition Tests\n");

// Helper: Run code and evaluate last expression
function runExpr(code: string): any {
  const interp = new Interpreter();
  const tokens = lex(code);
  const ast = parse(tokens);

  // First, use interpret() to register FUNC blocks properly
  interp.interpret(ast);

  // Then evaluate the last node (which should be the main expression)
  let result: any;
  for (const node of ast) {
    // Skip blocks (already processed by interpret)
    if ((node as any).kind === "block") {
      continue;
    }
    // Evaluate other expressions
    result = (interp as any).eval(node);
  }
  return result;
}

// TEST 1: Pipe 연산자 - 기본 동작
console.log("=" .repeat(60));
console.log("TEST 1: Pipe 연산자 (Left-to-Right)");
console.log("=" .repeat(60));

try {
  const code1 = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(pipe 5 add-one double)
`;

  const result1 = runExpr(code1);

  console.log(`Input: (pipe 5 add-one double)`);
  console.log(`Expected: 12 (5 + 1 = 6, 6 * 2 = 12)`);
  console.log(`Result: ${result1}`);
  console.log(`✅ ${result1 === 12 ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 2: Pipe 연산자 - 3개 함수
console.log("=" .repeat(60));
console.log("TEST 2: Pipe 3개 함수");
console.log("=" .repeat(60));

try {
  const code2 = `
[FUNC inc :params [$x] :body (+ $x 1)]
[FUNC double :params [$x] :body (* $x 2)]
[FUNC dec :params [$x] :body (- $x 1)]
(pipe 10 dec double inc)
`;

  const result2 = runExpr(code2);

  console.log(`Input: (pipe 10 dec double inc)`);
  console.log(`Expected: 19 (10 - 1 = 9, 9 * 2 = 18, 18 + 1 = 19)`);
  console.log(`Result: ${result2}`);
  console.log(`✅ ${result2 === 19 ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 3: Compose 연산자 (함수값으로 반환)
console.log("=" .repeat(60));
console.log("TEST 3: Compose 연산자 (Right-to-Left)");
console.log("=" .repeat(60));

try {
  const code3 = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [[f (compose double add-one)]]
  (f 5))
`;

  const result3 = runExpr(code3);

  console.log(`Input: (let [f (compose double add-one)] (f 5))`);
  console.log(`Expected: 12 (compose: f(g(x)) = double(add-one(5)) = double(6) = 12)`);
  console.log(`Result: ${result3}`);
  console.log(`✅ ${result3 === 12 ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 4: Lambda 함수와 Pipe 조합
console.log("=" .repeat(60));
console.log("TEST 4: Pipe with Lambda Functions");
console.log("=" .repeat(60));

try {
  const code4 = `
(pipe 5
  (fn [$x] (* $x 2))
  (fn [$x] (+ $x 3))
  (fn [$x] (- $x 1)))
`;

  const result4 = runExpr(code4);

  console.log(`Input: (pipe 5 (fn [x] (* x 2)) (fn [x] (+ x 3)) (fn [x] (- x 1)))`);
  console.log(`Expected: 12 (5 * 2 = 10, 10 + 3 = 13, 13 - 1 = 12)`);
  console.log(`Result: ${result4}`);
  console.log(`✅ ${result4 === 12 ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// TEST 5: Pipe with Lambda - Complex
console.log("=" .repeat(60));
console.log("TEST 5: Pipe with Complex Lambda Expressions");
console.log("=" .repeat(60));

try {
  const code5 = `
(pipe 10
  (fn [$x] (+ $x 5))
  (fn [$x] (/ $x 3))
  (fn [$x] (* $x 2)))
`;

  const result5 = runExpr(code5);

  console.log(`Input: (pipe 10 (fn [x] (+ x 5)) (fn [k] (/ k 3)) (fn [y] (* y 2)))`);
  console.log(`Expected: 10 (10 + 5 = 15, 15 / 3 = 5, 5 * 2 = 10)`);
  console.log(`Result: ${result5}`);
  console.log(`✅ ${result5 === 10 ? "PASS" : "FAIL"}\n`);
} catch (e: any) {
  console.log(`❌ Error: ${e.message}\n`);
}

// SUMMARY
console.log("=" .repeat(60));
console.log("📋 PHASE 5 WEEK 1: FUNCTION COMPOSITION SUMMARY");
console.log("=" .repeat(60));
console.log("\n✅ Features Tested:");
console.log("   1. Pipe operator (left-to-right data flow)");
console.log("   2. Compose operator (right-to-left function application)");
console.log("   3. Lambda functions with pipes");
console.log("   4. Complex expressions\n");

console.log("📝 Syntax:");
console.log("   (pipe value f g h) → result after applying f → g → h");
console.log("   (compose f g h)    → function(x) = f(g(h(x)))\n");

console.log("✅ Phase 5 Week 1 Complete!\n");
