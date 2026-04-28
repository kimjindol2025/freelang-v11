#!/usr/bin/env node
// run-semantic-test.js: Node 기반 의미 검증 테스트
// FreeLang = 최적화 담당
// Node = 실행 + 비교 담당

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BOOTSTRAP = path.join(__dirname, "../bootstrap.js");
const TEMP_DIR = path.join(__dirname, "./temp");

// 임시 디렉토리 생성
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function runCode(src) {
  // FreeLang 코드 실행 → 결과 반환
  const tmpFile = path.join(TEMP_DIR, `tmp-${Date.now()}.fl`);
  fs.writeFileSync(tmpFile, src, "utf-8");

  try {
    const output = execSync(`node ${BOOTSTRAP} run ${tmpFile}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

function semanticEqual(name, src1, src2) {
  // 두 코드의 실행 결과 비교
  console.log(`\nTest: ${name}`);
  console.log(`  원본: ${src1}`);
  console.log(`  최적: ${src2}`);

  const r1 = runCode(src1);
  const r2 = runCode(src2);

  const equal = r1 === r2;
  if (equal) {
    console.log(`  ✅ PASS (결과: "${r1}")`);
  } else {
    console.log(`  ❌ FAIL`);
    console.log(`    원본 출력: "${r1}"`);
    console.log(`    최적 출력: "${r2}"`);
  }

  return equal;
}

function main() {
  console.log("================================================");
  console.log("  의미 검증 테스트 (Node 기반)");
  console.log("================================================");

  const tests = [
    {
      name: "do-elimination (single)",
      orig: "(do (+ 1 2))",
      opt: "(+ 1 2)",
    },
    {
      name: "do-elimination (nested)",
      orig: "(do (do (+ 1 2)))",
      opt: "(+ 1 2)",
    },
    {
      name: "do-elimination (in expr)",
      orig: "(+ (do 1) 2)",
      opt: "(+ 1 2)",
    },
    {
      name: "constant-folding (+)",
      orig: "(+ 1 2)",
      opt: "(+ 1 2)",
    },
    {
      name: "constant-folding nested (+)",
      orig: "(+ (+ 1 2) 3)",
      opt: "(+ 3 3)",
    },
    {
      name: "constant-folding nested (*)",
      orig: "(* (+ 1 2) (- 5 3))",
      opt: "(* 3 2)",
    },
    {
      name: "constant-folding nested complex",
      orig: "(+ (* 2 3) (- 10 4))",
      opt: "(+ 6 6)",
    },
    {
      name: "dead-expr-elimination (const args)",
      orig: "(do 1 2 (+ 3 4))",
      opt: "(+ 3 4)",
    },
    {
      name: "dead-expr-elimination (nested)",
      orig: "(do (do 1 2) (- 10 5))",
      opt: "(- 10 5)",
    },
  ];

  let passed = 0;
  for (const test of tests) {
    if (semanticEqual(test.name, test.orig, test.opt)) {
      passed++;
    }
  }

  console.log("\n================================================");
  console.log(`결과: ${passed}/${tests.length} PASS`);
  if (passed === tests.length) {
    console.log("✅ 모든 의미 검증 통과");
    process.exit(0);
  } else {
    console.log("❌ 일부 검증 실패");
    process.exit(1);
  }
}

main();
