"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const code = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]`;
console.log("Tokens:");
const tokens = (0, lexer_1.lex)(code);
tokens.forEach((t, i) => {
    console.log(`  ${i}: ${t.type} = "${t.value}"`);
});
console.log("\nAST:");
const ast = (0, parser_1.parse)(tokens);
const node = ast[0];
console.log("  kind:", node.kind);
console.log("  type:", node.type);
console.log("  name:", node.name);
console.log("  exports:", node.exports);
console.log("  body length:", node.body ? node.body.length : 0);
console.log("  body:", node.body);
console.log("\nInterpreting...");
const interp = new interpreter_1.Interpreter();
const ctx = interp.interpret(ast);
console.log("Modules:", Array.from(ctx.modules?.entries() || []));
//# sourceMappingURL=debug-parse-fields.js.map