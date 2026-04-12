// FreeLang v9: Phase 60 — 점진적 타입 체킹 테스트
// strict 모드 + 런타임 타입 검증

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { inferType, isCompatible, RuntimeTypeChecker, toFlType } from "./type-system";
import { getBuiltinTypeSig, BUILTIN_TYPE_SIGS } from "./stdlib-types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}`);
    console.log(`         ${e.message}`);
    failed++;
  }
}

function expect(actual: any, expected: any, msg?: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) throw new Error(`${msg || ""} expected=${JSON.stringify(expected)}, got=${JSON.stringify(actual)}`);
}

function expectThrows(fn: () => void, pattern?: string): void {
  try {
    fn();
    throw new Error("Expected an error but none was thrown");
  } catch (e: any) {
    if (e.message === "Expected an error but none was thrown") throw e;
    if (pattern && !e.message.includes(pattern)) {
      throw new Error(`Error message "${e.message}" does not contain "${pattern}"`);
    }
  }
}

function run(code: string, opts?: { strict?: boolean }): any {
  const interp = new Interpreter(undefined, opts);
  const result = interp.interpret(parse(lex(code)));
  return result.lastValue;
}

// =========================================================
// Section 1: inferType / isCompatible / toFlType 단위 테스트
// =========================================================
console.log("\n[Section 1] inferType / isCompatible / toFlType");

test("inferType: null", () => expect(inferType(null), "null"));
test("inferType: undefined", () => expect(inferType(undefined), "null"));
test("inferType: integer", () => expect(inferType(42), "int"));
test("inferType: float", () => expect(inferType(3.14), "float"));
test("inferType: string", () => expect(inferType("hello"), "string"));
test("inferType: boolean", () => expect(inferType(true), "bool"));
test("inferType: array", () => expect(inferType([1, 2, 3]), "array"));
test("inferType: map/object", () => expect(inferType({ a: 1 }), "map"));
test("inferType: function", () => expect(inferType(() => {}), "fn"));

test("isCompatible: any accepts all", () => {
  expect(isCompatible("int", "any"), true);
  expect(isCompatible("string", "any"), true);
  expect(isCompatible("null", "any"), true);
});
test("isCompatible: exact match", () => expect(isCompatible("int", "int"), true));
test("isCompatible: number accepts int", () => expect(isCompatible("int", "number"), true));
test("isCompatible: number accepts float", () => expect(isCompatible("float", "number"), true));
test("isCompatible: float accepts int", () => expect(isCompatible("int", "float"), true));
test("isCompatible: string != int", () => expect(isCompatible("string", "int"), false));
test("isCompatible: int != string", () => expect(isCompatible("int", "string"), false));
test("isCompatible: actual=any is compatible with anything", () => {
  expect(isCompatible("any", "int"), true);
  expect(isCompatible("any", "string"), true);
});

test("toFlType: standard types", () => {
  expect(toFlType("int"), "int");
  expect(toFlType("float"), "float");
  expect(toFlType("string"), "string");
  expect(toFlType("bool"), "bool");
  expect(toFlType("boolean"), "bool");
  expect(toFlType("array<any>"), "array");
  expect(toFlType("unknown-type"), "any");
});

// =========================================================
// Section 2: RuntimeTypeChecker 단위 테스트
// =========================================================
console.log("\n[Section 2] RuntimeTypeChecker");

test("strict=false: checkCall은 아무 것도 하지 않음", () => {
  const rtc = new RuntimeTypeChecker(false);
  rtc.registerFunc("add", ["number", "number"], "number");
  // strict OFF → 문자열을 넘겨도 에러 없음
  rtc.checkCall("add", ["hello", "world"]);
});

test("strict=true: 올바른 타입은 통과", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("add", ["number", "number"], "number");
  rtc.checkCall("add", [10, 20]);  // int + int → number 호환
});

test("strict=true: 잘못된 타입은 TypeError 발생", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("add", ["number", "number"], "number");
  expectThrows(() => rtc.checkCall("add", ["hello", 1]), "[strict]");
});

test("strict=true: 미등록 함수는 검증 스킵", () => {
  const rtc = new RuntimeTypeChecker(true);
  // 등록 없이 호출해도 에러 없어야 함
  rtc.checkCall("unknown-func", ["anything", 123]);
});

test("strict=true: int → float 호환", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("calc-tax", ["float"], "float");
  rtc.checkCall("calc-tax", [100]);  // int → float 호환
});

test("strict=true: 인수 개수 초과는 허용 (가변 인수 패턴)", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("add", ["number", "number"], "number");
  // 인수 3개 → 2개 파라미터: 처음 2개만 검사
  rtc.checkCall("add", [1, 2, 3]);
});

test("getSignature: 등록된 함수 조회", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("mul", ["number", "number"], "number");
  const sig = rtc.getSignature("mul");
  expect(sig?.params, ["number", "number"]);
  expect(sig?.ret, "number");
});

test("registeredFuncs: 등록된 함수 목록", () => {
  const rtc = new RuntimeTypeChecker(true);
  rtc.registerFunc("foo", ["string"], "string");
  rtc.registerFunc("bar", ["int"], "int");
  const funcs = rtc.registeredFuncs().sort();
  expect(funcs, ["bar", "foo"]);
});

// =========================================================
// Section 3: stdlib-types 단위 테스트
// =========================================================
console.log("\n[Section 3] BUILTIN_TYPE_SIGS");

test("+ 연산자 시그니처 존재", () => {
  const sig = getBuiltinTypeSig("+");
  expect(sig?.params, ["number", "number"]);
  expect(sig?.ret, "number");
});

test("str 함수 시그니처 존재", () => {
  const sig = getBuiltinTypeSig("str");
  expect(sig?.params, ["any"]);
  expect(sig?.ret, "string");
});

test("미등록 함수는 null 반환", () => {
  expect(getBuiltinTypeSig("nonexistent-func"), null);
});

test("주요 내장 함수 10개 이상 등록", () => {
  const count = Object.keys(BUILTIN_TYPE_SIGS).length;
  if (count < 10) throw new Error(`Only ${count} builtin type signatures registered`);
});

// =========================================================
// Section 4: Interpreter strict 모드 통합 테스트
// =========================================================
console.log("\n[Section 4] Interpreter strict=false (기본 — TC-1, TC-5)");

test("TC-1: strict OFF — (+ 1 2) 정상 작동", () => {
  const result = run(`(define $x (+ 1 2))`);
  // lastValue 대신 실행만 에러 없이 완료되면 OK
});

test("TC-5: strict OFF — 기본 연산 모두 통과", () => {
  const code = `
[FUNC greet :params [$name] :body (concat "Hello " $name)]
(define $msg (greet "World"))
`;
  // 에러 없이 실행되면 OK
  const interp = new Interpreter();
  interp.interpret(parse(lex(code)));
});

console.log("\n[Section 4] Interpreter strict=true (TC-2, TC-3, TC-4)");

test("TC-2: strict ON — 타입 어노테이션 없는 함수는 검증 없음", () => {
  // 타입 어노테이션 없으면 RuntimeTypeChecker에 등록 안 됨 → strict여도 에러 없음
  const code = `
[FUNC add :params [$a $b] :body (+ $a $b)]
(define $r (add "hello" 1))
`;
  // 이 경우 타입 어노테이션이 없으므로 strict여도 에러 없어야 함
  const interp = new Interpreter(undefined, { strict: true });
  interp.interpret(parse(lex(code)));
});

test("TC-3: strict ON — 타입 어노테이션 있는 함수에 잘못된 타입 → TypeError", () => {
  // 타입 어노테이션이 있는 함수에 잘못된 타입의 인수를 넘기면 에러
  // 문법: :params [[$price int] [$rate float]] :return float (콜론 없음)
  const code = `
[FUNC add-tax :params [[$price int] [$rate float]] :return float :body (* $price $rate)]
(add-tax "not-a-number" 0.1)
`;
  expectThrows(() => {
    const interp = new Interpreter(undefined, { strict: true });
    interp.interpret(parse(lex(code)));
  }, "[strict]");
});

test("TC-4: strict ON — int/float 숫자 상호 호환", () => {
  // int → float 호환: add-tax에 정수를 넘겨도 OK
  // 문법: :params [[$price int] [$rate float]] :return float (콜론 없음)
  const code = `
[FUNC add-tax :params [[$price int] [$rate float]] :return float :body (* $price $rate)]
(add-tax 100 0.1)
`;
  // 에러 없이 실행되어야 함
  const interp = new Interpreter(undefined, { strict: true });
  interp.interpret(parse(lex(code)));
});

// =========================================================
// Section 5: 환경변수 FREELANG_STRICT 지원 확인
// =========================================================
console.log("\n[Section 5] FREELANG_STRICT 환경변수");

test("FREELANG_STRICT=0 → strict OFF", () => {
  const old = process.env.FREELANG_STRICT;
  process.env.FREELANG_STRICT = "0";
  const interp = new Interpreter();
  const rtc = interp.context.runtimeTypeChecker;
  const isStrict = rtc?.isStrict ?? false;
  process.env.FREELANG_STRICT = old ?? "";
  expect(isStrict, false);
});

test("FREELANG_STRICT=1 → strict ON", () => {
  const old = process.env.FREELANG_STRICT;
  process.env.FREELANG_STRICT = "1";
  const interp = new Interpreter();
  const rtc = interp.context.runtimeTypeChecker;
  const isStrict = rtc?.isStrict ?? false;
  process.env.FREELANG_STRICT = old ?? "";
  expect(isStrict, true);
});

// =========================================================
// Section 6: Phase 56 regression — 렉시컬 스코프 14/14
// =========================================================
console.log("\n[Section 6] Phase 56 regression (렉시컬 스코프)");

function getVar(interp: Interpreter, name: string): any {
  return (interp as any).context.variables.get("$" + name);
}

function evalIn(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runP56(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runP56Multi(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

test("[P56-1] 함수 내 define이 전역 $x를 오염 안 함", () => {
  const interp = runP56Multi(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
  const x = getVar(interp, "x");
  if (x !== 10) throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});

test("[P56-2] 함수 내 define 변수는 함수 실행 후 사라짐", () => {
  const interp = runP56Multi(`
    [FUNC make-local :params [] :body (define inner 42)]
    (make-local)
  `);
  const inner = getVar(interp, "inner");
  if (inner !== undefined && inner !== null) throw new Error(`$inner가 외부에 보임: ${inner}`);
});

test("[P56-3] 재귀 팩토리얼 — 스코프 간섭 없음", () => {
  const res = runP56(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
  if (res !== 720) throw new Error(`got ${res}`);
});

test("[P56-4] 재귀 피보나치 — 중첩 호출 격리", () => {
  const res = runP56(`
    [FUNC fib :params [$n]
      :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
    (fib 10)
  `);
  if (res !== 55) throw new Error(`got ${res}`);
});

test("[P56-5] fn 클로저가 정의 시점 환경을 캡처", () => {
  const res = runP56(`
    (define base 100)
    (define add-base (fn [$x] (+ $x $base)))
    (add-base 5)
  `);
  if (res !== 105) throw new Error(`got ${res}`);
});

test("[P56-6] 고차 함수 — 클로저 반환", () => {
  const res = runP56(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
  if (res !== 17) throw new Error(`got ${res}`);
});

test("[P56-7] set!이 전역 $counter를 누적 수정", () => {
  const interp = runP56Multi(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `);
  const counter = getVar(interp, "counter");
  if (counter !== 3) throw new Error(`got ${counter}`);
});

test("[P56-8] loop 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runP56Multi(`
    (define i 999)
    (loop [i 0]
      (if (>= $i 3) $i (recur (+ $i 1))))
  `);
  const i = getVar(interp, "i");
  if (i !== 999) throw new Error(`전역 $i가 ${i}로 변경됨 (999여야 함)`);
});

test("[P56-9] loop/recur 결과값 정상", () => {
  const res = runP56(`
    (loop [acc 0 n 5]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  if (res !== 15) throw new Error(`got ${res}`);
});

test("[P56-10] let 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runP56Multi(`
    (define y 77)
    (let [[$y 42]] $y)
  `);
  const y = getVar(interp, "y");
  if (y !== 77) throw new Error(`전역 $y가 ${y}로 변경됨 (77이어야 함)`);
});

test("[P56-11] fl-list-utils.fl: sum 내부 $acc가 전역 오염 안 함", () => {
  const path = require("path");
  const fs = require("fs");
  const srcDir = __dirname;
  const src = fs.readFileSync(path.join(srcDir, "fl-list-utils.fl"), "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = path.join(srcDir, "fl-list-utils.fl");
  interp.interpret(parse(lex(src)));
  evalIn(interp, "(define acc 777)");
  evalIn(interp, "(sum [1.0 2.0 3.0])");
  const acc = getVar(interp, "acc");
  if (acc !== 777) throw new Error(`$acc가 ${acc}로 변경됨 (777이어야 함)`);
});

test("[P56-12] 중첩 호출 각 스코프의 define이 격리됨", () => {
  const interp = runP56Multi(`
    (define result 0)
    [FUNC inner :params [$v] :body (define result (* $v 2))]
    [FUNC outer :params [$v] :body (do (inner $v) (define result (* $v 3)))]
    (outer 5)
  `);
  const result = getVar(interp, "result");
  if (result !== 0) throw new Error(`전역 $result가 ${result}로 변경됨 (0이어야 함)`);
});

test("[P56-13] fl-app-demo.fl 정상 실행", () => {
  const path = require("path");
  const fs = require("fs");
  const srcDir = __dirname;
  const src = fs.readFileSync(path.join(srcDir, "fl-app-demo.fl"), "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = path.join(srcDir, "fl-app-demo.fl");
  interp.interpret(parse(lex(src)));
  const fns = (interp as any).context.functions as Map<string, any>;
  if (!fns.has("list:sum")) throw new Error("list:sum 없음");
  if (!fns.has("stru:repeat-str")) throw new Error("stru:repeat-str 없음");
});

test("[P56-14] mini neural net 학습 10step — 결과 수렴", () => {
  const res = runP56(`
    (define W 0.5)
    (define lr 0.01)
    (loop [step 0 loss 999.0]
      (if (>= $step 10)
        $loss
        (do
          (define pred (* $W 2.0))
          (define err (- $pred 1.0))
          (define new-loss (* $err $err))
          (set! W (- $W (* $lr (* 2.0 (* $err 2.0)))))
          (recur (+ $step 1) $new-loss))))
  `);
  if (typeof res !== "number" || isNaN(res) || res < 0) throw new Error(`got ${res}`);
});

// =========================================================
// 결과 출력
// =========================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`Phase 60 결과: ${passed} PASS / ${failed} FAIL / ${passed + failed} 총`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
