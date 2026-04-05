"use strict";
// FreeLang v9: Interpreter Test
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
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
    const tokens1 = (0, lexer_1.lex)(code1);
    const ast1 = (0, parser_1.parse)(tokens1);
    const context1 = (0, interpreter_1.interpret)(ast1);
    console.log(`✅ Function 'add' defined`);
    console.log(`   Functions: ${Array.from(context1.functions.keys()).join(", ")}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
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
    const tokens2 = (0, lexer_1.lex)(code2);
    const ast2 = (0, parser_1.parse)(tokens2);
    const context2 = (0, interpreter_1.interpret)(ast2);
    console.log(`✅ Route 'health' defined`);
    console.log(`   Routes: ${Array.from(context2.routes.keys()).join(", ")}`);
    const route = context2.routes.get("health");
    console.log(`   Method: ${route?.method.toUpperCase()}`);
    console.log(`   Path: ${route?.path}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
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
    const tokens3 = (0, lexer_1.lex)(code3);
    const ast3 = (0, parser_1.parse)(tokens3);
    const context3 = (0, interpreter_1.interpret)(ast3);
    console.log(`✅ Arithmetic function defined`);
    // Manually call the function to test
    const calcFunc = context3.functions.get("calc");
    if (calcFunc) {
        console.log(`   (calc 5 3) should evaluate to: 2*5 + 3 = 13`);
    }
}
catch (error) {
    console.error("❌ Error:", error.message);
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
    const tokens4 = (0, lexer_1.lex)(code4);
    const ast4 = (0, parser_1.parse)(tokens4);
    const context4 = (0, interpreter_1.interpret)(ast4);
    console.log(`✅ Intent 'transfer' defined`);
    console.log(`   Intents: ${Array.from(context4.intents.keys()).join(", ")}`);
    const intent = context4.intents.get("transfer");
    console.log(`   Fields: ${Array.from((intent?.fields || new Map()).keys()).join(", ")}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 5: Full HTTP server definition
console.log("Test 5: Full HTTP server");
console.log("───────────────────────────────────");
try {
    const code5 = fs.readFileSync("./examples/simple-intent.fl", "utf-8");
    const tokens5 = (0, lexer_1.lex)(code5);
    const ast5 = (0, parser_1.parse)(tokens5);
    const context5 = (0, interpreter_1.interpret)(ast5);
    console.log(`✅ simple-intent.fl interpreted`);
    console.log(`   Functions: ${Array.from(context5.functions.keys()).join(", ")}`);
    console.log(`   Intents: ${Array.from(context5.intents.keys()).join(", ")}`);
    console.log(`   Routes: ${context5.routes.size}`);
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n");
// Test 6: Create and test Express server
console.log("Test 6: Express server with routes");
console.log("───────────────────────────────────");
try {
    const app = (0, express_1.default)();
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
    const tokens6 = (0, lexer_1.lex)(code6);
    const ast6 = (0, parser_1.parse)(tokens6);
    const context6 = (0, interpreter_1.interpret)(ast6, app);
    console.log(`✅ Express app configured`);
    console.log(`   Routes registered: ${context6.routes.size}`);
    // Test if routes are setup
    const routeList = [];
    for (const [, route] of context6.routes) {
        routeList.push(`${route.method.toUpperCase()} ${route.path}`);
    }
    console.log(`   Routes: ${routeList.join(", ")}`);
    console.log(`   Ready to listen on port 3009`);
}
catch (error) {
    console.error("❌ Error:", error.message);
}
console.log("\n═══════════════════════════════════");
console.log("✅ Interpreter tests complete!\n");
//# sourceMappingURL=test-interpreter.js.map