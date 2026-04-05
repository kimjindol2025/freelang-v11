"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const code = `
(let [x 5]
  (+ $x 10))
`;
const interp = new interpreter_1.Interpreter();
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("AST:", JSON.stringify(ast, null, 2).substring(0, 300));
try {
    interp.interpret(ast);
    // Get the result by evaluating the last node
    let result;
    for (const node of ast) {
        if (node.kind !== "block") {
            result = interp.eval(node);
        }
    }
    console.log("Result:", result);
}
catch (e) {
    console.log("Error:", e.message);
    console.log("Stack:", e.stack?.split("\n").slice(0, 5).join("\n"));
}
//# sourceMappingURL=test-let-simple.js.map