// FreeLang v9: HTTP Server Runner
// Full pipeline: v9 code → Lexer → Parser → Interpreter → Express server

import express from "express";
import * as fs from "fs";
import { lex } from "./lexer";
import { parse } from "./parser";
import { interpret } from "./interpreter";

async function runServer(): Promise<void> {
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
    const tokens = lex(sourceCode);
    console.log(`✅ Generated ${tokens.length} tokens`);
    console.log(`   Token types: Symbol, Keyword, Number, String, Variable, Bracket, Paren`);

    // Step 3: Parsing
    console.log("\n📝 Parsing...");
    const ast = parse(tokens);
    console.log(`✅ Generated AST with ${ast.length} top-level blocks`);
    ast.forEach((node, i) => {
      // Phase 6: Handle both Block and other ASTNode types
      const block = node as any;
      if (block.type && block.name) {
        console.log(`   ${i + 1}. [${block.type} ${block.name}] - ${block.fields?.size || 0} fields`);
      } else if (block.kind === "import") {
        console.log(`   ${i + 1}. [import ${block.moduleName}]`);
      } else if (block.kind === "open") {
        console.log(`   ${i + 1}. [open ${block.moduleName}]`);
      } else if (block.kind === "module") {
        console.log(`   ${i + 1}. [module ${block.name}]`);
      } else {
        console.log(`   ${i + 1}. [${block.kind || "?"}]`);
      }
    });

    // Step 4: Interpretation
    console.log("\n⚙️ Interpreting...");
    const app = express();
    const context = interpret(ast, app);
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
    const PORT = 3009;
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
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    console.error("Stack:", (error as Error).stack?.split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
}

// Run the server
runServer();
