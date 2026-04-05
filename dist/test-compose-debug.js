"use strict";
// Debug compose with let binding
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
console.log("🔍 Debugging Compose with Let Binding\n");
const code = `
[FUNC double :params [$x] :body (* $x 2)]
[FUNC add-one :params [$x] :body (+ $x 1)]
(let [f (compose double add-one)]
  (f 5))
`;
const interp = new interpreter_1.Interpreter();
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("✅ AST parsed successfully");
console.log(`   Nodes: ${ast.length}`);
// Interpret all nodes (register functions)
try {
    interp.interpret(ast);
    console.log("✅ Functions registered");
}
catch (e) {
    console.log(`❌ Error during interpret: ${e.message}`);
    process.exit(1);
}
// Find the let expression (last non-block node)
let letExpr = null;
for (const node of ast) {
    if (node.kind === "sexpr" && node.op === "let") {
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
    const result = interp.eval(letExpr);
    console.log(`✅ Result: ${result}`);
    console.log(`   Expected: 12`);
    console.log(`   Match: ${result === 12 ? "✅" : "❌"}`);
}
catch (e) {
    console.log(`❌ Error during evaluation: ${e.message}`);
    console.log(`   Stack: ${e.stack?.split("\n").slice(0, 5).join("\n")}`);
}
//# sourceMappingURL=test-compose-debug.js.map