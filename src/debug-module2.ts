import { lex } from "./lexer";
import { parse } from "./parser";

const code = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]`;

const tokens = lex(code);
const ast = parse(tokens);

console.log("AST[0]:", JSON.stringify(ast[0], null, 2));
