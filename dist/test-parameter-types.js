"use strict";
// FreeLang v9: Parameter Type Validation Test
// 파라미터 타입 주석 및 검증 테스트
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
console.log("📝 FreeLang v9 Parameter Type Validation Test\n");
console.log("═══════════════════════════════════════════\n");
// Test 1: Parameter type validation - correct types
console.log("Test 1: Parameter type validation - correct types");
console.log("─────────────────────────────────────────────────");
try {
    const code1 = `
    [FUNC add
      :params [[$x int] [$y int]]
      :return int
      :body (+ $x $y)
    ]
  `;
    const tokens1 = (0, lexer_1.lex)(code1);
    const ast1 = (0, parser_1.parse)(tokens1);
    const interpreter1 = new interpreter_1.Interpreter();
    interpreter1.interpret(ast1);
    // Call with correct types (int, int)
    const result = interpreter1.eval({
        kind: "sexpr",
        op: "add",
        args: [
            { kind: "literal", type: "number", value: 5 },
            { kind: "literal", type: "number", value: 3 }
        ]
    });
    console.log(`✅ Correct types (5, 3) → ${result}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 2: Parameter type validation - wrong type (string instead of int)
console.log("Test 2: Parameter type validation - wrong type");
console.log("──────────────────────────────────────────────");
try {
    const code2 = `
    [FUNC add
      :params [[$x int] [$y int]]
      :return int
      :body (+ $x $y)
    ]
  `;
    const tokens2 = (0, lexer_1.lex)(code2);
    const ast2 = (0, parser_1.parse)(tokens2);
    const interpreter2 = new interpreter_1.Interpreter();
    interpreter2.interpret(ast2);
    // Call with wrong type (string instead of int)
    const result = interpreter2.eval({
        kind: "sexpr",
        op: "add",
        args: [
            { kind: "literal", type: "string", value: "hello" },
            { kind: "literal", type: "number", value: 3 }
        ]
    });
    console.log(`❌ Should have thrown error, got: ${result}`);
}
catch (error) {
    console.log(`✅ Caught type error: ${error.message}`);
}
console.log("\n");
// Test 3: Type coercion - int ↔ string
console.log("Test 3: Type coercion - int ↔ string");
console.log("──────────────────────────────────────");
try {
    const code3 = `
    [FUNC concat
      :params [[$a string] [$b string]]
      :return string
      :body (concat $a $b)
    ]
  `;
    const tokens3 = (0, lexer_1.lex)(code3);
    const ast3 = (0, parser_1.parse)(tokens3);
    const interpreter3 = new interpreter_1.Interpreter();
    interpreter3.interpret(ast3);
    // Call with coercion (int → string)
    const result = interpreter3.eval({
        kind: "sexpr",
        op: "concat",
        args: [
            { kind: "literal", type: "number", value: 42 },
            { kind: "literal", type: "string", value: "is the answer" }
        ]
    });
    console.log(`✅ Type coercion (42, "is the answer") → "${result}"`);
}
catch (error) {
    console.log(`ℹ️ Info: ${error.message}`);
}
console.log("\n");
// Test 4: Multiple parameter type checking
console.log("Test 4: Multiple parameter type checking");
console.log("────────────────────────────────────────");
try {
    const code4 = `
    [FUNC process
      :params [[$name string] [$age int] [$active bool]]
      :return string
      :body (concat "User: " $name)
    ]
  `;
    const tokens4 = (0, lexer_1.lex)(code4);
    const ast4 = (0, parser_1.parse)(tokens4);
    const interpreter4 = new interpreter_1.Interpreter();
    interpreter4.interpret(ast4);
    // Call with correct types
    const result = interpreter4.eval({
        kind: "sexpr",
        op: "process",
        args: [
            { kind: "literal", type: "string", value: "Alice" },
            { kind: "literal", type: "number", value: 30 },
            { kind: "literal", type: "symbol", value: "true" }
        ]
    });
    console.log(`✅ Multiple types correct: "${result}"`);
}
catch (error) {
    console.log(`❌ Error: ${error.message}`);
}
console.log("\n");
// Test 5: Backward compatibility - no parameter types
console.log("Test 5: Backward compatibility - no parameter types");
console.log("─────────────────────────────────────────────────────");
try {
    const code5 = `
    [FUNC legacy
      :params [$x $y]
      :return int
      :body (+ $x $y)
    ]
  `;
    const tokens5 = (0, lexer_1.lex)(code5);
    const ast5 = (0, parser_1.parse)(tokens5);
    const interpreter5 = new interpreter_1.Interpreter();
    interpreter5.interpret(ast5);
    // Call with any types (should work because old syntax defaults to 'any')
    const result = interpreter5.eval({
        kind: "sexpr",
        op: "legacy",
        args: [
            { kind: "literal", type: "number", value: 10 },
            { kind: "literal", type: "string", value: "20" }
        ]
    });
    console.log(`✅ Backward compatibility: (10, "20") → ${result}`);
}
catch (error) {
    console.log(`❌ Error: ${error.message}`);
}
console.log("\n═══════════════════════════════════════════\n");
console.log("✅ Parameter type validation tests complete!\n");
//# sourceMappingURL=test-parameter-types.js.map