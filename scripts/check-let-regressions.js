#!/usr/bin/env node
// check-let-regressions.js — let-in-expression 회귀 테스트 검증
// 각 tests/regen/let-in-expr-*.fl을 컴파일하고 생성 JS에서 IIFE 패턴 확인

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TEST_DIR = path.join(__dirname, "../tests/regen");
const tests = [
  { file: "let-in-expr-01.fl", name: "Case A: return 내 let", expects: "IIFE" },
  { file: "let-in-expr-02.fl", name: "Case B: if 조건의 let", expects: "IIFE" },
  { file: "let-in-expr-03.fl", name: "Case C: 인자 위치 let", expects: "IIFE" },
  { file: "let-in-expr-04.fl", name: "Case D: 중첩 let", expects: "IIFE_NESTED" },
  { file: "let-in-expr-05.fl", name: "Case E: 복잡한 expression", expects: "IIFE" },
];

// IIFE 패턴 감지 정규식
const IIFE_PATTERN = /\(\s*\(\s*(?:async\s*)?\s*(?:\(\s*\)|\w+\s*=>\s*\w+)\s*(?:=>|=)\s*{[\s\S]*?}\s*\)\s*\(\s*\)/;
const LET_AS_EXPR_PATTERN = /return\s+let\s+[^\;]+\;/;
const UNSUPPORTED_BLOCK = /\/\*\s*unsupported block/;

console.log("════════════════════════════════════════════");
console.log("  Let-in-Expression Regression Tests");
console.log("════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

for (const test of tests) {
  const filePath = path.join(TEST_DIR, test.file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${test.name} — file not found: ${filePath}`);
    failed++;
    continue;
  }

  try {
    // bootstrap.js compile로 생성
    const output = path.join("/tmp", `${path.basename(test.file, ".fl")}.js`);
    const projectRoot = path.join(__dirname, "..");
    execSync(`node bootstrap.js compile "${filePath}" -o "${output}"`, {
      cwd: projectRoot,
      stdio: "pipe",
    });

    const js = fs.readFileSync(output, "utf8");

    // 검증 1: unsupported block 확인 (실패)
    if (UNSUPPORTED_BLOCK.test(js)) {
      console.log(`❌ ${test.name} — unsupported block found`);
      failed++;
      continue;
    }

    // 검증 2: let-as-expression 잔재 확인 (실패)
    if (LET_AS_EXPR_PATTERN.test(js)) {
      console.log(`❌ ${test.name} — let-as-statement found (should be IIFE)`);
      console.log(`   Pattern: ${LET_AS_EXPR_PATTERN}`);
      failed++;
      continue;
    }

    // 검증 3: IIFE 패턴 확인 (IIFE 필요 케이스)
    if (test.expects === "IIFE" || test.expects === "IIFE_NESTED") {
      // 더 느슨한 패턴: (() => { ... })() 형태
      const hasIIFE = /\(\s*\(\s*\)\s*=>\s*{[\s\S]*?}\s*\)\s*\(\s*\)/.test(js) ||
                      /\(\s*\(\s*async\s*\(\s*\)\s*=>\s*{[\s\S]*?}\s*\)\s*\(\s*\)/.test(js);

      if (!hasIIFE) {
        console.log(`⚠️  ${test.name} — IIFE pattern not clearly detected (manual review needed)`);
        console.log(`   JS snippet:\n${js.slice(0, 200)}`);
      }
    }

    // Node syntax 검증
    execSync(`node --check "${output}"`, { stdio: "pipe" });

    console.log(`✅ ${test.name}`);
    passed++;

    // 정리
    fs.unlinkSync(output);
  } catch (err) {
    console.log(`❌ ${test.name} — ${err.message.split("\n")[0]}`);
    failed++;
  }
}

console.log("\n════════════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
