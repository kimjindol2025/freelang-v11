const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");
const { interpret } = require("./dist/interpreter");
const express = require("express");

// Test with or-pattern
const code = `
(match 2
  ((1|2|3) "matched"))
`;

console.log("=== Test: Or-pattern match ===");
const tokens = lex(code);
const ast = parse(tokens);
const context = interpret(ast, express());
console.log("Result:", context.lastValue);
console.log("Expected: matched");
