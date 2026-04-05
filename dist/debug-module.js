"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const code = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]`;
const tokens = (0, lexer_1.lex)(code);
const ast = (0, parser_1.parse)(tokens);
console.log("AST[0]:", JSON.stringify(ast[0], null, 2));
//# sourceMappingURL=debug-module.js.map