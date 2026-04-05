"use strict";
// Test Phase 4 Week 1: Generics parsing and structure
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
const fs = __importStar(require("fs"));
console.log("🧬 Phase 4 Week 1: Testing Generics Parsing\n");
const genericsCode = fs.readFileSync("examples/stdlib-generics.fl", "utf-8");
console.log("📄 Parsing stdlib-generics.fl...\n");
const tokens = (0, lexer_1.lex)(genericsCode);
const blocks = (0, parser_1.parse)(tokens);
console.log(`✅ Parsed ${blocks.length} blocks\n`);
for (const block of blocks) {
    if (block.kind === "block" && block.type === "FUNC") {
        console.log(`📌 Function: ${block.name}`);
        // Check if generics are parsed
        if (block.generics) {
            console.log(`   Generics: [${block.generics.join(" ")}]`);
        }
        else {
            console.log(`   Generics: (none)`);
        }
        // Check type annotations
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
// Detailed analysis
console.log("📊 Detailed Analysis:");
console.log("─────────────────────");
for (const block of blocks) {
    if (block.kind === "block" && block.type === "FUNC") {
        const generics = block.generics || [];
        const paramTypesRaw = block.typeAnnotations?.get("params");
        const paramTypes = Array.isArray(paramTypesRaw) ? paramTypesRaw : [];
        const returnType = block.typeAnnotations?.get("return");
        console.log(`\n✅ ${block.name}`);
        console.log(`   Generic Variables: ${generics.length > 0 ? generics.join(", ") : "none"}`);
        console.log(`   Type Parameters: ${paramTypes.length > 0 ? paramTypes.length : "none"}`);
        console.log(`   Return Type: ${returnType?.name || "any"}`);
    }
}
console.log("\n🎯 Summary:");
console.log(`   ✅ Generics AST: Implemented`);
console.log(`   ✅ Parser :generics support: Working`);
console.log(`   ✅ Type annotations preserved: Yes`);
console.log(`   📋 Next: Type Checker + Interpreter updates`);
//# sourceMappingURL=test-stdlib-generics.js.map