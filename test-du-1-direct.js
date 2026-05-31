#!/usr/bin/env node
/**
 * DU-1 Runtime Direct Test
 * bootstrap.js 거치지 않고 interpreter를 직접 호출해서 DU-1 검증
 *
 * 목표:
 * 1. User function (cache-get) 호출 동작
 * 2. Builtin (println) 호출 동작
 * 3. Hyphenated 함수명 정상 작동
 */

const { Interpreter } = require("./dist/interpreter");
const { lex } = require("./dist/lexer");
const { parse } = require("./dist/parser");

function runTest(name, flCode) {
  console.log(`\n=== ${name} ===`);
  try {
    const interp = new Interpreter();
    const tokens = lex(flCode);
    const ast = parse(tokens);
    const result = interp.interpret(ast);
    console.log(`✅ PASS: result=${JSON.stringify(result)}`);
    return true;
  } catch (err) {
    console.error(`❌ FAIL: ${err.message}`);
    return false;
  }
}

// Test 1: User function with hyphenated name
const test1 = `
(defn cache-get [$key]
  (println (str "cache-get called with key=" $key))
  {:cached true})

(println "Calling cache-get...")
(cache-get "test-key")
`;

// Test 2: Builtin function
const test2 = `
(println "Builtin println works")
`;

// Test 3: Mixed: user + builtin
const test3 = `
(defn test-func [$x]
  (println (str "test-func called with x=" $x))
  $x)

(let [$r (test-func 42)]
  (println (str "Result: " $r)))
`;

let passed = 0;
let failed = 0;

if (runTest("Test 1: Hyphenated user function", test1)) passed++; else failed++;
if (runTest("Test 2: Builtin println", test2)) passed++; else failed++;
if (runTest("Test 3: Mixed user + builtin", test3)) passed++; else failed++;

console.log(`\n\n=== SUMMARY ===`);
console.log(`Passed: ${passed}/3`);
console.log(`Failed: ${failed}/3`);
process.exit(failed > 0 ? 1 : 0);
