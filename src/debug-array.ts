// Debug: Array field check
import { lex } from "./lexer";
import { parse } from "./parser";

const code = "[1 2 3]";
const tokens = lex(code);
const ast = parse(tokens);

console.log("AST[0]:", ast[0]);
console.log("AST[0].kind:", (ast[0] as any).kind);
console.log("AST[0].type:", (ast[0] as any).type);
console.log("AST[0].name:", (ast[0] as any).name);
console.log("AST[0].fields:", (ast[0] as any).fields);
console.log("AST[0].fields.get('items'):", (ast[0] as any).fields?.get("items"));

// Test with more detail
if ((ast[0] as any).fields) {
  console.log("\nFields is a Map:");
  for (const [key, value] of (ast[0] as any).fields) {
    console.log(`  ${key}: ${JSON.stringify(value, null, 2)}`);
  }
}
