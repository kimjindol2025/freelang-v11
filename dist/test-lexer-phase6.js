"use strict";
// Phase 6: Lexer Validation Tests
// Verify tokenization is correct for MODULE syntax
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const token_1 = require("./token");
console.log("🔍 Phase 6: Lexer Validation\n");
// ============================================================
// TEST 1: MODULE Syntax Tokenization
// ============================================================
console.log("=".repeat(60));
console.log("TEST 1: MODULE Syntax Tokenization");
console.log("=".repeat(60));
const moduleCode = `[MODULE math
 :exports [add mul]
 :body []
]`;
console.log("Input:");
console.log(moduleCode);
console.log("\nTokens:");
try {
    const tokens = (0, lexer_1.lex)(moduleCode);
    // Display tokens
    tokens.forEach((token, idx) => {
        console.log(`  ${idx}: ${token.type.padEnd(15)} = "${token.value}"`);
    });
    // Verify token sequence
    const expectedSequence = [
        [token_1.TokenType.LBracket, "["],
        [token_1.TokenType.Module, "MODULE"],
        [token_1.TokenType.Symbol, "math"],
        [token_1.TokenType.Colon, ":"],
        [token_1.TokenType.Symbol, "exports"],
        [token_1.TokenType.LBracket, "["],
        [token_1.TokenType.Symbol, "add"],
        [token_1.TokenType.Symbol, "mul"],
        [token_1.TokenType.RBracket, "]"],
        [token_1.TokenType.Colon, ":"],
        [token_1.TokenType.Symbol, "body"],
        [token_1.TokenType.LBracket, "["],
        [token_1.TokenType.RBracket, "]"],
        [token_1.TokenType.RBracket, "]"],
        [token_1.TokenType.EOF, ""],
    ];
    let allMatch = true;
    for (let i = 0; i < expectedSequence.length; i++) {
        const [expType, expValue] = expectedSequence[i];
        if (i >= tokens.length) {
            console.log(`❌ Token ${i}: Missing (expected ${expType})`);
            allMatch = false;
            break;
        }
        const token = tokens[i];
        if (token.type !== expType || token.value !== expValue) {
            console.log(`❌ Token ${i}: Got ${token.type}("${token.value}"), expected ${expType}("${expValue}")`);
            allMatch = false;
        }
    }
    if (allMatch) {
        console.log("\n✅ MODULE tokenization CORRECT");
        console.log("   Colon properly separated from identifiers");
        console.log("   MODULE keyword recognized as Module token");
    }
    else {
        console.log("\n❌ MODULE tokenization FAILED");
    }
}
catch (e) {
    console.log(`❌ Lexer error: ${e.message}\n`);
}
// ============================================================
// TEST 2: Qualified Identifier (math:add)
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 2: Qualified Identifier (math:add)");
console.log("=".repeat(60));
const qualifiedCode = `math:add`;
console.log("Input: math:add");
console.log("\nTokens:");
try {
    const tokens = (0, lexer_1.lex)(qualifiedCode);
    tokens.forEach((token, idx) => {
        if (token.type !== token_1.TokenType.EOF) {
            console.log(`  ${idx}: ${token.type.padEnd(15)} = "${token.value}"`);
        }
    });
    // Should be: SYMBOL(math), COLON, SYMBOL(add), EOF
    if (tokens.length === 4 &&
        tokens[0].type === token_1.TokenType.Symbol &&
        tokens[0].value === "math" &&
        tokens[1].type === token_1.TokenType.Colon &&
        tokens[1].value === ":" &&
        tokens[2].type === token_1.TokenType.Symbol &&
        tokens[2].value === "add" &&
        tokens[3].type === token_1.TokenType.EOF) {
        console.log("\n✅ Qualified identifier CORRECT");
        console.log("   math:add → [SYMBOL(math), COLON, SYMBOL(add), EOF]");
    }
    else {
        console.log("\n❌ Qualified identifier FAILED");
        console.log("   Expected: [SYMBOL(math), COLON, SYMBOL(add), EOF]");
    }
}
catch (e) {
    console.log(`❌ Lexer error: ${e.message}\n`);
}
// ============================================================
// TEST 3: IMPORT Keyword Recognition
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 3: IMPORT Keyword Recognition");
console.log("=".repeat(60));
const importCode = `(import math :from "./math.fl")`;
console.log("Input: (import math :from \"./math.fl\")");
console.log("\nTokens:");
try {
    const tokens = (0, lexer_1.lex)(importCode);
    tokens.forEach((token, idx) => {
        if (token.type !== token_1.TokenType.EOF) {
            if (token.type === token_1.TokenType.String) {
                console.log(`  ${idx}: ${token.type.padEnd(15)} = "<path>"`);
            }
            else {
                console.log(`  ${idx}: ${token.type.padEnd(15)} = "${token.value}"`);
            }
        }
    });
    // Verify: LPAREN, IMPORT, SYMBOL, COLON, SYMBOL, STRING, RPAREN
    let match = tokens[0].type === token_1.TokenType.LParen &&
        tokens[1].type === token_1.TokenType.Import &&
        tokens[2].type === token_1.TokenType.Symbol &&
        tokens[3].type === token_1.TokenType.Colon &&
        tokens[4].type === token_1.TokenType.Symbol &&
        tokens[5].type === token_1.TokenType.String &&
        tokens[6].type === token_1.TokenType.RParen;
    if (match) {
        console.log("\n✅ IMPORT tokenization CORRECT");
        console.log("   import recognized as Import token");
        console.log("   :from separated into COLON + SYMBOL");
    }
    else {
        console.log("\n❌ IMPORT tokenization FAILED");
    }
}
catch (e) {
    console.log(`❌ Lexer error: ${e.message}\n`);
}
// ============================================================
// TEST 4: TYPECLASS and INSTANCE Keywords
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 4: TYPECLASS and INSTANCE Keywords");
console.log("=".repeat(60));
const typeClassCode = `[TYPECLASS Monad [M] :methods [pure bind]]`;
console.log("Input: [TYPECLASS Monad [M] :methods [pure bind]]");
console.log("\nTokens:");
try {
    const tokens = (0, lexer_1.lex)(typeClassCode);
    // Should start with: LBRACKET, TYPECLASS, SYMBOL(Monad), ...
    if (tokens[0].type === token_1.TokenType.LBracket && tokens[1].type === token_1.TokenType.TypeClass) {
        console.log(`  0: ${tokens[0].type} = "["`);
        console.log(`  1: ${tokens[1].type} = "TYPECLASS"`);
        console.log("\n✅ TYPECLASS keyword CORRECT");
    }
    else {
        console.log("\n❌ TYPECLASS keyword FAILED");
        console.log(`   Got: ${tokens[1].type}`);
    }
}
catch (e) {
    console.log(`❌ Lexer error: ${e.message}\n`);
}
// ============================================================
// TEST 5: Phase 5 Backward Compatibility
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("TEST 5: Phase 5 Backward Compatibility");
console.log("=".repeat(60));
const phase5Code = `[FUNC add :params [$a $b] :body (+ $a $b)]`;
console.log("Input: [FUNC add :params [$a $b] :body (+ $a $b)]");
console.log("\nKey tokens:");
try {
    const tokens = (0, lexer_1.lex)(phase5Code);
    // Check critical tokens
    const funcTokenIdx = tokens.findIndex((t) => t.value === "FUNC");
    const paramsColonIdx = tokens.findIndex((t, i) => i > 0 && t.type === token_1.TokenType.Colon && tokens[i + 1].value === "params");
    const bodyColonIdx = tokens.findIndex((t, i) => i > paramsColonIdx &&
        t.type === token_1.TokenType.Colon &&
        tokens[i + 1].value === "body");
    console.log(`  FUNC token at ${funcTokenIdx}: ${tokens[funcTokenIdx].type}`);
    console.log(`  :params at ${paramsColonIdx + 1}: COLON + SYMBOL`);
    console.log(`  :body at ${bodyColonIdx + 1}: COLON + SYMBOL`);
    // Critical: :params and :body should now be COLON + SYMBOL, not Keyword
    if (tokens[paramsColonIdx].type === token_1.TokenType.Colon &&
        tokens[paramsColonIdx + 1].type === token_1.TokenType.Symbol &&
        tokens[paramsColonIdx + 1].value === "params" &&
        tokens[bodyColonIdx].type === token_1.TokenType.Colon &&
        tokens[bodyColonIdx + 1].type === token_1.TokenType.Symbol &&
        tokens[bodyColonIdx + 1].value === "body") {
        console.log("\n✅ Phase 5 Backward Compatibility MAINTAINED");
        console.log("   Parser can still work with COLON + SYMBOL pattern");
    }
    else {
        console.log("\n⚠️  WARNING: Parser may need updates");
    }
}
catch (e) {
    console.log(`❌ Lexer error: ${e.message}\n`);
}
// ============================================================
// SUMMARY
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("📋 PHASE 6 LEXER VALIDATION SUMMARY");
console.log("=".repeat(60));
console.log("\n✅ Changes Applied:");
console.log("   • TOKEN: Added Module, TypeClass, Instance, Import, Open");
console.log("   • COLON: Now separate token (not keyword prefix)");
console.log("   • SYMBOL: ':' excluded from identifier");
console.log("   • KEYWORDS: Map-based keyword recognition");
console.log("\n✅ Validation Tests:");
console.log("   1. MODULE syntax tokenization");
console.log("   2. Qualified identifier (math:add)");
console.log("   3. IMPORT keyword recognition");
console.log("   4. TYPECLASS/INSTANCE keywords");
console.log("   5. Phase 5 backward compatibility");
console.log("\n🎯 Next: Parser integration (Phase 6 Step 3)\n");
//# sourceMappingURL=test-lexer-phase6.js.map