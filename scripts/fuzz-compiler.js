#!/usr/bin/env node
// scripts/fuzz-compiler.js — FreeLang v11 Compiler Fuzzer
//
// 목표: 무작위 S-expr 생성 및 컴파일러 스트레스 테스트 (C-9)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const STAGE1 = "stage1.js";
const TMP_FL = ".fuzz.fl";
const TMP_JS = ".fuzz.js";

const ITERATIONS = process.argv.includes("--n") ? parseInt(process.argv[process.argv.indexOf("--n") + 1]) : 100;

const SYMBOLS = ["+", "-", "*", "/", "=", "<", ">", "and", "or", "not", "if", "let", "do", "fn", "list", "first", "rest", "get", "range", "length", "str", "println"];
const VARS = ["$x", "$y", "$z", "$a", "$b"];

function genExpr(depth = 0) {
  if (depth > 5 || Math.random() > 0.7) {
    // Leaf
    const r = Math.random();
    if (r < 0.3) return Math.floor(Math.random() * 200) - 100;
    if (r < 0.6) return `"${Math.random().toString(36).substring(7)}"`;
    if (r < 0.9) return VARS[Math.floor(Math.random() * VARS.length)];
    return Math.random() > 0.5 ? "true" : "false";
  }

  const op = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const numArgs = Math.floor(Math.random() * 3) + 1;
  const args = [];

  // Special handling for let to make it somewhat valid
  if (op === "let") {
    const bindings = [];
    const numBindings = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < numBindings; i++) {
      bindings.push(`[${VARS[i]} ${genExpr(depth + 1)}]`);
    }
    return `(let [${bindings.join(" ")}] ${genExpr(depth + 1)})`;
  }

  // Special handling for fn
  if (op === "fn") {
    const params = VARS.slice(0, Math.floor(Math.random() * 2) + 1);
    return `(fn [${params.join(" ")}] ${genExpr(depth + 1)})`;
  }

  for (let i = 0; i < numArgs; i++) {
    args.push(genExpr(depth + 1));
  }
  return `(${op} ${args.join(" ")})`;
}

console.log(`🚀 Starting Fuzz Test: ${ITERATIONS} iterations`);

let pass = 0;
let fail = 0;

for (let i = 0; i < ITERATIONS; i++) {
  const code = String(genExpr());
  fs.writeFileSync(TMP_FL, code);

  try {
    // 1. Compile check
    execSync(`node --stack-size=8000 ${STAGE1} ${TMP_FL} ${TMP_JS}`, { stdio: "ignore" });
    
    // 2. JS Syntax check (optional but good)
    execSync(`node -c ${TMP_JS}`, { stdio: "ignore" });

    pass++;
    if (i % 10 === 0) process.stdout.write(".");
  } catch (e) {
    fail++;
    console.log(`\n❌ Fuzz Fail at iteration ${i}:`);
    console.log(`Code: ${code}`);
    // Keep the file for debugging if failed
    fs.renameSync(TMP_FL, `.fuzz-fail-${i}.fl`);
    try { if (fs.existsSync(TMP_JS)) fs.renameSync(TMP_JS, `.fuzz-fail-${i}.js`); } catch(err) {}
  }
}

console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ Fuzz Result: ${pass} PASS, ${fail} FAIL`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

if (fail > 0) {
  process.exit(1);
} else {
  // Cleanup
  try { fs.unlinkSync(TMP_FL); fs.unlinkSync(TMP_JS); } catch(e) {}
}
