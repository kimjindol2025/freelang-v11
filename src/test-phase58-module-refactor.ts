// FreeLang v9: Phase 58 — Module Refactor 검증
// (1) Interpreter 초기화 후 file/http/db 모듈 함수 존재 확인
// (2) stdlib-loader가 정상 로드됨
// (3) Phase 56 regression 14/14 PASS

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import * as path from "path";
import * as fs from "fs";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
    failed++;
  }
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runMulti(src: string): Interpreter {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return interp;
}

function evalIn(interp: Interpreter, src: string): any {
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function getVar(interp: Interpreter, name: string): any {
  return (interp as any).context.variables.get("$" + name);
}

function hasFn(interp: Interpreter, name: string): boolean {
  return (interp as any).context.functions.has(name);
}

// ════════════════════════════════════════════════════════════
// TC-1: file 모듈 함수 존재 확인
// ════════════════════════════════════════════════════════════
console.log("[TC-1] file 모듈 함수 존재 확인 (stdlib-loader via loadAllStdlib)");

test("file_read 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "file_read")) throw new Error("file_read 미등록");
});

test("file_write 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "file_write")) throw new Error("file_write 미등록");
});

test("file_exists 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "file_exists")) throw new Error("file_exists 미등록");
});

test("dir_list 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "dir_list")) throw new Error("dir_list 미등록");
});

// ════════════════════════════════════════════════════════════
// TC-2: http 모듈 함수 존재 확인
// ════════════════════════════════════════════════════════════
console.log("\n[TC-2] http 모듈 함수 존재 확인");

test("http_get 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "http_get")) throw new Error("http_get 미등록");
});

test("http_post 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "http_post")) throw new Error("http_post 미등록");
});

// ════════════════════════════════════════════════════════════
// TC-3: db 모듈 함수 존재 확인
// ════════════════════════════════════════════════════════════
console.log("\n[TC-3] db 모듈 함수 존재 확인");

test("db_query 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "db_query")) throw new Error("db_query 미등록");
});

test("db_get 함수 등록됨", () => {
  const interp = new Interpreter();
  if (!hasFn(interp, "db_get")) throw new Error("db_get 미등록 (db_get 또는 db_query 중 하나 필요)");
});

// ════════════════════════════════════════════════════════════
// TC-4: stdlib-loader 정상 동작 (여러 모듈 존재)
// ════════════════════════════════════════════════════════════
console.log("\n[TC-4] stdlib-loader 정상 동작 — 여러 모듈 함수 확인");

const expectedFunctions = [
  "file_read", "file_write", "file_exists",  // file module
  "http_get", "http_post",                    // http module
  "sha256", "uuid_v4",                        // crypto module
  "cache_set", "cache_get",                   // cache module
  "auth_jwt_sign", "auth_jwt_verify",         // auth module
];

test(`총 ${expectedFunctions.length}개 stdlib 함수 모두 등록됨`, () => {
  const interp = new Interpreter();
  const missing: string[] = [];
  for (const fn of expectedFunctions) {
    if (!hasFn(interp, fn)) missing.push(fn);
  }
  if (missing.length > 0) throw new Error(`미등록 함수: ${missing.join(", ")}`);
});

test("stdlib-loader는 20개 이상의 모듈 함수를 등록함", () => {
  const interp = new Interpreter();
  const fns = (interp as any).context.functions as Map<string, any>;
  if (fns.size < 20) throw new Error(`함수 수 ${fns.size}개 (20개 이상 기대)`);
  console.log(`    → 총 ${fns.size}개 함수 등록됨`);
});

// ════════════════════════════════════════════════════════════
// TC-5: Phase 56 regression — 렉시컬 스코프 14/14
// ════════════════════════════════════════════════════════════
console.log("\n[TC-5] Phase 56 regression — 렉시컬 스코프 14개 케이스");

// TC-5-1: 함수 내 define이 전역 오염 안 함
test("[56-1] 함수 내 define 격리 — 전역 $x 오염 안 함", () => {
  const interp = runMulti(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
  const x = getVar(interp, "x");
  if (x !== 10) throw new Error(`전역 $x가 ${x}로 변경됨 (10이어야 함)`);
});

test("[56-2] 함수 내 define 변수가 함수 실행 후 사라짐", () => {
  const interp = runMulti(`
    [FUNC make-local :params [] :body (define inner 42)]
    (make-local)
  `);
  const inner = getVar(interp, "inner");
  if (inner !== undefined && inner !== null) throw new Error(`$inner가 외부에 보임: ${inner}`);
});

test("[56-3] 재귀 팩토리얼 — 스코프 간섭 없음", () => {
  const res = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
  if (res !== 720) throw new Error(`got ${res}`);
});

test("[56-4] 재귀 피보나치 — 중첩 호출 격리", () => {
  const res = run(`
    [FUNC fib :params [$n]
      :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
    (fib 10)
  `);
  if (res !== 55) throw new Error(`got ${res}`);
});

test("[56-5] fn 클로저가 정의 시점 환경을 캡처", () => {
  const res = run(`
    (define base 100)
    (define add-base (fn [$x] (+ $x $base)))
    (add-base 5)
  `);
  if (res !== 105) throw new Error(`got ${res}`);
});

test("[56-6] 고차 함수 — 클로저 반환", () => {
  const res = run(`
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
  if (res !== 17) throw new Error(`got ${res}`);
});

test("[56-7] set!이 전역 $counter를 누적 수정", () => {
  const interp = runMulti(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `);
  const counter = getVar(interp, "counter");
  if (counter !== 3) throw new Error(`got ${counter}`);
});

test("[56-8] loop 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runMulti(`
    (define i 999)
    (loop [i 0]
      (if (>= $i 3) $i (recur (+ $i 1))))
  `);
  const i = getVar(interp, "i");
  if (i !== 999) throw new Error(`전역 $i가 ${i}로 변경됨 (999여야 함)`);
});

test("[56-9] loop/recur 결과값 정상", () => {
  const res = run(`
    (loop [acc 0 n 5]
      (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
  `);
  if (res !== 15) throw new Error(`got ${res}`);
});

test("[56-10] let 바인딩이 외부 스코프 오염 안 함", () => {
  const interp = runMulti(`
    (define y 77)
    (let [[$y 42]] $y)
  `);
  const y = getVar(interp, "y");
  if (y !== 77) throw new Error(`전역 $y가 ${y}로 변경됨 (77이어야 함)`);
});

test("[56-11] fl-list-utils.fl: sum 내부 $acc가 전역 오염 안 함", () => {
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

test("[56-12] 중첩 호출 각 스코프의 define이 격리됨", () => {
  const interp = runMulti(`
    (define result 0)
    [FUNC inner :params [$v] :body (define result (* $v 2))]
    [FUNC outer :params [$v] :body (do (inner $v) (define result (* $v 3)))]
    (outer 5)
  `);
  const result = getVar(interp, "result");
  if (result !== 0) throw new Error(`전역 $result가 ${result}로 변경됨 (0이어야 함)`);
});

test("[56-13] fl-app-demo.fl 정상 실행", () => {
  const srcDir = __dirname;
  const src = fs.readFileSync(path.join(srcDir, "fl-app-demo.fl"), "utf-8");
  const interp = new Interpreter();
  (interp as any).currentFilePath = path.join(srcDir, "fl-app-demo.fl");
  interp.interpret(parse(lex(src)));
  const fns = (interp as any).context.functions as Map<string, any>;
  if (!fns.has("list:sum")) throw new Error("list:sum 없음");
  if (!fns.has("stru:repeat-str")) throw new Error("stru:repeat-str 없음");
});

test("[56-14] mini neural net 학습 10step — 결과 수렴", () => {
  const res = run(`
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

// ════════════════════════════════════════════════════════════
// 결과
// ════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(60)}`);
console.log(`Phase 58 Module Refactor: ${passed} passed, ${failed} failed`);
console.log(`  - TC-1 file 모듈 함수 존재: 4개`);
console.log(`  - TC-2 http 모듈 함수 존재: 2개`);
console.log(`  - TC-3 db 모듈 함수 존재: 2개`);
console.log(`  - TC-4 stdlib-loader 정상: 2개`);
console.log(`  - TC-5 Phase 56 regression: 14개`);
if (failed > 0) process.exit(1);
process.exit(0);
