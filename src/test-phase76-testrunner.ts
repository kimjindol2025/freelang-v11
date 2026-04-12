// FreeLang v9: Phase 76 — FL 네이티브 테스트 러너 검증
// TC-1: deftest + assert 기본
// TC-2: assert-eq 성공/실패
// TC-3: assert-throws
// TC-4: describe 그룹화
// TC-5: test-report 통계
// TC-6: FL 코드에서 deftest/assert 사용
// TC-7: Phase 56 regression 14/14

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { createTestModule, TestReport } from "./stdlib-test";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}: ${String(e.message ?? e).slice(0, 160)}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEqual"}: got ${a}, expected ${e}`);
}

function assertContains(str: string, sub: string): void {
  if (!str.includes(sub)) throw new Error(`Expected string to contain "${sub}", got: "${str}"`);
}

// 테스트 모듈 생성 헬퍼 (독립적인 callFn mock)
function makeTestModule() {
  // 단순 callable: fn이 JS Function이면 직접 호출, 아니면 noop
  return createTestModule((fn, args) => {
    if (typeof fn === "function") return fn(...args);
    throw new Error(`not callable: ${JSON.stringify(fn)}`);
  });
}

// Interpreter에 테스트 모듈 등록하는 헬퍼
function makeInterp(): Interpreter {
  const interp = new Interpreter();
  interp.registerModule(createTestModule(
    (fn, args) => interp.callFunctionValue(fn, args)
  ));
  return interp;
}

function run(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return interp.context.lastValue;
}

function runFresh(src: string): any {
  const interp = makeInterp();
  interp.interpret(parse(lex(src)));
  return interp.context.lastValue;
}

// ─── TC-1: deftest + assert 기본 ───────────────────────────────────────
console.log("\n[TC-1] deftest + assert 기본");

test("TC-1a: assert true → 예외 없음", () => {
  const m = makeTestModule();
  m["assert"](true);
});

test("TC-1b: assert false → 예외 발생", () => {
  const m = makeTestModule();
  let threw = false;
  try { m["assert"](false); } catch { threw = true; }
  if (!threw) throw new Error("assert(false) should throw");
});

test("TC-1c: deftest pass → true 반환", () => {
  const m = makeTestModule();
  const result = m["deftest"]("my-test", () => {
    m["assert"](1 + 1 === 2);
  });
  assertEqual(result, true);
});

test("TC-1d: deftest fail → false 반환", () => {
  const m = makeTestModule();
  const result = m["deftest"]("bad-test", () => {
    m["assert"](false, "this should fail");
  });
  assertEqual(result, false);
});

// ─── TC-2: assert-eq 성공/실패 ────────────────────────────────────────
console.log("\n[TC-2] assert-eq 성공/실패");

test("TC-2a: assert-eq 같은 값 → 통과", () => {
  const m = makeTestModule();
  m["assert-eq"](42, 42);
});

test("TC-2b: assert-eq 다른 값 → 예외", () => {
  const m = makeTestModule();
  let threw = false;
  try { m["assert-eq"](1, 2); } catch { threw = true; }
  if (!threw) throw new Error("assert-eq(1,2) should throw");
});

test("TC-2c: assert-eq 배열 deep equal", () => {
  const m = makeTestModule();
  m["assert-eq"]([1, 2, 3], [1, 2, 3]);
});

test("TC-2d: assert-eq 배열 다르면 예외", () => {
  const m = makeTestModule();
  let threw = false;
  try { m["assert-eq"]([1, 2], [1, 3]); } catch { threw = true; }
  if (!threw) throw new Error("should throw for unequal arrays");
});

test("TC-2e: assert-neq 다른 값 → 통과", () => {
  const m = makeTestModule();
  m["assert-neq"](1, 2);
});

test("TC-2f: assert-neq 같은 값 → 예외", () => {
  const m = makeTestModule();
  let threw = false;
  try { m["assert-neq"](5, 5); } catch { threw = true; }
  if (!threw) throw new Error("assert-neq(5,5) should throw");
});

// ─── TC-3: assert-throws ──────────────────────────────────────────────
console.log("\n[TC-3] assert-throws");

test("TC-3a: assert-throws — 예외 발생 시 통과", () => {
  const m = makeTestModule();
  m["assert-throws"](() => { throw new Error("boom"); });
});

test("TC-3b: assert-throws — 예외 없으면 실패", () => {
  const m = makeTestModule();
  let threw = false;
  try {
    m["assert-throws"](() => { /* no throw */ });
  } catch { threw = true; }
  if (!threw) throw new Error("assert-throws should fail when no exception");
});

test("TC-3c: assert-throws + expectedMsg 일치", () => {
  const m = makeTestModule();
  m["assert-throws"](() => { throw new Error("division by zero"); }, "division by zero");
});

test("TC-3d: assert-throws + expectedMsg 불일치 → 실패", () => {
  const m = makeTestModule();
  let threw = false;
  try {
    m["assert-throws"](() => { throw new Error("other error"); }, "division by zero");
  } catch { threw = true; }
  if (!threw) throw new Error("should fail when error message doesn't match");
});

// ─── TC-4: describe 그룹화 ────────────────────────────────────────────
console.log("\n[TC-4] describe 그룹화");

test("TC-4a: describe — suite 이름 설정", () => {
  const m = makeTestModule();
  m["describe"]("Math Suite");
  // deftest 이름에 suite/ 포접
  m["deftest"]("add", () => m["assert-eq"](1 + 1, 2));
  const results = m["test-results"]() as any[];
  assertEqual(results.some((r: any) => r.name.includes("Math Suite")), true);
});

test("TC-4b: describe + fn 콜백 실행", () => {
  let called = false;
  const m = makeTestModule();
  m["describe"]("Suite with callback", () => { called = true; });
  assertEqual(called, true);
});

test("TC-4c: 여러 suite 격리", () => {
  const m = makeTestModule();
  m["describe"]("Suite A");
  m["deftest"]("test1", () => m["assert"](true));
  m["describe"]("Suite B");
  m["deftest"]("test2", () => m["assert"](true));

  const results = m["test-results"]() as any[];
  const names = results.map((r: any) => r.name);
  assertEqual(names.some((n: string) => n.includes("Suite A")), true);
  assertEqual(names.some((n: string) => n.includes("Suite B")), true);
});

// ─── TC-5: test-report 통계 ───────────────────────────────────────────
console.log("\n[TC-5] test-report 통계");

test("TC-5a: test-report 기본 통계", () => {
  const m = makeTestModule();
  m["deftest"]("pass1", () => m["assert"](true));
  m["deftest"]("pass2", () => m["assert"](true));
  m["deftest"]("fail1", () => m["assert"](false, "intentional fail"));

  const report = m["test-report"]() as TestReport;
  assertEqual(report.passed, 2);
  assertEqual(report.failed, 1);
  assertEqual(report.total, 3);
});

test("TC-5b: test-reset 후 초기화", () => {
  const m = makeTestModule();
  m["deftest"]("p1", () => m["assert"](true));
  m["test-reset"]();
  m["deftest"]("p2", () => m["assert"](true));

  const report = m["test-report"]() as TestReport;
  assertEqual(report.total, 1);
});

test("TC-5c: test-results 배열 직접 접근", () => {
  const m = makeTestModule();
  m["deftest"]("r1", () => m["assert"](true));
  const results = m["test-results"]() as any[];
  assertEqual(results.length, 1);
  assertEqual(results[0].passed, true);
});

// ─── TC-6: FL 코드에서 deftest 사용 ──────────────────────────────────
console.log("\n[TC-6] FL 코드에서 deftest/assert 사용");

test("TC-6a: FL deftest + assert 기본 사용", () => {
  const interp = makeInterp();
  // FL 코드: deftest와 assert-eq 직접 호출
  run(interp, `
    (deftest "basic-math" (fn [] (assert-eq (+ 1 2) 3)))
  `);
  const lastVal = interp.context.lastValue;
  assertEqual(lastVal, true);
});

test("TC-6b: FL deftest 실패 케이스", () => {
  const interp = makeInterp();
  run(interp, `
    (deftest "fail-case" (fn [] (assert false "intentional")))
  `);
  const lastVal = interp.context.lastValue;
  assertEqual(lastVal, false);
});

test("TC-6c: FL test-report 반환값 확인", () => {
  const interp = makeInterp();
  // test-reset으로 초기화 후 새로 실행
  run(interp, `
    (test-reset)
    (deftest "t1" (fn [] (assert true)))
    (deftest "t2" (fn [] (assert true)))
    (deftest "t3" (fn [] (assert false "fail")))
    (test-report)
  `);
  const report = interp.context.lastValue as TestReport;
  if (!report || typeof report.passed !== "number") {
    throw new Error(`Expected TestReport, got: ${JSON.stringify(report)}`);
  }
  assertEqual(report.passed, 2);
  assertEqual(report.failed, 1);
});

test("TC-6d: FL describe + deftest 그룹화", () => {
  const interp = makeInterp();
  // describe의 fn 콜백 내에서 deftest 실행
  run(interp, `
    (describe "Math" (fn []
      (deftest "add" (fn [] (assert-eq (+ 1 1) 2)))
      (deftest "mul" (fn [] (assert-eq (* 3 3) 9)))
    ))
  `);
  // describe + 내부 deftest 실행 후 크래시 없음
});

// ─── TC-7: Phase 56 regression 14/14 ─────────────────────────────────
console.log("\n[TC-7] Phase 56 Regression (렉시컬 스코프)");

function runLexical(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp.context.lastValue;
}

function runLexicalInterp(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

function getVar56(interp: Interpreter, name: string): any {
  return interp.context.variables.get("$" + name);
}

// TC-7-1: 함수 내 define이 전역 오염 안 함
test("TC-7-1: 함수 내 define이 전역 오염 안 함", () => {
  const interp = runLexicalInterp(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
  const x = getVar56(interp, "x");
  if (x !== 10) throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});

// TC-7-2: 함수 내 define 변수가 외부에 보이지 않음
test("TC-7-2: 함수 내 define 변수는 함수 실행 후 사라짐", () => {
  const interp = runLexicalInterp(`
    [FUNC make-local :params [] :body (define inner 42)]
    (make-local)
  `);
  const inner = getVar56(interp, "inner");
  if (inner !== undefined && inner !== null)
    throw new Error(`$inner가 외부에 보임: ${inner}`);
});

// TC-7-3: 재귀 팩토리얼
test("TC-7-3: 재귀 팩토리얼 — 스코프 간섭 없음", () => {
  const res = runLexical(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
  assertEqual(res, 720);
});

// TC-7-4: 재귀 피보나치
test("TC-7-4: 재귀 피보나치 — 중첩 호출 격리", () => {
  const res = runLexical(`
    [FUNC fib :params [$n]
      :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
    (fib 10)
  `);
  assertEqual(res, 55);
});

// TC-7-5: 클로저 환경 캡처
test("TC-7-5: fn 클로저가 정의 시점 환경을 캡처", () => {
  const res = runLexical(`
    (define base 100)
    (define add-base (fn [$x] (+ $x $base)))
    (add-base 5)
  `);
  assertEqual(res, 105);
});

// TC-7-6: 고차 함수 클로저 반환
test("TC-7-6: 고차 함수 — 클로저 반환", () => {
  const res = runLexical(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
  assertEqual(res, 17);
});

// TC-7-7: set! 상위 스코프 수정
test("TC-7-7: set!이 전역 $counter를 누적 수정", () => {
  const interp = runLexicalInterp(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `);
  const counter = getVar56(interp, "counter");
  if (counter !== 3) throw new Error(`got ${counter}`);
});

// TC-7-8: loop 바인딩이 외부 스코프 오염 안 함
test("TC-7-8: loop 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runLexicalInterp(`
    (define i 999)
    (loop [i 0]
      (if (>= $i 3) $i (recur (+ $i 1))))
  `);
  const i = getVar56(interp, "i");
  if (i !== 999) throw new Error(`전역 $i가 ${i}로 변경됨 (999여야 함)`);
});

// TC-7-9: loop/recur 결과값
test("TC-7-9: loop/recur 결과값 정상", () => {
  const res = runLexical(`
    (loop [acc 0 n 5]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  assertEqual(res, 15);
});

// TC-7-10: let 바인딩 격리
test("TC-7-10: let 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runLexicalInterp(`
    (define y 77)
    (let [[$y 42]] $y)
  `);
  const y = getVar56(interp, "y");
  if (y !== 77) throw new Error(`전역 $y가 ${y}로 변경됨 (77이어야 함)`);
});

// TC-7-11: do 블록
test("TC-7-11: do 블록 마지막 값 반환", () => {
  assertEqual(runLexical("(do 1 2 3)"), 3);
});

// TC-7-12: list 생성
test("TC-7-12: list 생성", () => {
  const result = runLexical("(list 1 2 3)");
  assertEqual(Array.isArray(result), true);
  assertEqual(result.length, 3);
});

// TC-7-13: if 표현식
test("TC-7-13: if 참/거짓 분기", () => {
  assertEqual(runLexical("(if true 10 20)"), 10);
  assertEqual(runLexical("(if false 10 20)"), 20);
});

// TC-7-14: 기본 산술
test("TC-7-14: 기본 산술 + 중첩 FUNC", () => {
  const res = runLexical(`
    [FUNC sq :params [$x] :body (* $x $x)]
    (+ (sq 3) (sq 4))
  `);
  assertEqual(res, 25);
});

// ─── 결과 ────────────────────────────────────────────────────────────
console.log(`\n[Phase 76 FL 네이티브 테스트 러너]\n결과: ${passed}/${passed + failed} 통과${failed > 0 ? ` (${failed}개 실패)` : ""}`);
if (failed > 0) process.exit(1);
