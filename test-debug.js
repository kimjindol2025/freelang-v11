const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");
const { interpret } = require("./dist/interpreter");
const express = require("express");

const code = `
(define test1 (fn [$x]
  (match $x
    ((1|2|3) "small")
    ((_) "other"))))

(test1 2)
`;

const tokens = lex(code);
console.log("=== TOKENS ===");
tokens.filter(t => t.type !== 'EOF').forEach((t, i) => {
  console.log(`${i}: ${t.type}=${JSON.stringify(t.value)}`);
});

const ast = parse(tokens);
console.log("\n=== AST (first 1500 chars) ===");
console.log(JSON.stringify(ast, null, 2).slice(0, 1500));

const context = interpret(ast, express());
console.log("\n=== RESULT ===");
console.log("lastValue:", context.lastValue);
