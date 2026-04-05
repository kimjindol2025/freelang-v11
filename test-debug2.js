const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");
const { interpret } = require("./dist/interpreter");
const express = require("express");

// Test simple literal match without or-pattern first
const code1 = `
(match 2
  (1 "one")
  (2 "two")
  (3 "three"))
`;

console.log("=== Test 1: Simple literal match ===");
const tokens1 = lex(code1);
const ast1 = parse(tokens1);
const context1 = interpret(ast1, express());
console.log("Result:", context1.lastValue);

// Now test with or-pattern
const code2 = `
(match 2
  ((1|2|3) "matched"))
`;

console.log("\n=== Test 2: Or-pattern match ===");
const tokens2 = lex(code2);
const ast2 = parse(tokens2);
console.log("AST cases:", JSON.stringify(ast2[0].args[1].cases, null, 2));
const context2 = interpret(ast2, express());
console.log("Result:", context2.lastValue);
