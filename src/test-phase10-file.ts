// FreeLang v9: Phase 10 File I/O Tests
// Tests for file_read, file_write, file_exists, dir_create, dir_list, etc.

import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";
import * as fs from "fs";
import * as path from "path";

const testDir = "./test-output";

// Ensure test directory exists
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err: any) {
    console.log(`✗ ${name}`);
    console.log(`  ${err.message}`);
  }
}

// Phase 10: File I/O Tests
console.log("=== Phase 10: File I/O Tests ===\n");

// Test 1: file_write and file_read
test("file_write and file_read", () => {
  const testFile = path.join(testDir, "test1.txt");
  const interpreter = new Interpreter();

  // Write file
  const writeCode = `(file_write "${testFile}" "Hello, FreeLang!")`;
  const writeTokens = lex(writeCode);
  const writeAst = parse(writeTokens);
  interpreter.interpret(writeAst);

  // Read file
  const readCode = `(file_read "${testFile}")`;
  const readTokens = lex(readCode);
  const readAst = parse(readTokens);
  interpreter.interpret(readAst);
  const result = interpreter.context.lastValue;

  if (result !== "Hello, FreeLang!") {
    throw new Error(`Expected "Hello, FreeLang!", got "${result}"`);
  }
});

// Test 2: file_exists
test("file_exists (true case)", () => {
  const testFile = path.join(testDir, "test2.txt");
  const interpreter = new Interpreter();

  // Create file
  fs.writeFileSync(testFile, "exists");

  // Check existence
  const code = `(file_exists "${testFile}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue;

  if (result !== true) {
    throw new Error(`Expected true, got ${result}`);
  }
});

// Test 3: file_exists (false case)
test("file_exists (false case)", () => {
  const testFile = path.join(testDir, "nonexistent.txt");
  const interpreter = new Interpreter();

  const code = `(file_exists "${testFile}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue;

  if (result !== false) {
    throw new Error(`Expected false, got ${result}`);
  }
});

// Test 4: file_delete
test("file_delete", () => {
  const testFile = path.join(testDir, "test4.txt");
  const interpreter = new Interpreter();

  // Create file
  fs.writeFileSync(testFile, "to delete");

  // Delete file
  const code = `(file_delete "${testFile}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue;

  if (result !== true) {
    throw new Error(`Expected true, got ${result}`);
  }

  if (fs.existsSync(testFile)) {
    throw new Error(`File still exists after delete`);
  }
});

// Test 5: file_append
test("file_append", () => {
  const testFile = path.join(testDir, "test5.txt");
  const interpreter = new Interpreter();

  // Write initial content
  fs.writeFileSync(testFile, "Hello");

  // Append content
  const code = `(file_append "${testFile}" " World")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);

  const content = fs.readFileSync(testFile, "utf-8");
  if (content !== "Hello World") {
    throw new Error(`Expected "Hello World", got "${content}"`);
  }
});

// Test 6: dir_create
test("dir_create", () => {
  const testSubDir = path.join(testDir, "subdir");
  const interpreter = new Interpreter();

  // Clean up if exists
  if (fs.existsSync(testSubDir)) {
    fs.rmdirSync(testSubDir);
  }

  const code = `(dir_create "${testSubDir}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue;

  if (result !== true) {
    throw new Error(`Expected true, got ${result}`);
  }

  if (!fs.existsSync(testSubDir)) {
    throw new Error(`Directory not created`);
  }
});

// Test 7: dir_list
test("dir_list", () => {
  const testDir2 = path.join(testDir, "listdir");
  const interpreter = new Interpreter();

  // Create directory with files
  if (!fs.existsSync(testDir2)) {
    fs.mkdirSync(testDir2, { recursive: true });
  }
  fs.writeFileSync(path.join(testDir2, "file1.txt"), "1");
  fs.writeFileSync(path.join(testDir2, "file2.txt"), "2");

  const code = `(dir_list "${testDir2}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue as string[];

  if (!Array.isArray(result) || !result.includes("file1.txt") || !result.includes("file2.txt")) {
    throw new Error(`Expected ["file1.txt", "file2.txt"], got ${JSON.stringify(result)}`);
  }
});

// Test 8: file_copy
test("file_copy", () => {
  const srcFile = path.join(testDir, "source.txt");
  const destFile = path.join(testDir, "destination.txt");
  const interpreter = new Interpreter();

  // Create source file
  fs.writeFileSync(srcFile, "copy me");

  // Copy file
  const code = `(file_copy "${srcFile}" "${destFile}")`;
  const tokens = lex(code);
  const ast = parse(tokens);
  interpreter.interpret(ast);
  const result = interpreter.context.lastValue;

  if (result !== true) {
    throw new Error(`Expected true, got ${result}`);
  }

  if (!fs.existsSync(destFile)) {
    throw new Error(`Destination file not created`);
  }

  const content = fs.readFileSync(destFile, "utf-8");
  if (content !== "copy me") {
    throw new Error(`Expected "copy me", got "${content}"`);
  }
});

console.log("\n=== Phase 10 File I/O Tests Complete ===\n");

// Cleanup
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
