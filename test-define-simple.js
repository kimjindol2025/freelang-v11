const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");
const { interpret } = require("./dist/interpreter");
const express = require("express");

const code = `
(define test1 (fn [$x] $x))
(test1 2)
`;

const tokens = lex(code);
const ast = parse(tokens);

// Try to interpret without creating a type checker
const context = {
  functions: new Map(),
  routes: new Map(),
  intents: new Map(),
  variables: new Map(),
  app: express(),
  middleware: [],
  errorHandlers: { handlers: new Map() },
  startTime: Date.now(),
};

// Manual interpretation to avoid type checker
const interpreter = require("./dist/interpreter").Interpreter;
const inst = new interpreter(express());

for (const node of ast) {
  console.log("Evaluating node:", node.kind);
  const result = inst.eval(node);
  console.log("Result:", result);
  console.log("Functions in context:", Array.from(inst.getContext().functions.keys()));
}

console.log("\nFinal context functions:", Array.from(inst.getContext().functions.keys()));
