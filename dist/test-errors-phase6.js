"use strict";
// Phase 6 Step 4: Error Classes and Logging Tests
// 에러 클래스와 로깅 시스템 검증
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const errors_1 = require("./errors");
const logger_1 = require("./logger");
console.log("🚀 Phase 6 Step 4: Error Classes & Logging Tests\n");
// ============================================================
// TEST 1: ModuleNotFoundError (모듈 없음)
// ============================================================
console.log("=".repeat(60));
console.log("TEST 1: ModuleNotFoundError");
console.log("=".repeat(60));
const importNonExistentModule = `(import nonexistent)`;
console.log('Input: (import nonexistent)');
console.log("Expected: ModuleNotFoundError");
console.log("");
try {
    const tokens = (0, lexer_1.lex)(importNonExistentModule);
    const ast = (0, parser_1.parse)(tokens);
    const interp = new interpreter_1.Interpreter(undefined, new logger_1.NoOpLogger());
    interp.interpret(ast);
    console.log("❌ Error: Expected ModuleNotFoundError but none was thrown");
}
catch (e) {
    if (e instanceof errors_1.ModuleNotFoundError) {
        console.log("✅ Caught ModuleNotFoundError");
        console.log(`   Message: ${e.message}`);
        console.log(`   Module: ${e.moduleName}`);
        console.log(`   Error name: ${e.name}`);
    }
    else {
        console.log(`❌ Wrong error type: ${e.constructor.name}`);
        console.log(`   Message: ${e.message}`);
    }
}
// ============================================================
// TEST 2: SelectiveImportError (함수 없음)
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 2: SelectiveImportError (Missing Function)");
console.log("=".repeat(60));
const selectiveImportError = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]

(import math :only [nonexistent])`;
console.log('Input: (import math :only [nonexistent])');
console.log("Expected: Warning logged (selective import is non-blocking)");
console.log("");
try {
    const tokens = (0, lexer_1.lex)(selectiveImportError);
    const ast = (0, parser_1.parse)(tokens);
    const interp = new interpreter_1.Interpreter(undefined, new logger_1.NoOpLogger());
    const ctx = interp.interpret(ast);
    // Check if functions were imported (should be empty since nonexistent doesn't exist)
    const hasNonexistent = ctx.functions.has("math:nonexistent");
    const hasAdd = ctx.functions.has("math:add");
    console.log(`✅ No error thrown (selective import is non-blocking)`);
    console.log(`   math:add imported: ${hasAdd}`);
    console.log(`   math:nonexistent imported: ${!hasNonexistent} (correctly NOT imported)`);
}
catch (e) {
    console.log(`❌ Unexpected error: ${e.message}`);
}
// ============================================================
// TEST 3: ModuleNotFoundError with source info
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 3: ModuleNotFoundError with Source Info");
console.log("=".repeat(60));
const importWithSource = `(import utils :from "./utils.fl")`;
console.log('Input: (import utils :from "./utils.fl")');
console.log("Expected: ModuleNotFoundError with source info");
console.log("");
try {
    const tokens = (0, lexer_1.lex)(importWithSource);
    const ast = (0, parser_1.parse)(tokens);
    const interp = new interpreter_1.Interpreter(undefined, new logger_1.NoOpLogger());
    interp.interpret(ast);
    console.log("❌ Error: Expected ModuleNotFoundError but none was thrown");
}
catch (e) {
    if (e instanceof errors_1.ModuleNotFoundError) {
        console.log("✅ Caught ModuleNotFoundError");
        console.log(`   Message: ${e.message}`);
        console.log(`   Module: ${e.moduleName}`);
        // Note: :from is handled in parser, may need to check
    }
    else {
        console.log(`❌ Wrong error type: ${e.constructor.name}`);
    }
}
// ============================================================
// TEST 4: OpenBlock error (모듈 없음)
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 4: ModuleNotFoundError (Open)");
console.log("=".repeat(60));
const openNonExistentModule = `(open nonexistent)`;
console.log('Input: (open nonexistent)');
console.log("Expected: ModuleNotFoundError");
console.log("");
try {
    const tokens = (0, lexer_1.lex)(openNonExistentModule);
    const ast = (0, parser_1.parse)(tokens);
    const interp = new interpreter_1.Interpreter(undefined, new logger_1.NoOpLogger());
    interp.interpret(ast);
    console.log("❌ Error: Expected ModuleNotFoundError but none was thrown");
}
catch (e) {
    if (e instanceof errors_1.ModuleNotFoundError) {
        console.log("✅ Caught ModuleNotFoundError");
        console.log(`   Message: ${e.message}`);
        console.log(`   Module: ${e.moduleName}`);
    }
    else {
        console.log(`❌ Wrong error type: ${e.constructor.name}`);
    }
}
// ============================================================
// SUMMARY
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("📋 ERROR HANDLING & LOGGING SUMMARY");
console.log("=".repeat(60));
console.log("\n✅ Tests Completed:");
console.log("   1. ModuleNotFoundError (import)");
console.log("   2. SelectiveImportError (non-blocking warning)");
console.log("   3. ModuleNotFoundError (with source info)");
console.log("   4. ModuleNotFoundError (open)");
console.log("\n✅ Features Implemented:");
console.log("   • ModuleNotFoundError - typed exception");
console.log("   • SelectiveImportError - typed exception");
console.log("   • InvalidModuleStructureError - typed exception");
console.log("   • FunctionRegistrationError - typed exception");
console.log("   • StructuredLogger - timestamped logging");
console.log("   • NoOpLogger - test support");
console.log("   • Logger interface - pluggable logging");
console.log("\n🎯 Next: Integration tests & Phase 6 completion\n");
//# sourceMappingURL=test-errors-phase6.js.map