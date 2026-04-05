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
const ast = parse(tokens);
console.log("=== AST Nodes ===");
console.log("Number of nodes:", ast.length);
ast.forEach((node, i) => {
  console.log(`Node ${i}:`, node.kind);
});

const context = interpret(ast, express());
console.log("\n=== Context ===");
console.log("Functions:", Array.from(context.functions.keys()));
console.log("LastValue:", context.lastValue);
