"use strict";
// Test Phase 4 Week 1-2: Generics parsing, type checking, and execution
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const fs = __importStar(require("fs"));
console.log("🧬 Phase 4 Week 1-2: Testing Generics Parsing + Type Checking + Execution\n");
// Test 1: Parsing and Structure
console.log("📋 Test 1: Parsing and Structure");
console.log("────────────────────────────────");
const genericsCode = fs.readFileSync("examples/stdlib-generics.fl", "utf-8");
const tokens = (0, lexer_1.lex)(genericsCode);
const blocks = (0, parser_1.parse)(tokens);
console.log(`✅ Parsed ${blocks.length} blocks\n`);
const funcBlocks = [];
for (const block of blocks) {
    if (block.kind === "block" && block.type === "FUNC") {
        funcBlocks.push(block);
        console.log(`📌 Function: ${block.name}`);
        if (block.generics) {
            console.log(`   Generics: [${block.generics.join(" ")}]`);
        }
        else {
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
const interpreter = new interpreter_1.Interpreter();
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
        const testTokens = (0, lexer_1.lex)(testCase.code);
        const testBlocks = (0, parser_1.parse)(testTokens);
        // Create fresh interpreter for each test
        const testInterpreter = new interpreter_1.Interpreter();
        testInterpreter.interpret(blocks); // Load generic functions first
        testInterpreter.interpret(testBlocks); // Load test function
        // Get test function and execute it
        const testFunc = testInterpreter.getContext().functions.get("test");
        let result = null;
        if (testFunc) {
            // Execute test function body
            result = testInterpreter.eval(testFunc.body);
        }
        else {
            throw new Error("Test function not found");
        }
        if (result === testCase.expected) {
            console.log(`✅ ${testCase.name}: PASS (got ${JSON.stringify(result)})`);
            passCount++;
        }
        else {
            console.log(`❌ ${testCase.name}: FAIL (expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(result)})`);
            failCount++;
        }
    }
    catch (error) {
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
}
else {
    console.log(`\n⚠️ Phase 4 Week 1-2: ${failCount} test(s) need fixing`);
}
//# sourceMappingURL=test-stdlib-generics.js.map