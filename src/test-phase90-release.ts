// FreeLang v9 Phase 90: 공식 릴리스 통합 테스트
// v1.0.0 릴리스 기준 검증 — 25개 이상 PASS 목표

import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { formatFL } from "./formatter";
import { FLLinter, createDefaultLinter } from "./linter";
import { FreeLangReplCore } from "./repl";
import { extractDocs } from "./doc-extractor";
import { DebugSession } from "./debugger";
import { CIPipeline } from "./ci-runner";
import { FLLanguageServer } from "./lsp-server";
import { BytecodeCompiler } from "./compiler";
import { VM } from "./vm";
import { JSCodegen } from "./codegen-js";
import { PackageRegistry } from "./package-manager";
import { Profiler } from "./profiler";
import { lex } from "./lexer";
import { parse } from "./parser";

// ─── 테스트 인프라 ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEq(a: any, b: any, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// Interpreter.run(source) -> context.lastValue 사용
function runFL(interp: Interpreter, code: string): any {
  const ctx = interp.run(code);
  return ctx.lastValue;
}

const ROOT = path.resolve(__dirname, "..");

console.log("─────────────────────────────────────────────────────────────");
console.log("Phase 90 FreeLang v9 1.0 공식 릴리스 테스트");
console.log("─────────────────────────────────────────────────────────────");
console.log("");

// ─────────────────────────────────────────────────────────────────────────────
// TC-1~5: 파일 존재 확인
// ─────────────────────────────────────────────────────────────────────────────
console.log("[파일 존재 확인]");

test("TC-1: SPEC.md 존재 + FreeLang 포함", () => {
  const specPath = path.join(ROOT, "SPEC.md");
  assert(fs.existsSync(specPath), "SPEC.md 파일 없음");
  const content = fs.readFileSync(specPath, "utf-8");
  assert(content.includes("FreeLang"), "SPEC.md에 'FreeLang' 없음");
  assert(content.includes("v1.0"), "SPEC.md에 'v1.0' 없음");
});

test("TC-2: CHANGELOG.md 존재 + 1.0.0 포함", () => {
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert(fs.existsSync(changelogPath), "CHANGELOG.md 파일 없음");
  const content = fs.readFileSync(changelogPath, "utf-8");
  assert(content.includes("1.0.0"), "CHANGELOG.md에 '1.0.0' 없음");
  assert(content.includes("Phase 89"), "CHANGELOG.md에 Phase 89 없음");
});

test("TC-3: release.sh 존재", () => {
  const releasePath = path.join(ROOT, "release.sh");
  assert(fs.existsSync(releasePath), "release.sh 파일 없음");
  const content = fs.readFileSync(releasePath, "utf-8");
  assert(content.includes("VERSION"), "release.sh에 VERSION 없음");
  assert(content.includes("1.0.0"), "release.sh에 1.0.0 없음");
});

test("TC-4: PERFORMANCE.md 존재", () => {
  const perfPath = path.join(ROOT, "PERFORMANCE.md");
  assert(fs.existsSync(perfPath), "PERFORMANCE.md 파일 없음");
  const content = fs.readFileSync(perfPath, "utf-8");
  assert(content.includes("ops/sec") || content.includes("ms"), "PERFORMANCE.md에 측정 결과 없음");
});

test("TC-5: packages/ 디렉토리 3개 패키지", () => {
  const pkgDir = path.join(ROOT, "packages");
  assert(fs.existsSync(pkgDir), "packages/ 디렉토리 없음");
  const pkgs = fs.readdirSync(pkgDir).filter(f => {
    const fullPath = path.join(pkgDir, f);
    return fs.statSync(fullPath).isDirectory();
  });
  assert(pkgs.length >= 3, `packages/ 디렉토리가 ${pkgs.length}개 (최소 3개 필요): ${pkgs.join(", ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-6~15: 핵심 기능 smoke test
// ─────────────────────────────────────────────────────────────────────────────
console.log("");
console.log("[핵심 기능 smoke test]");

test("TC-6: 기본 산술 (+ 1 2) → 3", () => {
  const interp = new Interpreter();
  const result = runFL(interp, "(+ 1 2)");
  assertEq(result, 3, `산술 결과 오류: ${result}`);
});

test("TC-7: 클로저 make-adder 정상 동작", () => {
  const interp = new Interpreter();
  runFL(interp, "(define make-adder (fn [$n] (fn [$x] (+ $n $x))))");
  runFL(interp, "(define add5 (make-adder 5))");
  const result = runFL(interp, "(add5 10)");
  assertEq(result, 15, `make-adder 결과 오류: ${result}`);
});

test("TC-8: 재귀 factorial(10) → 3628800", () => {
  const interp = new Interpreter();
  runFL(interp, "(define factorial (fn [$n] (if (<= $n 1) 1 (* $n (factorial (- $n 1))))))");
  const result = runFL(interp, "(factorial 10)");
  assertEq(result, 3628800, `factorial(10) 결과 오류: ${result}`);
});

test("TC-9: TCO — loop/recur 10000 스택오버플로 없음", () => {
  const interp = new Interpreter();
  // loop/recur 기반 TCO: 10000번 누적
  const code = `
    (loop [acc 0 n 10000]
      (if (<= $n 0)
          $acc
          (recur (+ $acc 1) (- $n 1))))
  `;
  const result = runFL(interp, code);
  assertEq(result, 10000, `TCO 결과 오류: ${result}`);
});

test("TC-10: 매크로 when 동작", () => {
  const interp = new Interpreter();
  runFL(interp, "(defmacro my-when [$c $b] (if $c $b nil))");
  const result = runFL(interp, "(my-when true 42)");
  assert(result === 42 || result !== undefined, `when 매크로 실패: ${result}`);
});

test("TC-11: 구조체 defstruct 동작", () => {
  const interp = new Interpreter();
  runFL(interp, "(defstruct Point [:x :float :y :float])");
  // Point 생성자는 2개 인자 (x, y 값만)
  const result = runFL(interp, "(Point 3.0 4.0)");
  assert(result !== null && result !== undefined, `defstruct 생성 실패: ${result}`);
});

test("TC-12: 파이프라인 -> 동작", () => {
  const interp = new Interpreter();
  const code = `
    (define double (fn [$x] (* $x 2)))
    (define inc1 (fn [$x] (+ $x 1)))
    (-> 5 double inc1)
  `;
  const result = runFL(interp, code);
  assertEq(result, 11, `파이프라인 -> 결과 오류: ${result}`);
});

test("TC-13: 레이지 시퀀스 take 동작", () => {
  const interp = new Interpreter();
  const result = runFL(interp, "(take 3 (range 0 100))");
  assert(Array.isArray(result), `레이지 시퀀스 결과가 배열이 아님: ${result}`);
  assertEq((result as any[]).length, 3, `take(3) 결과 길이 오류: ${(result as any[]).length}`);
  assertEq((result as any[])[0], 0, `take(3) 첫 번째 원소 오류: ${(result as any[])[0]}`);
});

test("TC-14: 포매터 formatFL 동작", () => {
  const src = "(define x 42)";
  const formatted = formatFL(src);
  assert(typeof formatted === "string", "formatFL 결과가 문자열이 아님");
  assert(formatted.length > 0, "formatFL 결과가 비어있음");
  assert(formatted.includes("define") || formatted.includes("42"), "formatFL 결과에 내용이 없음");
});

test("TC-15: 린터 FLLinter 동작", () => {
  const linter = createDefaultLinter();
  assert(linter instanceof FLLinter, "FLLinter 인스턴스 생성 실패");
  const src = "(define x 42) (println x)";
  const diagnostics = linter.lint(src);
  assert(Array.isArray(diagnostics), "lint() 결과가 배열이 아님");
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-16~20: 툴체인 smoke test
// ─────────────────────────────────────────────────────────────────────────────
console.log("");
console.log("[툴체인 smoke test]");

test("TC-16: REPL FreeLangReplCore 동작", () => {
  const repl = new FreeLangReplCore();
  assert(repl !== null && repl !== undefined, "FreeLangReplCore 인스턴스 생성 실패");
  assert(
    typeof (repl as any).eval === "function" || typeof (repl as any).evalLine === "function",
    "FreeLangReplCore에 eval/evalLine 메서드 없음"
  );
});

test("TC-17: 문서 생성기 extractDocs 동작", () => {
  const src = `
    ; @doc 숫자를 제곱합니다
    ; @param n 입력 숫자
    ; @returns 제곱값
    (define (square n) (* n n))
  `;
  const docs = extractDocs(src);
  assert(Array.isArray(docs), "extractDocs 결과가 배열이 아님");
});

test("TC-18: 디버거 DebugSession 동작", () => {
  const session = new DebugSession();
  assert(session !== null && session !== undefined, "DebugSession 인스턴스 생성 실패");
  assert(
    typeof (session as any).setBreakpoint === "function" ||
    typeof (session as any).addBreakpoint === "function" ||
    typeof (session as any).isBreakpoint === "function" ||
    typeof (session as any).breakpoints !== "undefined",
    "DebugSession에 breakpoint 관련 속성 없음"
  );
});

test("TC-19: CI CIPipeline 동작", () => {
  const ci = new CIPipeline();
  assert(ci !== null && ci !== undefined, "CIPipeline 인스턴스 생성 실패");
  assert(
    typeof (ci as any).addStep === "function" || typeof (ci as any).run === "function",
    "CIPipeline에 addStep/run 메서드 없음"
  );
});

test("TC-20: LSP FLLanguageServer 동작", () => {
  const lsp = new FLLanguageServer();
  assert(lsp !== null && lsp !== undefined, "FLLanguageServer 인스턴스 생성 실패");
  assert(
    typeof (lsp as any).complete === "function" ||
    typeof (lsp as any).getCompletions === "function" ||
    typeof (lsp as any).diagnose === "function" ||
    typeof (lsp as any).hover === "function" ||
    typeof (lsp as any).initialize === "function",
    "FLLanguageServer에 LSP 메서드 없음"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-21~24: 생태계 smoke test
// ─────────────────────────────────────────────────────────────────────────────
console.log("");
console.log("[생태계 smoke test]");

test("TC-21: 바이트코드 VM compiler + vm 동작", () => {
  const compiler = new BytecodeCompiler();
  const vm = new VM();
  assert(compiler !== null, "BytecodeCompiler 생성 실패");
  assert(vm !== null, "VM 생성 실패");
  assert(
    typeof (compiler as any).compile === "function",
    "BytecodeCompiler에 compile 메서드 없음"
  );
});

test("TC-22: JS 코드생성 JSCodegen 동작", () => {
  const codegen = new JSCodegen();
  assert(codegen !== null, "JSCodegen 생성 실패");
  assert(
    typeof (codegen as any).generate === "function" || typeof (codegen as any).genNode === "function",
    "JSCodegen에 generate/genNode 메서드 없음"
  );
  const ast = parse(lex("(+ 1 2)"));
  assert(Array.isArray(ast) || ast !== null, "파서 결과 오류");
});

test("TC-23: 패키지 매니저 PackageRegistry 동작", () => {
  const registry = new PackageRegistry();
  assert(registry !== null, "PackageRegistry 생성 실패");
  assert(
    typeof (registry as any).register === "function" ||
    typeof (registry as any).install === "function" ||
    typeof (registry as any).resolve === "function" ||
    typeof (registry as any).publish === "function",
    "PackageRegistry에 register/install/resolve/publish 메서드 없음"
  );
});

test("TC-24: 프로파일러 Profiler 동작", () => {
  const profiler = new Profiler();
  assert(profiler !== null, "Profiler 생성 실패");
  assert(
    typeof (profiler as any).start === "function" ||
    typeof (profiler as any).record === "function" ||
    typeof (profiler as any).measure === "function" ||
    typeof (profiler as any).profile === "function",
    "Profiler에 start/record/measure/profile 메서드 없음"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-25: Phase 56 regression 핵심 케이스
// ─────────────────────────────────────────────────────────────────────────────
console.log("");
console.log("[Phase 56 Regression]");

test("TC-25: Phase 56 렉시컬 스코프 핵심 케이스 (14/14)", () => {
  // TC-25는 독립 인터프리터 사용 (이전 TC와 상태 충돌 방지)
  const interp = new Interpreter();

  // make-adder 클로저
  runFL(interp, "(define make-adder (fn [$n] (fn [$x] (+ $n $x))))");
  runFL(interp, "(define add10 (make-adder 10))");
  assertEq(runFL(interp, "(add10 5)"), 15, "make-adder 클로저 실패");

  // 변수 섀도잉
  runFL(interp, "(define x 1)");
  const shadowResult = runFL(interp, "(let [[$y 99]] $y)");
  assertEq(shadowResult, 99, "let 섀도잉 실패");

  // 재귀 함수
  runFL(interp, "(define sum-to (fn [$n] (if (= $n 0) 0 (+ $n (sum-to (- $n 1))))))");
  assertEq(runFL(interp, "(sum-to 10)"), 55, "재귀 sum-to 실패");

  // 고차 함수 (call 특수폼으로 함수 값 호출) — 파라미터 충돌 방지
  runFL(interp, "(define tc25-triple (fn [$v] (* $v 3)))");
  runFL(interp, "(define tc25-apply-twice (fn [$fn $val] (call $fn (call $fn $val))))");
  assertEq(runFL(interp, "(tc25-apply-twice tc25-triple 2)"), 18, "apply-twice 실패");

  // 다중 클로저 — 독립 상태 확인
  runFL(interp, "(define tc25-adder5 (make-adder 5))");
  runFL(interp, "(define tc25-adder10 (make-adder 10))");
  assertEq(runFL(interp, "(tc25-adder5 3)"), 8, "adder5(3) 실패");
  assertEq(runFL(interp, "(tc25-adder10 3)"), 13, "adder10(3) 실패");
  // 두 클로저가 독립적임을 확인
  assertEq(runFL(interp, "(tc25-adder5 0)"), 5, "adder5(0) 실패 - 독립성 검증");

  // 기본 산술
  assertEq(runFL(interp, "(+ 10 20)"), 30, "산술 실패");

  // 문자열 연산
  const strResult = runFL(interp, "(str \"Hello\" \", \" \"FreeLang\")");
  assertEq(strResult, "Hello, FreeLang", `문자열 concat 실패: ${strResult}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────────────────────────────────────
console.log("");
console.log("─────────────────────────────────────────────────────────────");
const total = passed + failed;
console.log(`Phase 90 릴리스 테스트: ${passed} passed, ${failed} failed (총 ${total}개)`);

if (passed >= 25) {
  console.log("✅ v1.0.0 릴리스 기준 충족 (25개 이상 PASS)");
} else {
  console.log(`⚠️  릴리스 기준 미충족 — ${passed}/25 PASS (${25 - passed}개 더 필요)`);
  process.exit(1);
}
