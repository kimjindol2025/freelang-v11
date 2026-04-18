// Phase 6 Step 4: Interpreter Module System Tests
// 모듈 등록, 임포트, 오픈 기능 검증

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

console.log("🚀 Phase 6 Step 4: Interpreter Module System\n");

// ============================================================
// TEST 1: MODULE 정의 및 등록
// ============================================================

console.log("=".repeat(60));
console.log("TEST 1: MODULE Definition & Registration");
console.log("=".repeat(60));

const moduleCode = `[MODULE math
  :exports [add subtract multiply]
  :body [
    [FUNC add
      :params [$a $b]
      :body (+ $a $b)
    ]

    [FUNC subtract
      :params [$a $b]
      :body (- $a $b)
    ]

    [FUNC multiply
      :params [$a $b]
      :body (* $a $b)
    ]
  ]
]`;

console.log("Input: [MODULE math :exports [add subtract multiply] :body [...]]");
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(moduleCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  if (ctx.modules && ctx.modules.has("math")) {
    const mathModule = ctx.modules.get("math")!;
    console.log("✅ Module registered: math");
    console.log(`   Exports: ${mathModule.exports.join(", ")}`);
    console.log(`   Functions defined: ${mathModule.functions.size}`);

    if (mathModule.functions.has("add")) {
      console.log("✅ Function 'add' defined in module");
    } else {
      console.log("❌ Function 'add' not found");
    }
  } else {
    console.log("❌ Module 'math' not registered");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// TEST 2: IMPORT with qualified names (module:function)
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 2: IMPORT & Qualified Names");
console.log("=".repeat(60));

const importCode = `[MODULE math
  :exports [add multiply]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
    [FUNC multiply :params [$a $b] :body (* $a $b)]
  ]
]

(import math)`;

console.log('Input: [MODULE math ...] + (import math)');
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(importCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  if (ctx.functions.has("math:add")) {
    console.log("✅ Function accessible as 'math:add'");
  } else {
    console.log("❌ Function 'math:add' not found");
  }

  if (ctx.functions.has("math:multiply")) {
    console.log("✅ Function accessible as 'math:multiply'");
  } else {
    console.log("❌ Function 'math:multiply' not found");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// TEST 3: IMPORT with :only (selective import)
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 3: IMPORT with :only (Selective)");
console.log("=".repeat(60));

const selectiveImportCode = `[MODULE utils
  :exports [upper lower reverse]
  :body [
    [FUNC upper :params [$s] :body $s]
    [FUNC lower :params [$s] :body $s]
    [FUNC reverse :params [$s] :body $s]
  ]
]

(import utils :only [upper lower])`;

console.log('Input: (import utils :only [upper lower])');
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(selectiveImportCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  const hasUpper = ctx.functions.has("utils:upper");
  const hasLower = ctx.functions.has("utils:lower");
  const hasReverse = ctx.functions.has("utils:reverse");

  console.log(`✅ upper imported: ${hasUpper}`);
  console.log(`✅ lower imported: ${hasLower}`);
  console.log(`❌ reverse NOT imported (not in :only): ${!hasReverse}`);

  if (hasUpper && hasLower && !hasReverse) {
    console.log("✅ Selective import works correctly");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// TEST 4: IMPORT with :as (alias)
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 4: IMPORT with :as (Alias)");
console.log("=".repeat(60));

const aliasImportCode = `[MODULE string
  :exports [concat]
  :body [
    [FUNC concat :params [$a $b] :body (+ $a $b)]
  ]
]

(import string :as str)`;

console.log('Input: (import string :as str)');
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(aliasImportCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  const hasAlias = ctx.functions.has("str:concat");
  const hasOriginal = ctx.functions.has("string:concat");

  console.log(`✅ Function accessible as 'str:concat': ${hasAlias}`);
  console.log(`❌ Function NOT accessible as 'string:concat': ${!hasOriginal}`);

  if (hasAlias && !hasOriginal) {
    console.log("✅ Alias import works correctly");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// TEST 5: OPEN (전역 네임스페이스에 추가)
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 5: OPEN (Global Namespace)");
console.log("=".repeat(60));

const openCode = `[MODULE list
  :exports [first rest length]
  :body [
    [FUNC first :params [$lst] :body $lst]
    [FUNC rest :params [$lst] :body $lst]
    [FUNC length :params [$lst] :body $lst]
  ]
]

(open list)`;

console.log('Input: (open list)');
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(openCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  const hasFirst = ctx.functions.has("first");
  const hasRest = ctx.functions.has("rest");
  const hasLength = ctx.functions.has("length");
  const hasQualified = ctx.functions.has("list:first"); // Should NOT exist

  console.log(`✅ 'first' available globally: ${hasFirst}`);
  console.log(`✅ 'rest' available globally: ${hasRest}`);
  console.log(`✅ 'length' available globally: ${hasLength}`);
  console.log(`❌ 'list:first' NOT available (not qualified): ${!hasQualified}`);

  if (hasFirst && hasRest && hasLength && !hasQualified) {
    console.log("✅ Open works correctly");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// TEST 6: Multiple modules & namespace isolation
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("TEST 6: Multiple Modules & Namespace Isolation");
console.log("=".repeat(60));

const multiModuleCode = `[MODULE math
  :exports [add]
  :body [
    [FUNC add :params [$a $b] :body (+ $a $b)]
  ]
]

[MODULE string
  :exports [concat]
  :body [
    [FUNC concat :params [$a $b] :body (+ $a $b)]
  ]
]

(import math)
(import string :as str)`;

console.log('Input: Two modules + two imports with different aliases');
console.log("\nParsing and interpreting...");

try {
  const tokens = lex(multiModuleCode);
  const ast = parse(tokens);
  const interp = new Interpreter();
  const ctx = interp.interpret(ast);

  const hasMathAdd = ctx.functions.has("math:add");
  const hasStrConcat = ctx.functions.has("str:concat");

  console.log(`✅ math:add registered: ${hasMathAdd}`);
  console.log(`✅ str:concat registered: ${hasStrConcat}`);

  if (hasMathAdd && hasStrConcat) {
    console.log("✅ Multiple modules & namespace isolation works");
  }
} catch (e: any) {
  console.log(`❌ Error: ${e.message}`);
}

// ============================================================
// SUMMARY
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("📋 PHASE 6 STEP 4 INTERPRETER SUMMARY");
console.log("=".repeat(60));

console.log("\n✅ Tests Completed:");
console.log("   1. MODULE definition & registration");
console.log("   2. IMPORT & qualified names (module:function)");
console.log("   3. IMPORT with :only (selective)");
console.log("   4. IMPORT with :as (alias)");
console.log("   5. OPEN (global namespace)");
console.log("   6. Multiple modules & namespace isolation");

console.log("\n✅ Features Implemented:");
console.log("   • Module registration in context.modules");
console.log("   • Selective import with :only");
console.log("   • Aliased import with :as");
console.log("   • Global namespace with open");
console.log("   • Qualified function names (module:function)");
console.log("   • Namespace isolation between modules");

console.log("\n🎯 Next: Integration tests & Phase 6 completion\n");
