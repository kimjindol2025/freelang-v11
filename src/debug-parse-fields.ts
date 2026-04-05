import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

const code = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]`;

console.log("Tokens:");
const tokens = lex(code);
tokens.forEach((t, i) => {
  console.log(`  ${i}: ${t.type} = "${t.value}"`);
});

console.log("\nAST:");
const ast = parse(tokens);
const node = ast[0] as any;

console.log("  kind:", node.kind);
console.log("  type:", node.type);
console.log("  name:", node.name);
console.log("  exports:", node.exports);
console.log("  body length:", node.body ? node.body.length : 0);
console.log("  body:", node.body);

console.log("\nInterpreting...");
const interp = new Interpreter();
const ctx = interp.interpret(ast);

console.log("Modules:", Array.from(ctx.modules?.entries() || []));
