// FreeLang v9: Phase 88 — 자체 호스팅 2.0
// FL로 작성한 툴(fmt/lint/test)을 검증하는 테스트

import * as fs from "fs";
import * as path from "path";
import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";
// Phase 56 regression용
import { lex as lexReg } from "./lexer";
import { parse as parseReg } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function loadFl(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

function evalIn(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function hasFn(interp: Interpreter, name: string): boolean {
  return (interp as any).context.functions.has(name);
}

const flFilesDir = path.join(__dirname, "fl-files");

// ──────────────────────────────────────────────────────────
// fl-fmt.fl 테스트 (TC-1 ~ TC-5)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-1~5] fl-fmt.fl 파싱 및 함수 검증\n");

let fmtSrc = "";
let fmtInterp: Interpreter | null = null;

test("TC-1: fl-fmt.fl 파싱 성공", () => {
  fmtSrc = fs.readFileSync(path.join(flFilesDir, "fl-fmt.fl"), "utf-8");
  if (!fmtSrc || fmtSrc.length === 0) throw new Error("빈 파일");
  fmtInterp = loadFl(fmtSrc);
});

test("TC-2: fl-fmt.fl — [MODULE fl-fmt] 블록 포함", () => {
  if (!fmtSrc.includes("[MODULE fl-fmt]")) throw new Error("[MODULE fl-fmt] 없음");
});

test("TC-3: fl-fmt.fl — indent 함수 정의됨", () => {
  if (!fmtSrc.includes("indent")) throw new Error("indent 없음");
  if (!fmtInterp) throw new Error("인터프리터 로드 실패");
  if (!hasFn(fmtInterp, "indent")) throw new Error("indent 함수 미등록");
});

test("TC-4: fl-fmt.fl — fmt-sexpr 함수 정의됨", () => {
  if (!fmtSrc.includes("fmt-sexpr")) throw new Error("fmt-sexpr 없음");
  if (!fmtInterp) throw new Error("인터프리터 로드 실패");
  if (!hasFn(fmtInterp, "fmt-sexpr")) throw new Error("fmt-sexpr 함수 미등록");
});

test("TC-5: fl-fmt.fl 로드 후 indent 함수 호출 가능", () => {
  if (!fmtInterp) throw new Error("인터프리터 로드 실패");
  const result = evalIn(fmtInterp, "(indent 2)");
  if (result !== "    ") throw new Error(`indent(2) = ${JSON.stringify(result)}, 기대: "    "`);
});

// ──────────────────────────────────────────────────────────
// fl-lint.fl 테스트 (TC-6 ~ TC-8)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-6~8] fl-lint.fl 파싱 및 함수 검증\n");

let lintSrc = "";
let lintInterp: Interpreter | null = null;

test("TC-6: fl-lint.fl 파싱 성공", () => {
  lintSrc = fs.readFileSync(path.join(flFilesDir, "fl-lint.fl"), "utf-8");
  if (!lintSrc || lintSrc.length === 0) throw new Error("빈 파일");
  lintInterp = loadFl(lintSrc);
});

test("TC-7: fl-lint.fl — [MODULE fl-lint] 블록 포함", () => {
  if (!lintSrc.includes("[MODULE fl-lint]")) throw new Error("[MODULE fl-lint] 없음");
});

test("TC-8: fl-lint.fl — check-empty-body 함수 정의됨", () => {
  if (!lintSrc.includes("check-empty-body")) throw new Error("check-empty-body 없음");
  if (!lintInterp) throw new Error("인터프리터 로드 실패");
  if (!hasFn(lintInterp, "check-empty-body")) throw new Error("check-empty-body 함수 미등록");
});

// ──────────────────────────────────────────────────────────
// fl-test.fl 테스트 (TC-9 ~ TC-13)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-9~13] fl-test.fl 파싱 및 함수 검증\n");

let testFlSrc = "";
let testFlInterp: Interpreter | null = null;

test("TC-9: fl-test.fl 파싱 성공", () => {
  testFlSrc = fs.readFileSync(path.join(flFilesDir, "fl-test.fl"), "utf-8");
  if (!testFlSrc || testFlSrc.length === 0) throw new Error("빈 파일");
  testFlInterp = loadFl(testFlSrc);
});

test("TC-10: fl-test.fl — [MODULE fl-test] 블록 포함", () => {
  if (!testFlSrc.includes("[MODULE fl-test]")) throw new Error("[MODULE fl-test] 없음");
});

test("TC-11: fl-test.fl — my-test 함수 정의됨", () => {
  if (!testFlSrc.includes("my-test")) throw new Error("my-test 없음");
  if (!testFlInterp) throw new Error("인터프리터 로드 실패");
  if (!hasFn(testFlInterp, "my-test")) throw new Error("my-test 함수 미등록");
});

test("TC-12: fl-test.fl 로드 후 my-test 호출 가능 (간단 case)", () => {
  if (!testFlInterp) throw new Error("인터프리터 로드 실패");
  const result = evalIn(testFlInterp, `(my-test "simple" (fn [] true))`);
  if (result !== true) throw new Error(`my-test 결과: ${result}, 기대: true`);
});

test("TC-13: fl-test.fl — my-report 호출 가능", () => {
  if (!testFlInterp) throw new Error("인터프리터 로드 실패");
  // my-report는 print를 출력하고 undefined를 반환
  evalIn(testFlInterp, `(my-report)`);
  // 호출 자체가 에러 없이 완료되면 PASS
});

// ──────────────────────────────────────────────────────────
// 유효 문법 검증 (TC-14)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-14] 3개 .fl 파일 모두 유효한 FL 문법\n");

test("TC-14: 3개 .fl 파일 모두 유효한 FL 문법", () => {
  const files = ["fl-fmt.fl", "fl-lint.fl", "fl-test.fl"];
  for (const f of files) {
    const src = fs.readFileSync(path.join(flFilesDir, f), "utf-8");
    // parse 성공 여부로 문법 검증
    const tokens = lex(src);
    const ast = parse(tokens);
    if (!ast || !Array.isArray(ast)) throw new Error(`${f}: AST 생성 실패`);
  }
});

// ──────────────────────────────────────────────────────────
// ;;; 주석 추출 (TC-15 ~ TC-17)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-15~17] ;;; 주석 추출\n");

function extractDocComments(src: string): string[] {
  return src
    .split("\n")
    .filter((line) => line.trim().startsWith(";;;"))
    .map((line) => line.trim().replace(/^;;;\s?/, ""));
}

test("TC-15: fl-fmt.fl ;;; 주석 doc-extractor로 추출 가능", () => {
  const docs = extractDocComments(fmtSrc);
  if (docs.length === 0) throw new Error(";;; 주석이 없음");
  const hasFormatter = docs.some((d) => d.includes("Formatter") || d.includes("포매터") || d.includes("Phase 88"));
  if (!hasFormatter) throw new Error(`관련 주석 없음. 추출된: ${docs.slice(0, 3).join(", ")}`);
});

test("TC-16: fl-lint.fl ;;; 주석 추출", () => {
  const docs = extractDocComments(lintSrc);
  if (docs.length === 0) throw new Error(";;; 주석이 없음");
  const hasLinter = docs.some((d) => d.includes("Linter") || d.includes("린터") || d.includes("Phase 88"));
  if (!hasLinter) throw new Error(`관련 주석 없음. 추출된: ${docs.slice(0, 3).join(", ")}`);
});

test("TC-17: fl-test.fl ;;; 주석 추출", () => {
  const docs = extractDocComments(testFlSrc);
  if (docs.length === 0) throw new Error(";;; 주석이 없음");
  const hasRunner = docs.some((d) => d.includes("Test Runner") || d.includes("테스트") || d.includes("Phase 88"));
  if (!hasRunner) throw new Error(`관련 주석 없음. 추출된: ${docs.slice(0, 3).join(", ")}`);
});

// ──────────────────────────────────────────────────────────
// 자체 호스팅 검증 (TC-18)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-18] 자체 호스팅 검증 — FL 코드가 FL 코드를 분석\n");

test("TC-18: fl-lint.fl로 fl-test.fl lint — FUNC 카운트 > 0", () => {
  // fl-lint.fl의 count-funcs 함수로 fl-test.fl 분석
  const lintI = loadFl(lintSrc);
  const countResult = evalIn(lintI, `(count-funcs ${JSON.stringify(testFlSrc)})`);
  if (typeof countResult !== "number" || countResult <= 0) {
    throw new Error(`count-funcs 결과: ${countResult}, 기대: > 0`);
  }
});

// ──────────────────────────────────────────────────────────
// Phase 56 regression (TC-19)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-19] Phase 56 regression 14/14\n");

// Phase 56 핵심 케이스들 재검증
let reg56Passed = 0;
let reg56Total = 0;

function reg56Test(name: string, fn: () => void) {
  reg56Total++;
  try {
    fn();
    reg56Passed++;
  } catch (e: any) {
    console.log(`    ❌ [reg56] ${name}: ${String(e?.message ?? e).slice(0, 80)}`);
  }
}

// 1. define 격리
reg56Test("함수 내 define이 전역 오염 안 함", () => {
  const interp = new Interpreter();
  interp.interpret(parseReg(lexReg(`
    (define x 10)
    [FUNC set-x :params [$v] :body (define x $v)]
    (set-x 99)
  `)));
  const x = (interp as any).context.variables.get("$x");
  if (x !== 10) throw new Error(`x=${x}`);
});

// 2. 클로저
reg56Test("클로저 캡처", () => {
  const result = run(`
    (define base 100)
    [FUNC add-base :params [$v] :body (+ $v base)]
    (add-base 5)
  `);
  if (result !== 105) throw new Error(`result=${result}`);
});

// 3. set! 전역
reg56Test("set! 전역 변수 수정", () => {
  const interp = new Interpreter();
  interp.interpret(parseReg(lexReg(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `)));
  const counter = (interp as any).context.variables.get("$counter");
  if (counter !== 3) throw new Error(`counter=${counter}`);
});

// 4. 재귀
reg56Test("재귀 함수", () => {
  const result = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 5)
  `);
  if (result !== 120) throw new Error(`result=${result}`);
});

// 5. 고차 함수 (loop 기반)
reg56Test("고차 함수 — 함수 반환", () => {
  const result = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
  if (result !== 17) throw new Error(`result=${result}`);
});

// 6. let 스코프
reg56Test("let 스코프 격리", () => {
  const result = run(`
    (define y 1)
    (let [[y 99]] y)
  `);
  if (result !== 99) throw new Error(`let result=${result}`);
});

// 7. 중첩 함수
reg56Test("중첩 함수 스코프", () => {
  const interp = new Interpreter();
  interp.interpret(parseReg(lexReg(`
    (define result 0)
    [FUNC inner :params [$v] :body (define result (* $v 2))]
    [FUNC outer :params [$v] :body (do (inner $v) (define result (* $v 3)))]
    (outer 5)
  `)));
  const result = (interp as any).context.variables.get("$result");
  if (result !== 0) throw new Error(`result=${result}`);
});

// 8. loop/recur
reg56Test("loop/recur TCO", () => {
  const result = run(`
    (define sum 0)
    (define i 0)
    (loop [[$_ 0]]
      (if (> i 10) sum
        (do
          (set! sum (+ sum i))
          (set! i (+ i 1))
          (recur 0)
        )
      )
    )
  `);
  if (result !== 55) throw new Error(`result=${result}`);
});

// 9. cond
reg56Test("cond 표현식", () => {
  const result = run(`
    (define v 5)
    (cond
      [(< v 0) "음수"]
      [(= v 0) "영"]
      [(> v 0) "양수"]
    )
  `);
  if (result !== "양수") throw new Error(`result=${result}`);
});

// 10. do
reg56Test("do 블록 순서 실행", () => {
  const result = run(`
    (define acc 0)
    (do
      (set! acc (+ acc 1))
      (set! acc (+ acc 2))
      (set! acc (+ acc 3))
      acc
    )
  `);
  if (result !== 6) throw new Error(`result=${result}`);
});

// 11. fn lambda
reg56Test("fn lambda 실행", () => {
  const result = run(`
    (define add (fn [$a $b] (+ $a $b)))
    (add 3 4)
  `);
  if (result !== 7) throw new Error(`result=${result}`);
});

// 12. slice 내장 함수
reg56Test("slice 배열 자르기", () => {
  const result = run(`
    (slice [1 2 3 4 5] 2 4)
  `);
  if (!Array.isArray(result) || result.length !== 2 || result[0] !== 3) throw new Error(`result=${JSON.stringify(result)}`);
});

// 13. match
reg56Test("match 패턴매칭", () => {
  const result = run(`
    (match "hello"
      ("world" "wrong")
      ("hello" "correct")
      (_ "default")
    )
  `);
  if (result !== "correct") throw new Error(`result=${result}`);
});

// 14. string operations
reg56Test("문자열 연산 str/concat/length", () => {
  const result = run(`
    (define s (concat "hello" " " "world"))
    (length s)
  `);
  if (result !== 11) throw new Error(`result=${result}`);
});

// TC-19: Phase 56 regression 14/14
test(`TC-19: Phase 56 regression ${reg56Passed}/14`, () => {
  if (reg56Passed < 14) throw new Error(`${reg56Passed}/14 PASS (${14 - reg56Passed}개 실패)`);
});

// ──────────────────────────────────────────────────────────
// 전체 .fl 파일 수 확인 (TC-20)
// ──────────────────────────────────────────────────────────
console.log("\n[TC-20] fl-files 디렉토리 .fl 파일 수\n");

test("TC-20: fl-files 디렉토리에 3개 .fl 파일 존재", () => {
  const files = fs.readdirSync(flFilesDir).filter((f) => f.endsWith(".fl"));
  if (files.length < 3) throw new Error(`${files.length}개 파일 (기대: 3개 이상): ${files.join(", ")}`);
  const required = ["fl-fmt.fl", "fl-lint.fl", "fl-test.fl"];
  for (const req of required) {
    if (!files.includes(req)) throw new Error(`${req} 없음`);
  }
});

// ──────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 88 자체 호스팅 2.0: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
