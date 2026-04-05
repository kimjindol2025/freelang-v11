// Debug compose with let binding

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🔍 Debugging Compose with Let Binding\n");

const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [f (compose double add-one)]
  (f 5))
`;

const interp = new Interpreter();
const tokens = lex(code);
const ast = parse(tokens);

console.log("✅ AST parsed successfully");
console.log(`   Nodes: ${ast.length}`);

// Interpret all nodes (register functions)
try {
  interp.interpret(ast);
  console.log("✅ Functions registered");
} catch (e: any) {
  console.log(`❌ Error during interpret: ${e.message}`);
  process.exit(1);
}

// Find the let expression (last non-block node)
let letExpr: any = null;
for (const node of ast) {
  if ((node as any).kind === "sexpr" && (node as any).op === "let") {
    letExpr = node;
    break;
  }
}

if (!letExpr) {
  console.log("❌ No let expression found");
  process.exit(1);
}

console.log("✅ Let expression found");
console.log(`   Args: ${letExpr.args.length}`);

// Evaluate the let expression
try {
  const result = (interp as any).eval(letExpr);
  console.log(`✅ Result: ${result}`);
  console.log(`   Expected: 12`);
  console.log(`   Match: ${result === 12 ? "✅" : "❌"}`);
} catch (e: any) {
  console.log(`❌ Error during evaluation: ${e.message}`);
  console.log(`   Stack: ${e.stack?.split("\n").slice(0, 5).join("\n")}`);
}
