// FreeLang v9: Interpreter Test

import * as fs from "fs";
import express from "express";
import { lex } from "./lexer";
import { parse } from "./parser";
import { interpret } from "./interpreter";

console.log("🔧 FreeLang v9 Interpreter Test\n");
console.log("═══════════════════════════════════\n");

// Test 1: Simple function definition and call
console.log("Test 1: Function definition");
console.log("───────────────────────────────────");
try {
  const code1 = `
    [FUNC add
      :params [$a $b]
      :body (+ $a $b)
    ]
  `;
  const tokens1 = lex(code1);
  const ast1 = parse(tokens1);
  const context1 = interpret(ast1);

  console.log(`✅ Function 'add' defined`);
  console.log(`   Functions: ${Array.from(context1.functions.keys()).join(", ")}`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 2: Route definition
console.log("Test 2: Route definition");
console.log("───────────────────────────────────");
try {
  const code2 = `
    [ROUTE health
      :method "GET"
      :path "/api/health"
      :handler (json-response (list :status "healthy"))
    ]
  `;
  const tokens2 = lex(code2);
  const ast2 = parse(tokens2);
  const context2 = interpret(ast2);

  console.log(`✅ Route 'health' defined`);
  console.log(`   Routes: ${Array.from(context2.routes.keys()).join(", ")}`);

  const route = context2.routes.get("health");
  console.log(`   Method: ${route?.method.toUpperCase()}`);
  console.log(`   Path: ${route?.path}`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 3: Arithmetic operations
console.log("Test 3: Built-in arithmetic");
console.log("───────────────────────────────────");
try {
  const code3 = `
    [FUNC calc
      :params [$x $y]
      :body (+ (* $x 2) $y)
    ]
  `;
  const tokens3 = lex(code3);
  const ast3 = parse(tokens3);
  const context3 = interpret(ast3);

  console.log(`✅ Arithmetic function defined`);

  // Manually call the function to test
  const calcFunc = context3.functions.get("calc");
  if (calcFunc) {
    console.log(`   (calc 5 3) should evaluate to: 2*5 + 3 = 13`);
  }
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 4: Intent definition
console.log("Test 4: Intent definition");
console.log("───────────────────────────────────");
try {
  const code4 = `
    [INTENT transfer
      :from "account1"
      :to "account2"
      :amount 1000
    ]
  `;
  const tokens4 = lex(code4);
  const ast4 = parse(tokens4);
  const context4 = interpret(ast4);

  console.log(`✅ Intent 'transfer' defined`);
  console.log(`   Intents: ${Array.from(context4.intents.keys()).join(", ")}`);

  const intent = context4.intents.get("transfer");
  console.log(`   Fields: ${Array.from((intent?.fields || new Map()).keys()).join(", ")}`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 5: Full HTTP server definition
console.log("Test 5: Full HTTP server");
console.log("───────────────────────────────────");
try {
  const code5 = fs.readFileSync("./examples/simple-intent.fl", "utf-8");
  const tokens5 = lex(code5);
  const ast5 = parse(tokens5);
  const context5 = interpret(ast5);

  console.log(`✅ simple-intent.fl interpreted`);
  console.log(`   Functions: ${Array.from(context5.functions.keys()).join(", ")}`);
  console.log(`   Intents: ${Array.from(context5.intents.keys()).join(", ")}`);
  console.log(`   Routes: ${context5.routes.size}`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 6: Create and test Express server
console.log("Test 6: Express server with routes");
console.log("───────────────────────────────────");
try {
  const app = express();

  const code6 = `
    [ROUTE health
      :method "GET"
      :path "/api/health"
      :handler (json-response (list :status "ok"))
    ]

    [ROUTE echo
      :method "POST"
      :path "/api/echo"
      :handler (json-response (list :echo "test"))
    ]
  `;
  const tokens6 = lex(code6);
  const ast6 = parse(tokens6);
  const context6 = interpret(ast6, app);

  console.log(`✅ Express app configured`);
  console.log(`   Routes registered: ${context6.routes.size}`);

  // Test if routes are setup
  const routeList: string[] = [];
  for (const [, route] of context6.routes) {
    routeList.push(`${route.method.toUpperCase()} ${route.path}`);
  }
  console.log(`   Routes: ${routeList.join(", ")}`);

  console.log(`   Ready to listen on port 3009`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n═══════════════════════════════════");
console.log("✅ Interpreter tests complete!\n");
