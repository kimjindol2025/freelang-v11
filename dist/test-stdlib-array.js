"use strict";
// Test stdlib-array.fl functions
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
const arrayCode = fs.readFileSync("examples/stdlib-array.fl", "utf-8");
const testCode = fs.readFileSync("examples/stdlib-array-test.fl", "utf-8");
const arrayTokens = (0, lexer_1.lex)(arrayCode);
const arrayBlocks = (0, parser_1.parse)(arrayTokens);
const testTokens = (0, lexer_1.lex)(testCode);
const testBlocks = (0, parser_1.parse)(testTokens);
const allBlocks = [...arrayBlocks, ...testBlocks];
class TestInterpreter extends interpreter_1.Interpreter {
    testEval(node) {
        return this.eval(node);
    }
}
const interp = new TestInterpreter();
interp.interpret(allBlocks);
const context = interp.getContext();
console.log("✅ Array functions loaded:", Array.from(context.functions.keys()).filter(n => !n.startsWith("test")).length);
console.log("   Functions:", Array.from(context.functions.keys()).filter(n => !n.startsWith("test")).join(", "));
const testFunctions = Array.from(context.functions.keys()).filter(name => name.startsWith("test-") && !name.includes("all"));
console.log("\n🧪 Running array tests:");
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
        }
        else {
            console.log(`  ❌ ${testName} (returned ${result})`);
            failed++;
        }
    }
    catch (e) {
        console.log(`  ❌ ${testName} (ERROR: ${e.message})`);
        failed++;
    }
}
console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
// Test all-array-tests-pass
try {
    const allPass = interp.testEval({
        kind: "sexpr",
        op: "all-array-tests-pass",
        args: []
    });
    console.log(`\n🎯 all-array-tests-pass: ${allPass ? "✅ PASS" : "❌ FAIL"}`);
}
catch (e) {
    console.log(`\n🎯 all-array-tests-pass: ❌ ERROR - ${e.message}`);
}
//# sourceMappingURL=test-stdlib-array.js.map