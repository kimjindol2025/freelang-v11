"use strict";
// FreeLang v9: HTTP Server Runner
// Full pipeline: v9 code → Lexer → Parser → Interpreter → Express server
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
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("fs"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
async function runServer() {
    try {
        // Step 1: Load v9 source code
        console.log("📖 Loading v9 source code...\n");
        const sourceFile = process.argv[2] || "./examples/api-server.fl";
        if (!fs.existsSync(sourceFile)) {
            throw new Error(`Source file not found: ${sourceFile}`);
        }
        const sourceCode = fs.readFileSync(sourceFile, "utf-8");
        console.log(`✅ Loaded ${sourceFile}`);
        console.log(`   Lines: ${sourceCode.split("\n").length}`);
        // Step 2: Lexical analysis
        console.log("\n🔤 Lexical analysis...");
        const tokens = (0, lexer_1.lex)(sourceCode);
        console.log(`✅ Generated ${tokens.length} tokens`);
        console.log(`   Token types: Symbol, Keyword, Number, String, Variable, Bracket, Paren`);
        // Step 3: Parsing
        console.log("\n📝 Parsing...");
        const ast = (0, parser_1.parse)(tokens);
        console.log(`✅ Generated AST with ${ast.length} top-level blocks`);
        ast.forEach((node, i) => {
            // Phase 6: Handle both Block and other ASTNode types
            const block = node;
            if (block.type && block.name) {
                console.log(`   ${i + 1}. [${block.type} ${block.name}] - ${block.fields?.size || 0} fields`);
            }
            else if (block.kind === "import") {
                console.log(`   ${i + 1}. [import ${block.moduleName}]`);
            }
            else if (block.kind === "open") {
                console.log(`   ${i + 1}. [open ${block.moduleName}]`);
            }
            else if (block.kind === "module") {
                console.log(`   ${i + 1}. [module ${block.name}]`);
            }
            else {
                console.log(`   ${i + 1}. [${block.kind || "?"}]`);
            }
        });
        // Step 4: Interpretation
        console.log("\n⚙️ Interpreting...");
        const app = (0, express_1.default)();
        const context = (0, interpreter_1.interpret)(ast, app);
        console.log(`✅ Interpreted successfully`);
        console.log(`   Functions defined: ${context.functions.size}`);
        console.log(`   Intents defined: ${context.intents.size}`);
        console.log(`   Routes registered: ${context.routes.size}`);
        // Step 5: Display route details
        if (context.routes.size > 0) {
            console.log(`\n📍 Registered routes:`);
            for (const [name, route] of context.routes) {
                console.log(`   [${name}] ${route.method.toUpperCase()} ${route.path}`);
            }
        }
        // Step 6: Start server
        console.log("\n🚀 Starting Express server...\n");
        const PORT = parseInt(process.env.PORT ?? "3009", 10);
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`\n📚 Available endpoints:`);
            for (const [name, route] of context.routes) {
                console.log(`   ${route.method.toUpperCase()} http://localhost:${PORT}${route.path}`);
            }
            console.log(`\n💡 Example request:`);
            if (context.routes.size > 0) {
                const firstRoute = Array.from(context.routes.values())[0];
                console.log(`   curl http://localhost:${PORT}${firstRoute.path}`);
            }
            console.log(`\n📌 Press Ctrl+C to stop the server\n`);
        });
        // Graceful shutdown
        process.on("SIGINT", () => {
            console.log("\n\n👋 Shutting down server...");
            server.close(() => {
                console.log("✅ Server closed");
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error("❌ Error:", error.message);
        console.error("Stack:", error.stack?.split("\n").slice(0, 5).join("\n"));
        process.exit(1);
    }
}
// Run the server
runServer();
//# sourceMappingURL=http-server-runner.js.map