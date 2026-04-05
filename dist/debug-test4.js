"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Debug: TEST 4
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const code = "(match x)";
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("Code:", code);
console.log("AST:", JSON.stringify(ast, null, 2));
console.log("\nDetailed AST[0]:", ast[0]);
console.log("AST[0].args:", ast[0].args);
console.log("AST[0].args[0]:", ast[0].args?.[0]);
console.log("AST[0].args[1]:", ast[0].args?.[1]);
// Test condition
const condition = ast.length > 0 && ast[0].args?.[0]?.kind === "literal" && ast[0].args?.[0]?.type === "symbol";
console.log("\nTest condition result:", condition);
console.log("ast.length > 0:", ast.length > 0);
console.log("ast[0].args[0].kind:", ast[0].args?.[0]?.kind);
console.log("ast[0].args[0].type:", ast[0].args?.[0]?.type);
//# sourceMappingURL=debug-test4.js.map