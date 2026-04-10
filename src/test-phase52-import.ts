// FreeLang v9: Phase 52 — FL 파일 import 시스템 테스트
// (import math :from "./fl-math-lib.fl") 문법으로 FL 파일 간 코드 재사용

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

function makeInterp(): Interpreter {
  const interp = new Interpreter();
  // 테스트 파일 경로 기준으로 상대 경로 해석
  (interp as any).currentFilePath = __dirname;
  return interp;
}

function run(interp: Interpreter, src: string): any {
  return interp.interpret(parse(lex(src)));
}

const libPath = "./fl-math-lib.fl";

console.log("[Phase 52] FL 파일 import 시스템\n");

// ── TC-1: 기본 import — 함수 등록 확인 ────────────────────────
console.log("[TC-1~4] 기본 import: math:* 함수 등록 및 호출");

const interp1 = makeInterp();
run(interp1, `(import math :from "${libPath}")`);

test("math:square 함수가 등록됨", () => {
  if (!(interp1 as any).context.functions.has("math:square"))
    throw new Error("math:square not registered");
});

test("math:cube 함수가 등록됨", () => {
  if (!(interp1 as any).context.functions.has("math:cube"))
    throw new Error("math:cube not registered");
});

test("math:clamp 함수가 등록됨", () => {
  if (!(interp1 as any).context.functions.has("math:clamp"))
    throw new Error("math:clamp not registered");
});

// ── TC-2: math:square 호출 ─────────────────────────────────────
test("math:square(4) → 16", () => {
  const result = run(interp1, "(math:square 4)");
  if (result !== 16) throw new Error(`got ${result}`);
});

// ── TC-3: math:cube 호출 ──────────────────────────────────────
test("math:cube(3) → 27", () => {
  const result = run(interp1, "(math:cube 3)");
  if (result !== 27) throw new Error(`got ${result}`);
});

// ── TC-4: math:clamp 호출 ─────────────────────────────────────
test("math:clamp(15, 0, 10) → 10", () => {
  const result = run(interp1, "(math:clamp 15 0 10)");
  if (result !== 10) throw new Error(`got ${result}`);
});

test("math:clamp(5, 0, 10) → 5 (범위 안)", () => {
  const result = run(interp1, "(math:clamp 5 0 10)");
  if (result !== 5) throw new Error(`got ${result}`);
});

// ── TC-5: :only 선택적 import ─────────────────────────────────
console.log("\n[TC-5] :only 선택적 import");

const interp2 = makeInterp();
run(interp2, `(import utils :from "${libPath}" :only [square])`);

test(":only [square] → square 직접 등록됨", () => {
  if (!(interp2 as any).context.functions.has("square"))
    throw new Error("square not registered");
});

test(":only [square] → cube는 등록 안 됨", () => {
  if ((interp2 as any).context.functions.has("cube"))
    throw new Error("cube should not be registered");
  if ((interp2 as any).context.functions.has("utils:cube"))
    throw new Error("utils:cube should not be registered");
});

test(":only [square] → square(5) 호출", () => {
  const result = run(interp2, "(square 5)");
  if (result !== 25) throw new Error(`got ${result}`);
});

// ── TC-6: :as 별칭 ────────────────────────────────────────────
console.log("\n[TC-6] :as 별칭 import");

const interp3 = makeInterp();
run(interp3, `(import math :from "${libPath}" :as m)`);

test(":as m → m:square 등록됨", () => {
  if (!(interp3 as any).context.functions.has("m:square"))
    throw new Error("m:square not registered");
});

test(":as m → m:square(6) → 36", () => {
  const result = run(interp3, "(m:square 6)");
  if (result !== 36) throw new Error(`got ${result}`);
});

// ── TC-7: 순환 import (같은 파일 두 번) ──────────────────────
console.log("\n[TC-7] 순환/중복 import");

const interp4 = makeInterp();
let circularError = false;
try {
  run(interp4, `(import math :from "${libPath}")`);
  run(interp4, `(import math :from "${libPath}")`); // 두 번째는 no-op
} catch {
  circularError = true;
}

test("같은 파일 두 번 import → 오류 없음", () => {
  if (circularError) throw new Error("second import raised an error");
  if (!(interp4 as any).context.functions.has("math:square"))
    throw new Error("math:square not registered after double import");
});

// ── TC-8: 파일 없음 → Error ───────────────────────────────────
console.log("\n[TC-8] 파일 없음 → Error");

test("존재하지 않는 파일 → Error 발생", () => {
  const interp5 = makeInterp();
  let threw = false;
  try {
    run(interp5, `(import nonexistent :from "./this-file-does-not-exist.fl")`);
  } catch (e: any) {
    threw = true;
    if (!String(e.message).includes("file not found") && !String(e.message).includes("Import error")) {
      throw new Error(`Wrong error message: ${e.message}`);
    }
  }
  if (!threw) throw new Error("Expected an error but none was thrown");
});

// ── 결과 ──────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 52 import: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
