// Debug: TEST 4
import { lex } from "./lexer";
import { parse } from "./parser";

const code = "(match x)";
const tokens = lex(code);
const ast = parse(tokens);

console.log("Code:", code);
console.log("AST:", JSON.stringify(ast, null, 2));
console.log("\nDetailed AST[0]:", ast[0]);
console.log("AST[0].args:", (ast[0] as any).args);
console.log("AST[0].args[0]:", (ast[0] as any).args?.[0]);
console.log("AST[0].args[1]:", (ast[0] as any).args?.[1]);

// Test condition
const condition = ast.length > 0 && (ast[0] as any).args?.[0]?.kind === "literal" && (ast[0] as any).args?.[0]?.type === "symbol";
console.log("\nTest condition result:", condition);
console.log("ast.length > 0:", ast.length > 0);
console.log("ast[0].args[0].kind:", (ast[0] as any).args?.[0]?.kind);
console.log("ast[0].args[0].type:", (ast[0] as any).args?.[0]?.type);
