"use strict";
// FreeLang v9: Phase 11 Error Handling Tests
// Tests for try, catch, finally, throw
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    }
    catch (err) {
        console.log(`✗ ${name}`);
        console.log(`  ${err.message}`);
    }
}
// Phase 11: Error Handling Tests
console.log("=== Phase 11: Error Handling Tests ===\n");
// Test 1: Basic try-catch
test("basic try-catch", () => {
    const code = `(try
    (throw "Test error")
    (catch [err] "caught"))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== "caught") {
        throw new Error(`Expected "caught", got ${result}`);
    }
});
// Test 2: Try with successful execution (no error)
test("try-catch with success", () => {
    const code = `(try
    42
    (catch [err] 0))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== 42) {
        throw new Error(`Expected 42, got ${result}`);
    }
});
// Test 3: Try-catch with error handling
test("try-catch handles error", () => {
    const code = `(try
    (throw "Handled error")
    (catch [err] (+ 100 0)))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== 100) {
        throw new Error(`Expected 100, got ${result}`);
    }
});
// Test 4: Finally block executes (always runs)
test("finally block always executes", () => {
    const code = `(try
    42
    (finally 100))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    // Try body result returned, finally still executes
    if (result !== 42) {
        throw new Error(`Expected 42 from try body, got ${result}`);
    }
});
// Test 5: Finally block executes after error
test("finally executes after error handling", () => {
    const code = `(try
    (throw "error")
    (catch [err] "handled")
    (finally "finalized"))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    // Catch result returned, finally still executes but doesn't affect result
    if (result !== "handled") {
        throw new Error(`Expected "handled" from catch, got ${result}`);
    }
});
// Test 6: Nested try-catch
test("nested try-catch", () => {
    const code = `(try
    (try
      (throw "inner")
      (catch [err] (throw "outer")))
    (catch [err] "outer-caught"))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== "outer-caught") {
        throw new Error(`Expected "outer-caught", got ${result}`);
    }
});
// Test 7: Multiple catch clauses
test("multiple catch clauses", () => {
    const code = `(try
    (throw "Type1")
    (catch [e1] 100)
    (catch [e2] 200))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== 100) {
        throw new Error(`Expected 100 from first catch, got ${result}`);
    }
});
// Test 8: Throw with different error types
test("throw string error", () => {
    const code = `(try
    (throw "String error")
    (catch [err] "caught string error"))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    if (result !== "caught string error") {
        throw new Error(`Expected "caught string error", got "${result}"`);
    }
});
// Test 9: Try-catch-finally all together
test("try-catch-finally complete flow", () => {
    const code = `(try
    (throw "error")
    (catch [err] "caught")
    (finally "finally"))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    interpreter.interpret(ast);
    const result = interpreter.context.lastValue;
    // Catch result is returned, finally executes but doesn't change result
    if (result !== "caught") {
        throw new Error(`Expected "caught" from catch, got "${result}"`);
    }
});
// Test 10: Error propagates if not caught
test("error propagates if not caught", () => {
    const code = `(try
    (throw "uncaught")
    (finally (+ 0 0)))`;
    const tokens = (0, lexer_1.lex)(code);
    const ast = (0, parser_1.parse)(tokens);
    const interpreter = new interpreter_1.Interpreter();
    try {
        interpreter.interpret(ast);
        throw new Error("Expected error to propagate");
    }
    catch (err) {
        if (!err.message.includes("uncaught")) {
            throw new Error(`Expected error to propagate with "uncaught", got "${err.message}"`);
        }
    }
});
console.log("\n=== Phase 11 Error Handling Tests Complete ===\n");
//# sourceMappingURL=test-phase11-error.js.map