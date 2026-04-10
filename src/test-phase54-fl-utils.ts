// FreeLang v9: Phase 54 — FL utility library (import 실전)
// fl-list-utils.fl + fl-str-utils.fl + fl-app-demo.fl 검증

import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function makeInterp(filePath: string): Interpreter {
  const src = fs.readFileSync(filePath, "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = filePath;
  interp.interpret(parse(lex(src)));
  return interp;
}

function run(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

const srcDir = __dirname;

// ── list-utils 직접 테스트 ─────────────────────────────────────────
console.log("[Phase 54] FL utility library 검증\n");
console.log("[fl-list-utils.fl 직접 테스트]");

{
  const listInterp = makeInterp(path.join(srcDir, "fl-list-utils.fl"));

  test("sum([1,2,3,4,5]) = 15", () => {
    const res = run(listInterp, "(sum [1.0 2.0 3.0 4.0 5.0])");
    if (res !== 15) throw new Error(`got ${res}`);
  });

  test("mean([1,2,3,4,5]) = 3", () => {
    const res = run(listInterp, "(mean [1.0 2.0 3.0 4.0 5.0])");
    if (Math.abs(res - 3.0) > 0.001) throw new Error(`got ${res}`);
  });

  test("lst-max([3,1,4,1,5,9]) = 9", () => {
    const res = run(listInterp, "(lst-max [3.0 1.0 4.0 1.0 5.0 9.0])");
    if (res !== 9) throw new Error(`got ${res}`);
  });

  test("lst-min([3,1,4,1,5,9]) = 1", () => {
    const res = run(listInterp, "(lst-min [3.0 1.0 4.0 1.0 5.0 9.0])");
    if (res !== 1) throw new Error(`got ${res}`);
  });

  test("take([1,2,3,4,5], 3) = [1,2,3]", () => {
    const res = run(listInterp, "(take [1.0 2.0 3.0 4.0 5.0] 3)") as number[];
    if (!Array.isArray(res) || res.length !== 3 || res[0] !== 1 || res[2] !== 3)
      throw new Error(`got ${JSON.stringify(res)}`);
  });

  test("drop([1,2,3,4,5], 2) = [3,4,5]", () => {
    const res = run(listInterp, "(drop [1.0 2.0 3.0 4.0 5.0] 2)") as number[];
    if (!Array.isArray(res) || res.length !== 3 || res[0] !== 3 || res[2] !== 5)
      throw new Error(`got ${JSON.stringify(res)}`);
  });
}

// ── str-utils 직접 테스트 ────────────────────────────────────────────
console.log("\n[fl-str-utils.fl 직접 테스트]");

{
  const strInterp = makeInterp(path.join(srcDir, "fl-str-utils.fl"));

  test('repeat-str("FL", 3) = "FLFLFL"', () => {
    const res = run(strInterp, '(repeat-str "FL" 3)');
    if (res !== "FLFLFL") throw new Error(`got "${res}"`);
  });

  test('pad-left("42", 5, "0") = "00042"', () => {
    const res = run(strInterp, '(pad-left "42" 5 "0")');
    if (res !== "00042") throw new Error(`got "${res}"`);
  });

  test('pad-left("hello", 3, "0") = "hello" (no truncation)', () => {
    const res = run(strInterp, '(pad-left "hello" 3 "0")');
    if (res !== "hello") throw new Error(`got "${res}"`);
  });
}

// ── fl-app-demo.fl import 통합 테스트 ────────────────────────────────
console.log("\n[fl-app-demo.fl import 통합 테스트]");

{
  test("fl-app-demo.fl 실행 오류 없음", () => {
    const demoPath = path.join(srcDir, "fl-app-demo.fl");
    const src = fs.readFileSync(demoPath, "utf-8");
    const interp = new Interpreter();
    (interp as any).currentFilePath = demoPath;
    interp.interpret(parse(lex(src)));
  });

  test("list:sum + stru:repeat-str 동시 사용 가능", () => {
    const demoPath = path.join(srcDir, "fl-app-demo.fl");
    const src = fs.readFileSync(demoPath, "utf-8");
    const interp = new Interpreter();
    (interp as any).currentFilePath = demoPath;
    interp.interpret(parse(lex(src)));

    // 두 네임스페이스 모두 등록됐는지 확인
    const fns = (interp as any).context.functions as Map<string, any>;
    if (!fns.has("list:sum")) throw new Error("list:sum 없음");
    if (!fns.has("stru:repeat-str")) throw new Error("stru:repeat-str 없음");
  });
}

// ── 결과 ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 54 FL utility library: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
