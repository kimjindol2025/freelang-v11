// Phase 6: Parser Validation Tests
// Verify MODULE, IMPORT, OPEN parsing with new lexer output

import { lex } from "./lexer";
import { parse } from "./parser";

console.log("🔍 Phase 6: Parser Validation\n");

// ============================================================
// TEST 1: MODULE Block Parsing
// ============================================================

console.log("=".repeat(60));
console.log("TEST 1: MODULE Block Parsing");
console.log("=".repeat(60));

const moduleCode = `[MODULE math
  :exports [add subtract]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]`;

console.log("Input:");
console.log(moduleCode);
console.log("\nParsing...");

try {
  const tokens = lex(moduleCode);
  const ast = parse(tokens);

  if (ast.length > 0) {
    const block = ast[0] as any;
    console.log(`✅ Parsed successfully: ${JSON.stringify(block, null, 2).substring(0, 200)}...`);

    if (block.type === "MODULE") {
      console.log("✅ Block type: MODULE");
    } else {
      console.log(`❌ Block type: ${block.type} (expected MODULE)`);
    }

    if (block.name === "math") {
      console.log("✅ Module name: math");
    } else {
      console.log(`❌ Module name: ${block.name} (expected math)`);
    }

    // Check for exports field
    const exportsField = block.fields?.get("exports");
    if (exportsField) {
      console.log("✅ Exports field present");
    } else {
      console.log("❌ Exports field missing");
    }
  } else {
    console.log("❌ No AST generated");
  }
} catch (e: any) {
  console.log(`❌ Parser error: ${e.message}\n`);
}

// ============================================================
// TEST 2: IMPORT Expression Parsing
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 2: IMPORT Expression Parsing");
console.log("=".repeat(60));

const importCode = `(import math :from "./math.fl" :as m)`;

console.log("Input: (import math :from \"./math.fl\" :as m)");
console.log("\nParsing...");

try {
  const tokens = lex(importCode);
  const ast = parse(tokens);

  if (ast.length > 0) {
    const node = ast[0] as any;
    console.log(`✅ Parsed successfully`);

    if ((node as any).kind === "import") {
      console.log("✅ Node kind: import");
      console.log(`   moduleName: ${(node as any).moduleName}`);
      console.log(`   source: ${(node as any).source}`);
      console.log(`   alias: ${(node as any).alias}`);
    } else {
      console.log(`❌ Node kind: ${(node as any).kind} (expected import)`);
    }
  } else {
    console.log("❌ No AST generated");
  }
} catch (e: any) {
  console.log(`❌ Parser error: ${e.message}\n`);
}

// ============================================================
// TEST 3: OPEN Expression Parsing
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 3: OPEN Expression Parsing");
console.log("=".repeat(60));

const openCode = `(open math :from "./math.fl")`;

console.log("Input: (open math :from \"./math.fl\")");
console.log("\nParsing...");

try {
  const tokens = lex(openCode);
  const ast = parse(tokens);

  if (ast.length > 0) {
    const node = ast[0] as any;
    console.log(`✅ Parsed successfully`);

    if ((node as any).kind === "open") {
      console.log("✅ Node kind: open");
      console.log(`   moduleName: ${(node as any).moduleName}`);
      console.log(`   source: ${(node as any).source}`);
    } else {
      console.log(`❌ Node kind: ${(node as any).kind} (expected open)`);
    }
  } else {
    console.log("❌ No AST generated");
  }
} catch (e: any) {
  console.log(`❌ Parser error: ${e.message}\n`);
}

// ============================================================
// TEST 4: Qualified Identifier Parsing
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 4: Qualified Identifier Parsing");
console.log("=".repeat(60));

const qualifiedCode = `(import utils:string:format :as fmt)`;

console.log("Input: (import utils:string:format :as fmt)");
console.log("\nParsing...");

try {
  const tokens = lex(qualifiedCode);
  const ast = parse(tokens);

  if (ast.length > 0) {
    const node = ast[0] as any;
    console.log(`✅ Parsed successfully`);

    if ((node as any).kind === "import") {
      console.log("✅ Node kind: import");
      console.log(`   moduleName: ${(node as any).moduleName}`);

      if ((node as any).moduleName === "utils:string:format") {
        console.log("✅ Qualified identifier parsed correctly");
      } else {
        console.log(`❌ Qualified identifier: ${(node as any).moduleName}`);
      }
    } else {
      console.log(`❌ Node kind: ${(node as any).kind} (expected import)`);
    }
  } else {
    console.log("❌ No AST generated");
  }
} catch (e: any) {
  console.log(`❌ Parser error: ${e.message}\n`);
}

// ============================================================
// TEST 5: Phase 5 Backward Compatibility
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 5: Phase 5 Backward Compatibility");
console.log("=".repeat(60));

const phase5Code = `[FUNC add :params [$a $b] :body (+ $a $b)]`;

console.log("Input: [FUNC add :params [$a $b] :body (+ $a $b)]");
console.log("\nParsing...");

try {
  const tokens = lex(phase5Code);
  const ast = parse(tokens);

  if (ast.length > 0) {
    const block = ast[0] as any;
    console.log(`✅ Parsed successfully`);

    if (block.type === "FUNC" && block.name === "add") {
      console.log("✅ FUNC block parsed correctly");
      console.log("✅ Phase 5 backward compatibility MAINTAINED");
    } else {
      console.log(`❌ Expected FUNC block, got ${block.type}`);
    }
  } else {
    console.log("❌ No AST generated");
  }
} catch (e: any) {
  console.log(`❌ Parser error: ${e.message}\n`);
}

// ============================================================
// SUMMARY
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("📋 PHASE 6 PARSER VALIDATION SUMMARY");
console.log("=".repeat(60));

console.log("\n✅ Tests Completed:");
console.log("   1. MODULE block parsing");
console.log("   2. IMPORT expression parsing");
console.log("   3. OPEN expression parsing");
console.log("   4. Qualified identifier (a:b:c) parsing");
console.log("   5. Phase 5 backward compatibility");

console.log("\n🎯 Next: Interpreter integration (Phase 6 Step 4)\n");
