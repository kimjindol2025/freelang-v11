const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");

const code = `(define test1 (fn [$x] $x))`;

const tokens = lex(code);
const ast = parse(tokens);
console.log("=== AST ===");
console.log(JSON.stringify(ast, null, 2).slice(0, 1000));
