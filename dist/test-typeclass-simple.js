"use strict";
// Phase 5 Week 2 Day 1: Simple TypeClass Parsing Test
// 기본 파싱만 먼저 테스트
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
console.log("🚀 Phase 5 Week 2 Day 1: Simple TypeClass Parsing\n");
// TEST 1: Minimal TYPECLASS
console.log("=".repeat(60));
console.log("TEST 1: Minimal TYPECLASS");
console.log("=".repeat(60));
try {
    const code1 = `
[TYPECLASS Monad]
`;
    console.log(`Code: [TYPECLASS Monad]`);
    const tokens = (0, lexer_1.lex)(code1);
    console.log(`Tokens: ${tokens.map((t) => `${t.type}(${t.value})`).join(" ")}`);
    const ast = (0, parser_1.parse)(tokens);
    console.log(`AST: ${JSON.stringify(ast[0], null, 2)}`);
    console.log(`✅ Parsed successfully\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}`);
    if (e.line !== undefined) {
        console.log(`   At line ${e.line}, col ${e.col}\n`);
    }
    else {
        console.log();
    }
}
// TEST 2: TYPECLASS with field
console.log("=".repeat(60));
console.log("TEST 2: TYPECLASS with :name field");
console.log("=".repeat(60));
try {
    const code2 = `
[TYPECLASS Monad :test value]
`;
    console.log(`Code: [TYPECLASS Monad :test value]`);
    const tokens = (0, lexer_1.lex)(code2);
    console.log(`Tokens: ${tokens.map((t) => `${t.type}(${t.value})`).join(" ")}`);
    const ast = (0, parser_1.parse)(tokens);
    console.log(`AST Kind: ${ast[0].kind}`);
    console.log(`AST Name: ${ast[0].name}`);
    console.log(`AST Fields: ${ast[0].fields ? Array.from(ast[0].fields.keys()) : "none"}`);
    console.log(`✅ Parsed successfully\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}`);
    if (e.line !== undefined) {
        console.log(`   At line ${e.line}, col ${e.col}\n`);
    }
    else {
        console.log();
    }
}
// TEST 3: Check lexer handling of :keyword
console.log("=".repeat(60));
console.log("TEST 3: Lexer :keyword handling");
console.log("=".repeat(60));
try {
    const code3 = `:typeParams`;
    console.log(`Code: :typeParams`);
    const tokens = (0, lexer_1.lex)(code3);
    console.log(`Tokens: ${tokens.map((t) => `${t.type}(${t.value})`).join(" ")}`);
    // Check what token type is produced
    const token = tokens[0];
    console.log(`First token type: ${token.type}`);
    console.log(`First token value: ${token.value}\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
// TEST 4: Check MODULE parsing (working reference)
console.log("=".repeat(60));
console.log("TEST 4: MODULE parsing (reference)");
console.log("=".repeat(60));
try {
    const code4 = `
[MODULE math
  :exports [add subtract]
  :body []
]
`;
    console.log(`Code: [MODULE math :exports [add subtract] :body []]`);
    const tokens = (0, lexer_1.lex)(code4);
    const ast = (0, parser_1.parse)(tokens);
    console.log(`AST Kind: ${ast[0].kind}`);
    console.log(`AST Name: ${ast[0].name}`);
    console.log(`✅ MODULE parsing works as reference\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
//# sourceMappingURL=test-typeclass-simple.js.map