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
try {
  const tokens1 = lex(code1);
  const ast1 = parse(tokens1);
  console.log("AST:", JSON.stringify(ast1, null, 2).slice(0, 1000));
  const context1 = interpret(ast1, express());
  console.log("Result:", context1.lastValue);
} catch(e) {
  console.log("ERROR:", e.message);
  console.log("Stack:", e.stack.slice(0, 500));
}
