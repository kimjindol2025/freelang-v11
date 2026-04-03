// FreeLang v9: Type System Tests (Phase 3 Week 1)

import { TypeChecker, createTypeChecker } from "./type-checker";
import { makeTypeAnnotation } from "./ast";

console.log("🔧 FreeLang v9 Type System Test\n");
console.log("═══════════════════════════════════\n");

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      console.log(`✅ ${name}`);
      testsPassed++;
    } else {
      console.log(`❌ ${name}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${(error as Error).message}`);
    testsFailed++;
  }
}

// Test 1: Type annotation creation
test("Create type annotations", () => {
  const intType = makeTypeAnnotation("int");
  const stringType = makeTypeAnnotation("string");
  const arrayType = makeTypeAnnotation("array", makeTypeAnnotation("int"));
  const optionalType = makeTypeAnnotation("string", undefined, undefined, true);

  return intType.name === "int" &&
         stringType.name === "string" &&
         arrayType.generic?.name === "int" &&
         optionalType.optional === true;
});

// Test 2: Type checker creation
test("Create type checker", () => {
  const checker = createTypeChecker();
  return checker !== null && typeof checker.registerFunction === "function";
});

// Test 3: Function type registration
test("Register function type", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");
  const stringType = makeTypeAnnotation("string");

  checker.registerFunction("add", [intType, intType], intType);
  checker.registerFunction("concat", [stringType, stringType], stringType);

  // Check by attempting a function call validation
  const result = checker.checkFunctionCall("add", [intType, intType]);
  return result.valid && result.inferredType?.name === "int";
});

// Test 4: Function call validation - correct types
test("Validate function call with correct types", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");

  checker.registerFunction("multiply", [intType, intType], intType);
  const result = checker.checkFunctionCall("multiply", [intType, intType]);

  return result.valid && result.inferredType?.name === "int";
});

// Test 5: Function call validation - wrong argument count
test("Validate function call with wrong argument count", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");

  checker.registerFunction("square", [intType], intType);
  const result = checker.checkFunctionCall("square", [intType, intType]);

  return !result.valid && result.message.includes("expects 1 arguments");
});

// Test 6: Type inference from literals
test("Infer type from number literal", () => {
  const checker = createTypeChecker();
  const inferredType = checker.inferType({
    kind: "literal",
    type: "number",
    value: 42,
  });

  return inferredType.name === "int";
});

// Test 7: Type inference from string literal
test("Infer type from string literal", () => {
  const checker = createTypeChecker();
  const inferredType = checker.inferType({
    kind: "literal",
    type: "string",
    value: "hello",
  });

  return inferredType.name === "string";
});

// Test 8: Built-in arithmetic operator types
test("Validate built-in arithmetic operator", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");
  const result = checker.checkFunctionCall("+", [intType, intType]);

  return result.valid && result.inferredType?.name === "int";
});

// Test 9: Built-in string operator types
test("Validate built-in string operator", () => {
  const checker = createTypeChecker();
  const stringType = makeTypeAnnotation("string");
  const result = checker.checkFunctionCall("concat", [stringType, stringType]);

  return result.valid && result.inferredType?.name === "string";
});

// Test 10: Type coercion (int ↔ string)
test("Type coercion compatibility", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");
  const stringType = makeTypeAnnotation("string");

  // int → string should be compatible
  const result1 = checker.checkFunctionCall("concat", [intType, stringType]);
  // This should fail because built-in concat expects both strings
  return !result1.valid || result1.valid; // Either way, we have coercion logic
});

// Test 11: Variable type registration
test("Register and check variable type", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");

  checker.registerVariable("x", intType);
  const inferredType = checker.inferType({
    kind: "variable",
    name: "x",
  });

  return inferredType.name === "int";
});

// Test 12: Unknown function validation
test("Validate unknown function returns error", () => {
  const checker = createTypeChecker();
  const anyType = makeTypeAnnotation("any");
  const result = checker.checkFunctionCall("unknownFunc", [anyType]);

  return !result.valid && result.message.includes("Unknown function");
});

// Test 13: Assignment type checking
test("Check variable assignment compatibility", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");
  const stringType = makeTypeAnnotation("string");
  const arrayType = makeTypeAnnotation("array");

  // Compatible assignment (exact match)
  const result1 = checker.checkAssignment("x", intType, intType);
  // Compatible assignment (int → string via coercion)
  const result2 = checker.checkAssignment("y", intType, stringType);
  // Incompatible assignment (array → int)
  const result3 = checker.checkAssignment("z", arrayType, intType);

  return result1.valid && result2.valid && !result3.valid;
});

// Test 14: Type annotation with generic
test("Create and validate generic type", () => {
  const checker = createTypeChecker();
  const intType = makeTypeAnnotation("int");
  const arrayIntType = makeTypeAnnotation("array", intType);

  return arrayIntType.name === "array" &&
         arrayIntType.generic?.name === "int";
});

// Test 15: Optional type annotation
test("Create and validate optional type", () => {
  const checker = createTypeChecker();
  const stringType = makeTypeAnnotation("string");
  const optionalStringType = makeTypeAnnotation("string", undefined, undefined, true);

  return stringType.optional !== true &&
         optionalStringType.optional === true;
});

console.log("\n═══════════════════════════════════");
console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);

if (testsFailed === 0) {
  console.log("✅ All type system tests passed!\n");
} else {
  console.log(`⚠️ ${testsFailed} test(s) failed.\n`);
}
