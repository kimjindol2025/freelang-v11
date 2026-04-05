// Debug: Test TypeScript Parser directly
import { lex } from "./lexer";
import { parse } from "./parser";

console.log("🔍 DEBUG: TypeScript Parser Test\n");

// Test 1: Simple number literal
const code1 = "(+ 1 2)";
console.log(`Input: ${code1}`);
try {
  const tokens = lex(code1);
  console.log(`Tokens: ${tokens.length}`);
  tokens.forEach((t, i) => console.log(`  [${i}] ${t.type}: ${t.value}`));

  const ast = parse(tokens);
  console.log(`AST: ${JSON.stringify(ast, null, 2)}`);
  console.log(`AST length: ${ast.length}`);
  console.log(`AST[0]: ${JSON.stringify(ast[0], null, 2)}\n`);
} catch (e: any) {
  console.error(`❌ Error: ${e.message}\n`);
}

// Test 2: Array
const code2 = "[1 2 3]";
console.log(`Input: ${code2}`);
try {
  const tokens = lex(code2);
  console.log(`Tokens: ${tokens.length}`);
  tokens.forEach((t, i) => console.log(`  [${i}] ${t.type}: ${t.value}`));

  const ast = parse(tokens);
  console.log(`AST: ${JSON.stringify(ast, null, 2)}\n`);
} catch (e: any) {
  console.error(`❌ Error: ${e.message}\n`);
}

// Test 3: Block
const code3 = "[FUNC add :params [x y] :body (+ x y)]";
console.log(`Input: ${code3}`);
try {
  const tokens = lex(code3);
  console.log(`Tokens: ${tokens.length}`);

  const ast = parse(tokens);
  console.log(`AST length: ${ast.length}`);
  console.log(`AST[0].kind: ${ast[0]?.kind}\n`);
} catch (e: any) {
  console.error(`❌ Error: ${e.message}\n`);
}
