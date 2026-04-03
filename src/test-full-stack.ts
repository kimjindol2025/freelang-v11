// FreeLang v9: Full Stack Integration Test
// Complete end-to-end test: v9 code → Lexer → Parser → Interpreter → Express → HTTP requests

import express from "express";
import * as fs from "fs";
import http from "http";
import { lex } from "./lexer";
import { parse } from "./parser";
import { interpret } from "./interpreter";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}: ${message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeRequest(
  method: string,
  path: string,
  port: number
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port,
      path,
      method,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 500,
          body: data,
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function runFullStackTest(): Promise<void> {
  console.log("🚀 FreeLang v9 Full Stack Integration Test\n");
  console.log("═══════════════════════════════════════════\n");

  let server: any;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Phase 1: Load and validate source code
    console.log("Phase 1: Load Source Code");
    console.log("─────────────────────────");
    const sourceFile = "./examples/api-server.fl";
    let sourceCode: string;

    try {
      sourceCode = fs.readFileSync(sourceFile, "utf-8");
      addResult("Load file", true, `Loaded ${sourceFile} (${sourceCode.length} bytes)`);
      testsPassed++;
    } catch (error) {
      addResult("Load file", false, `Failed to load ${sourceFile}`);
      testsFailed++;
      return;
    }

    // Phase 2: Lexical analysis
    console.log("\nPhase 2: Lexical Analysis");
    console.log("────────────────────────");
    try {
      const tokens = lex(sourceCode);
      addResult("Tokenization", true, `Generated ${tokens.length} tokens`);
      testsPassed++;
    } catch (error) {
      addResult("Tokenization", false, (error as Error).message);
      testsFailed++;
      return;
    }

    const tokens = lex(sourceCode);

    // Phase 3: Parsing
    console.log("\nPhase 3: Parsing");
    console.log("────────────────");
    let ast;
    try {
      ast = parse(tokens);
      addResult("Parsing", true, `Generated ${ast.length} blocks`);
      testsPassed++;
    } catch (error) {
      addResult("Parsing", false, (error as Error).message);
      testsFailed++;
      return;
    }

    // Phase 4: Interpretation
    console.log("\nPhase 4: Interpretation");
    console.log("──────────────────────");
    let app: express.Express;
    try {
      app = express();
      const context = interpret(ast, app);

      addResult("Interpretation", true, `Context created`);
      testsPassed++;

      addResult("Functions", context.functions.size > 0, `${context.functions.size} function(s) defined`);
      testsPassed++;

      addResult(
        "Routes",
        context.routes.size > 0,
        `${context.routes.size} route(s) registered`
      );
      testsPassed++;
    } catch (error) {
      addResult("Interpretation", false, (error as Error).message);
      testsFailed++;
      return;
    }

    // Phase 5: Server startup
    console.log("\nPhase 5: Server Startup");
    console.log("──────────────────────");
    const PORT = 3010; // Use different port to avoid conflicts

    try {
      server = app.listen(PORT);
      await sleep(500); // Wait for server to start

      addResult("Server startup", true, `Listening on port ${PORT}`);
      testsPassed++;
    } catch (error) {
      addResult("Server startup", false, (error as Error).message);
      testsFailed++;
      return;
    }

    // Phase 6: HTTP integration tests
    console.log("\nPhase 6: HTTP Integration Tests");
    console.log("───────────────────────────────");

    // Test 6.1: Health check
    try {
      const response = await makeRequest("GET", "/api/health", PORT);
      const isSuccess = response.statusCode === 200;
      addResult("GET /api/health", isSuccess, `Status ${response.statusCode}`);
      isSuccess ? testsPassed++ : testsFailed++;

      if (isSuccess) {
        try {
          const data = JSON.parse(response.body);
          addResult("Health response", data.status === "ok", `Status: ${data.status}`);
          data.status === "ok" ? testsPassed++ : testsFailed++;
        } catch {
          addResult("Health response", false, "Invalid JSON");
          testsFailed++;
        }
      }
    } catch (error) {
      addResult("GET /api/health", false, (error as Error).message);
      testsFailed++;
    }

    // Test 6.2: Math endpoint
    try {
      const response = await makeRequest("GET", "/api/math/sum", PORT);
      const isSuccess = response.statusCode === 200;
      addResult("GET /api/math/sum", isSuccess, `Status ${response.statusCode}`);
      isSuccess ? testsPassed++ : testsFailed++;

      if (isSuccess) {
        try {
          const data = JSON.parse(response.body);
          addResult("Math response", data.sum === 30, `Sum: ${data.sum}`);
          data.sum === 30 ? testsPassed++ : testsFailed++;
        } catch {
          addResult("Math response", false, "Invalid JSON");
          testsFailed++;
        }
      }
    } catch (error) {
      addResult("GET /api/math/sum", false, (error as Error).message);
      testsFailed++;
    }

    // Test 6.3: Greet endpoint
    try {
      const response = await makeRequest("POST", "/api/greet", PORT);
      const isSuccess = response.statusCode === 200;
      addResult("POST /api/greet", isSuccess, `Status ${response.statusCode}`);
      isSuccess ? testsPassed++ : testsFailed++;

      if (isSuccess) {
        try {
          const data = JSON.parse(response.body);
          addResult(
            "Greet response",
            data.greeting === "Hello, World!",
            `Greeting: ${data.greeting}`
          );
          data.greeting === "Hello, World!" ? testsPassed++ : testsFailed++;
        } catch {
          addResult("Greet response", false, "Invalid JSON");
          testsFailed++;
        }
      }
    } catch (error) {
      addResult("POST /api/greet", false, (error as Error).message);
      testsFailed++;
    }

    // Final summary
    console.log("\n═══════════════════════════════════════════");
    console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);

    if (testsFailed === 0) {
      console.log("✅ All tests passed! FreeLang v9 is fully functional.\n");
      console.log("🎉 Pipeline Summary:");
      console.log("   v9 Code → Lexer → Parser → Interpreter → Express → HTTP ✅\n");
    } else {
      console.log(`⚠️ ${testsFailed} test(s) failed.\n`);
    }
  } finally {
    // Cleanup
    if (server) {
      server.close();
    }
  }
}

// Run the test
runFullStackTest().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
