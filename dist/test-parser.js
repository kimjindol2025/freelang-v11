"use strict";
// FreeLang v9: Parser Test
// Token[] → AST 검증
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
const fs = __importStar(require("fs"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
console.log("📝 FreeLang v9 Parser Test\n");
console.log("═══════════════════════════════════\n");
// Test 1: Simplest block
console.log("Test 1: Simplest block");
console.log("───────────────────────────────────");
try {
    const code1 = `[TEST simple]`;
    const tokens1 = (0, lexer_1.lex)(code1);
    console.log(`✅ Tokens generated: ${tokens1.length}`);
    tokens1.forEach((t, i) => {
        console.log(`  ${i}: ${t.type} = "${t.value}"`);
    });
    console.log(`Parsing...`);
    const ast1 = (0, parser_1.parse)(tokens1);
    console.log(`✅ Parsed ${ast1.length} blocks:`);
    ast1.forEach((block) => {
        console.log(`  [${block.type} ${block.name}]`);
    });
}
catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack?.split('\n').slice(0, 5).join('\n'));
}
console.log("\n");
// Test 2: Parse simple-intent.fl
console.log("Test 2: simple-intent.fl");
console.log("───────────────────────────────────");
try {
    const code2 = fs.readFileSync("./examples/simple-intent.fl", "utf-8");
    const tokens2 = (0, lexer_1.lex)(code2);
    const ast2 = (0, parser_1.parse)(tokens2);
    console.log(`✅ Parsed ${ast2.length} blocks:`);
    ast2.forEach((block, i) => {
        console.log(`  ${i + 1}. [${block.type} ${block.name}]`);
    });
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 3: Simple block
console.log("Test 3: Simple block");
console.log("───────────────────────────────────");
try {
    const code3 = `
    [FUNC test-func
      :params [$x $y]
      :body (+ $x $y)
    ]
  `;
    const tokens3 = (0, lexer_1.lex)(code3);
    const ast3 = (0, parser_1.parse)(tokens3);
    console.log(`✅ Parsed 1 block:`);
    const block = ast3[0];
    console.log(`  Type: ${block.type}`);
    console.log(`  Name: ${block.name}`);
    console.log(`  Fields: ${Array.from(block.fields.keys()).join(", ")}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 4: Nested S-expressions
console.log("Test 4: Nested S-expressions");
console.log("───────────────────────────────────");
try {
    const code4 = `
    [INTENT calc
      :result (+ (* $price $tax) $base)
    ]
  `;
    const tokens4 = (0, lexer_1.lex)(code4);
    const ast4 = (0, parser_1.parse)(tokens4);
    console.log(`✅ Parsed nested S-expressions`);
    const block = ast4[0];
    const resultField = block.fields.get(":result");
    if (resultField && resultField.kind === "sexpr") {
        console.log(`  Outer op: ${resultField.op}`);
        console.log(`  Args: ${resultField.args.length}`);
    }
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 5: Arrays
console.log("Test 5: Arrays");
console.log("───────────────────────────────────");
try {
    const code5 = `
    [DATA items
      :values [1 2 3 4 5]
    ]
  `;
    const tokens5 = (0, lexer_1.lex)(code5);
    const ast5 = (0, parser_1.parse)(tokens5);
    console.log(`✅ Parsed array`);
    const block = ast5[0];
    const valuesField = block.fields.get(":values");
    if (valuesField && valuesField.kind === "block" && valuesField.type === "Array") {
        const items = valuesField.fields.get("items");
        console.log(`  Array items: ${Array.isArray(items) ? items.length : 1}`);
    }
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 6: Error handling
console.log("Test 6: Error handling");
console.log("───────────────────────────────────");
try {
    const badCode = `[BLOCK name :key]`; // Missing closing bracket
    const tokens6 = (0, lexer_1.lex)(badCode);
    const ast6 = (0, parser_1.parse)(tokens6);
    console.log("❌ Should have thrown error");
}
catch (error) {
    console.log(`✅ Caught error: ${error.message}`);
}
console.log("\n═══════════════════════════════════");
console.log("✅ Parser tests complete!\n");
//# sourceMappingURL=test-parser.js.map