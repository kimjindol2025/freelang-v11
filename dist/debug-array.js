"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Debug: Array field check
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const code = "[1 2 3]";
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("AST[0]:", ast[0]);
console.log("AST[0].kind:", ast[0].kind);
console.log("AST[0].type:", ast[0].type);
console.log("AST[0].name:", ast[0].name);
console.log("AST[0].fields:", ast[0].fields);
console.log("AST[0].fields.get('items'):", ast[0].fields?.get("items"));
// Test with more detail
if (ast[0].fields) {
    console.log("\nFields is a Map:");
    for (const [key, value] of ast[0].fields) {
        console.log(`  ${key}: ${JSON.stringify(value, null, 2)}`);
    }
}
//# sourceMappingURL=debug-array.js.map