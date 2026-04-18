// FreeLang v9 Phase 6: Pure Compiler Tests (간소화)

import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

const tmpDir = path.join(__dirname, "../.test-phase6");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
  try {
    const ok = fn();
    if (ok) {
      console.log(`✓  ${name}`);
      passed++;
    } else {
      console.log(`✗  ${name}`);
      failed++;
    }
  } catch (err: any) {
    console.log(`✗  ${name} — ${err.message}`);
    failed++;
  }
}

function runFL(code: string): any {
  const interp = new Interpreter();
  const ctx = interp.interpret(parse(lex(code)));
  return ctx.lastValue;
}

// ============================================================
// 핵심 테스트: fl_compile_file
// ============================================================

test("fl_compile_file: FUNC 블록 컴파일", () => {
  const inputFile = path.join(tmpDir, "test1.fl");
  const outputFile = path.join(tmpDir, "test1.js");
  const code = '[FUNC add :params [$a $b] :body (+ $a $b)]';
  fs.writeFileSync(inputFile, code);

  const result = runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  const js = fs.readFileSync(outputFile, "utf-8");
  return result === true && js.includes("function add");
});

test("fl_compile_file: println 컴파일", () => {
  const inputFile = path.join(tmpDir, "test2.fl");
  const outputFile = path.join(tmpDir, "test2.js");
  fs.writeFileSync(inputFile, '(println "hello")');

  const result = runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  const js = fs.readFileSync(outputFile, "utf-8");
  return result === true && js.includes("__fl_print");
});

test("fl_compile_file: 출력 디렉토리 자동 생성", () => {
  const deepDir = path.join(tmpDir, "deep", "nested", "dir");
  const inputFile = path.join(tmpDir, "test3.fl");
  const outputFile = path.join(deepDir, "test3.js");
  fs.writeFileSync(inputFile, '(+ 1 2)');

  const result = runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  return result === true && fs.existsSync(outputFile);
});

test("fl_compile_file: 존재하지 않는 파일 에러", () => {
  try {
    runFL(`(fl_compile_file "/nonexistent/file.fl" "/tmp/out.js")`);
    return false;
  } catch {
    return true;
  }
});

// ============================================================
// 핵심 테스트: fl_compile (디렉토리)
// ============================================================

test("fl_compile: 빈 디렉토리", () => {
  const emptyDir = path.join(tmpDir, "empty");
  const outDir = path.join(tmpDir, "empty-out");
  if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir, { recursive: true });

  const result = runFL(`(fl_compile "${emptyDir}" "${outDir}")`);
  return result && result.compiled === 0 && result.failed === 0;
});

test("fl_compile: 1개 파일", () => {
  const dir = path.join(tmpDir, "single");
  const outDir = path.join(tmpDir, "single-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.fl"), '(+ 1 2)');

  const result = runFL(`(fl_compile "${dir}" "${outDir}")`);
  return result && result.compiled === 1 && result.failed === 0;
});

test("fl_compile: 3개 파일", () => {
  const dir = path.join(tmpDir, "triple");
  const outDir = path.join(tmpDir, "triple-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.fl"), '(+ 1 2)');
  fs.writeFileSync(path.join(dir, "b.fl"), '(+ 2 3)');
  fs.writeFileSync(path.join(dir, "c.fl"), '(+ 3 4)');

  const result = runFL(`(fl_compile "${dir}" "${outDir}")`);
  return result && result.compiled === 3 && result.failed === 0;
});

test("fl_compile: 구문 오류 파일", () => {
  const dir = path.join(tmpDir, "error");
  const outDir = path.join(tmpDir, "error-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bad.fl"), '(+ 1'); // 구문 오류

  const result = runFL(`(fl_compile "${dir}" "${outDir}")`);
  return result && result.failed === 1 && Array.isArray(result.errors);
});

test("fl_compile: 정상 2개 + 오류 1개", () => {
  const dir = path.join(tmpDir, "mixed");
  const outDir = path.join(tmpDir, "mixed-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "good1.fl"), '(+ 1 2)');
  fs.writeFileSync(path.join(dir, "good2.fl"), '(+ 3 4)');
  fs.writeFileSync(path.join(dir, "bad.fl"), '(+ 1');

  const result = runFL(`(fl_compile "${dir}" "${outDir}")`);
  return result && result.compiled === 2 && result.failed === 1;
});

// ============================================================
// 핵심 테스트: fl_compile_result_ok
// ============================================================

test("fl_compile_result_ok: 성공 케이스", () => {
  const dir = path.join(tmpDir, "tc-ok");
  const outDir = path.join(tmpDir, "tc-ok-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "x.fl"), '(+ 1 2)');

  const code = `(let [[r (fl_compile "${dir}" "${outDir}")]] (fl_compile_result_ok r))`;
  const ok = runFL(code);
  return ok === true;
});

test("fl_compile_result_ok: 실패 케이스", () => {
  const dir = path.join(tmpDir, "tc-fail");
  const outDir = path.join(tmpDir, "tc-fail-out");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bad.fl"), '(+ 1');

  const code = `(let [[r (fl_compile "${dir}" "${outDir}")]] (fl_compile_result_ok r))`;
  const ok = runFL(code);
  return ok === false;
});

// ============================================================
// 생성된 JS 파일 유효성
// ============================================================

test("생성 JS: (+ 1 2) 파일 유효", () => {
  const inputFile = path.join(tmpDir, "tc-valid.fl");
  const outputFile = path.join(tmpDir, "tc-valid.js");
  fs.writeFileSync(inputFile, '(+ 1 2)');

  runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  const js = fs.readFileSync(outputFile, "utf-8");

  try {
    new Function(js);
    return true;
  } catch {
    return false;
  }
});

test("생성 JS: FUNC 블록 유효", () => {
  const inputFile = path.join(tmpDir, "tc-func.fl");
  const outputFile = path.join(tmpDir, "tc-func.js");
  fs.writeFileSync(inputFile, '[FUNC f :params [$x] :body (+ $x 1)]');

  runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  const js = fs.readFileSync(outputFile, "utf-8");

  try {
    new Function(js);
    return true;
  } catch {
    return false;
  }
});

test("생성 JS: let 바인딩 유효", () => {
  const inputFile = path.join(tmpDir, "tc-let.fl");
  const outputFile = path.join(tmpDir, "tc-let.js");
  fs.writeFileSync(inputFile, '(let [[$x 42]] $x)');

  runFL(`(fl_compile_file "${inputFile}" "${outputFile}")`);
  const js = fs.readFileSync(outputFile, "utf-8");

  try {
    new Function(js);
    return true;
  } catch {
    return false;
  }
});

// ============================================================
// 결과 보고
// ============================================================

console.log("");
console.log("════════════════════════════════════════");
console.log(`Phase 6 Compilation Tests: ${passed + failed}개`);
console.log(`✓ PASS: ${passed}`);
console.log(`✗ FAIL: ${failed}`);
console.log("════════════════════════════════════════");

if (failed > 0) process.exit(1);
