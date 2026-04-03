// FreeLang v9: Parser Test
// Token[] → AST 검증

import * as fs from "fs";
import { lex } from "./lexer";
import { parse } from "./parser";

console.log("📝 FreeLang v9 Parser Test\n");
console.log("═══════════════════════════════════\n");

// Test 1: Simplest block
console.log("Test 1: Simplest block");
console.log("───────────────────────────────────");
try {
  const code1 = `[TEST simple]`;
  const tokens1 = lex(code1);
  console.log(`✅ Tokens generated: ${tokens1.length}`);
  tokens1.forEach((t, i) => {
    console.log(`  ${i}: ${t.type} = "${t.value}"`);
  });

  console.log(`Parsing...`);
  const ast1 = parse(tokens1);

  console.log(`✅ Parsed ${ast1.length} blocks:`);
  ast1.forEach((block) => {
    console.log(`  [${block.type} ${block.name}]`);
  });
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
  console.error("Stack:", (error as Error).stack?.split('\n').slice(0, 5).join('\n'));
}

console.log("\n");

// Test 2: Parse simple-intent.fl
console.log("Test 2: simple-intent.fl");
console.log("───────────────────────────────────");
try {
  const code2 = fs.readFileSync("./examples/simple-intent.fl", "utf-8");
  const tokens2 = lex(code2);
  const ast2 = parse(tokens2);

  console.log(`✅ Parsed ${ast2.length} blocks:`);
  ast2.forEach((block, i) => {
    console.log(`  ${i + 1}. [${block.type} ${block.name}]`);
  });
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 3: Simple block
console.log("Test 3: Simple block");
console.log("───────────────────────────────────");
try {
  const code3 = `
    [FUNC test-func
      :params [$x $y]
      :body (+ $x $y)
    ]
  `;
  const tokens3 = lex(code3);
  const ast3 = parse(tokens3);

  console.log(`✅ Parsed 1 block:`);
  const block = ast3[0];
  console.log(`  Type: ${block.type}`);
  console.log(`  Name: ${block.name}`);
  console.log(`  Fields: ${Array.from(block.fields.keys()).join(", ")}`);
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 4: Nested S-expressions
console.log("Test 4: Nested S-expressions");
console.log("───────────────────────────────────");
try {
  const code4 = `
    [INTENT calc
      :result (+ (* $price $tax) $base)
    ]
  `;
  const tokens4 = lex(code4);
  const ast4 = parse(tokens4);

  console.log(`✅ Parsed nested S-expressions`);
  const block = ast4[0];
  const resultField = block.fields.get(":result");
  if (resultField && (resultField as any).kind === "sexpr") {
    console.log(`  Outer op: ${(resultField as any).op}`);
    console.log(`  Args: ${(resultField as any).args.length}`);
  }
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 5: Arrays
console.log("Test 5: Arrays");
console.log("───────────────────────────────────");
try {
  const code5 = `
    [DATA items
      :values [1 2 3 4 5]
    ]
  `;
  const tokens5 = lex(code5);
  const ast5 = parse(tokens5);

  console.log(`✅ Parsed array`);
  const block = ast5[0];
  const valuesField = block.fields.get(":values");
  if (valuesField && (valuesField as any).kind === "block" && (valuesField as any).type === "Array") {
    const items = (valuesField as any).fields.get("items");
    console.log(`  Array items: ${Array.isArray(items) ? items.length : 1}`);
  }
} catch (error) {
  console.error("❌ Error:", (error as Error).message);
}

console.log("\n");

// Test 6: Error handling
console.log("Test 6: Error handling");
console.log("───────────────────────────────────");
try {
  const badCode = `[BLOCK name :key]`; // Missing closing bracket
  const tokens6 = lex(badCode);
  const ast6 = parse(tokens6);
  console.log("❌ Should have thrown error");
} catch (error) {
  console.log(`✅ Caught error: ${(error as Error).message}`);
}

console.log("\n═══════════════════════════════════");
console.log("✅ Parser tests complete!\n");
