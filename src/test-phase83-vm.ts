// FreeLang v9 Phase 83: 바이트코드 VM 테스트

import { OpCode, Chunk } from "./bytecode";
import { BytecodeCompiler } from "./compiler";
import { VM } from "./vm";
import { ASTNode, Literal, Variable, SExpr } from "./ast";

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function lit(value: string | number | boolean | null, type?: "number" | "string" | "boolean" | "null" | "symbol"): Literal {
  if (type) return { kind: "literal", type, value };
  if (typeof value === "number") return { kind: "literal", type: "number", value };
  if (typeof value === "boolean") return { kind: "literal", type: "boolean", value };
  if (value === null) return { kind: "literal", type: "null", value: null };
  return { kind: "literal", type: "string", value };
}

function varNode(name: string): Variable {
  return { kind: "variable", name };
}

function sexpr(op: string, ...args: ASTNode[]): SExpr {
  return { kind: "sexpr", op, args };
}

// ─── 테스트 인프라 ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name} — ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(a: any, b: any, msg?: string): void {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) throw new Error(msg ?? `기대값: ${JSON.stringify(b)}, 실제: ${JSON.stringify(a)}`);
}

// ─── 컴파일+실행 단축 함수 ─────────────────────────────────────────────────

function run(node: ASTNode): any {
  const compiler = new BytecodeCompiler();
  const chunk = compiler.compile(node);
  const vm = new VM();
  return vm.run(chunk);
}

// ─── TC-1: 상수 컴파일 ─────────────────────────────────────────────────────
console.log("\n[TC-1] 상수 컴파일 PUSH_CONST 42");
test("숫자 상수 42 컴파일 & 실행", () => {
  const result = run(lit(42));
  assertEqual(result, 42, `기대 42, 실제 ${result}`);
});

// ─── TC-2: 변수 SET/GET ────────────────────────────────────────────────────
console.log("\n[TC-2] 변수 SET/GET");
test("define + 변수 참조", () => {
  const compiler = new BytecodeCompiler();
  const chunk = compiler.compile(
    sexpr("do",
      sexpr("define", varNode("x"), lit(99)),
      varNode("x")
    )
  );
  const vm = new VM();
  const result = vm.run(chunk);
  assertEqual(result, 99, `기대 99, 실제 ${result}`);
});

// ─── TC-3: 덧셈 ────────────────────────────────────────────────────────────
console.log("\n[TC-3] 덧셈 (+ 1 2) → 3");
test("(+ 1 2) = 3", () => {
  const result = run(sexpr("+", lit(1), lit(2)));
  assertEqual(result, 3);
});

// ─── TC-4: 뺄셈, 곱셈, 나눗셈 ─────────────────────────────────────────────
console.log("\n[TC-4] 뺄셈/곱셈/나눗셈");
test("(- 10 4) = 6", () => {
  assertEqual(run(sexpr("-", lit(10), lit(4))), 6);
});
test("(* 3 7) = 21", () => {
  assertEqual(run(sexpr("*", lit(3), lit(7))), 21);
});
test("(/ 20 4) = 5", () => {
  assertEqual(run(sexpr("/", lit(20), lit(4))), 5);
});
test("(% 10 3) = 1", () => {
  assertEqual(run(sexpr("%", lit(10), lit(3))), 1);
});

// ─── TC-5: 비교 ────────────────────────────────────────────────────────────
console.log("\n[TC-5] 비교 (< 1 2) → true");
test("(< 1 2) = true", () => {
  assertEqual(run(sexpr("<", lit(1), lit(2))), true);
});
test("(> 5 3) = true", () => {
  assertEqual(run(sexpr(">", lit(5), lit(3))), true);
});
test("(== 4 4) = true", () => {
  assertEqual(run(sexpr("==", lit(4), lit(4))), true);
});

// ─── TC-6: if 표현식 true 분기 ────────────────────────────────────────────
console.log("\n[TC-6] if 표현식 true 분기");
test("(if true 1 2) = 1", () => {
  const result = run(sexpr("if", lit(true, "boolean"), lit(1), lit(2)));
  assertEqual(result, 1);
});

// ─── TC-7: if 표현식 false 분기 ───────────────────────────────────────────
console.log("\n[TC-7] if 표현식 false 분기");
test("(if false 1 2) = 2", () => {
  const result = run(sexpr("if", lit(false, "boolean"), lit(1), lit(2)));
  assertEqual(result, 2);
});

// ─── TC-8: define + 참조 ──────────────────────────────────────────────────
console.log("\n[TC-8] define + 참조");
test("define $n 10 → $n = 10", () => {
  const compiler = new BytecodeCompiler();
  const chunk = compiler.compile(
    sexpr("do",
      sexpr("define", varNode("n"), lit(10)),
      varNode("n")
    )
  );
  const vm = new VM();
  const result = vm.run(chunk);
  assertEqual(result, 10);
});

// ─── TC-9: do 블록 ────────────────────────────────────────────────────────
console.log("\n[TC-9] do 블록");
test("(do 1 2 3) = 3 (마지막 값)", () => {
  const result = run(sexpr("do", lit(1), lit(2), lit(3)));
  assertEqual(result, 3);
});

// ─── TC-10: Chunk 구조 확인 ───────────────────────────────────────────────
console.log("\n[TC-10] Chunk 구조 확인");
test("Chunk에 instructions, constants, name 필드 존재", () => {
  const compiler = new BytecodeCompiler();
  const chunk = compiler.compile(lit(42));
  assert(Array.isArray(chunk.instructions), "instructions는 배열이어야 함");
  assert(Array.isArray(chunk.constants), "constants는 배열이어야 함");
  assert(typeof chunk.name === "string", "name은 문자열이어야 함");
});

// ─── TC-11: OpCode 열거형 존재 확인 ──────────────────────────────────────
console.log("\n[TC-11] OpCode 열거형 존재 확인");
test("OpCode 열거형 주요 값 존재", () => {
  assert(OpCode.PUSH_CONST !== undefined, "PUSH_CONST 없음");
  assert(OpCode.PUSH_VAR !== undefined, "PUSH_VAR 없음");
  assert(OpCode.SET_VAR !== undefined, "SET_VAR 없음");
  assert(OpCode.ADD !== undefined, "ADD 없음");
  assert(OpCode.HALT !== undefined, "HALT 없음");
  assert(OpCode.JUMP !== undefined, "JUMP 없음");
  assert(OpCode.JUMP_IF_FALSE !== undefined, "JUMP_IF_FALSE 없음");
  assert(OpCode.MAKE_LIST !== undefined, "MAKE_LIST 없음");
});

// ─── TC-12: VM.stack 초기 빈 배열 ─────────────────────────────────────────
console.log("\n[TC-12] VM.stack 초기 빈 배열");
test("새 VM 인스턴스의 stack은 빈 배열", () => {
  const vm = new VM();
  assert(Array.isArray(vm.stack), "stack은 배열이어야 함");
  assertEqual(vm.stack.length, 0, "초기 stack 길이는 0이어야 함");
});

// ─── TC-13: HALT → run 종료 ───────────────────────────────────────────────
console.log("\n[TC-13] HALT → run 종료");
test("HALT 명령 실행 시 정상 종료 (예외 없음)", () => {
  const compiler = new BytecodeCompiler();
  // 직접 HALT 청크 만들기
  const chunk: Chunk = {
    name: "halt-test",
    constants: [42],
    instructions: [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.HALT },
    ],
  };
  const vm = new VM();
  const result = vm.run(chunk);
  assertEqual(result, 42);
});

// ─── TC-14: 중첩 산술 ─────────────────────────────────────────────────────
console.log("\n[TC-14] 중첩 산술 (+ (* 2 3) 4) → 10");
test("(+ (* 2 3) 4) = 10", () => {
  const result = run(sexpr("+", sexpr("*", lit(2), lit(3)), lit(4)));
  assertEqual(result, 10);
});

// ─── TC-15: 논리 AND ──────────────────────────────────────────────────────
console.log("\n[TC-15] 논리 AND");
test("(and true true) = true", () => {
  const result = run(sexpr("and", lit(true, "boolean"), lit(true, "boolean")));
  assertEqual(result, true);
});
test("(and true false) = false", () => {
  const result = run(sexpr("and", lit(true, "boolean"), lit(false, "boolean")));
  assertEqual(result, false);
});

// ─── TC-16: 논리 OR ───────────────────────────────────────────────────────
console.log("\n[TC-16] 논리 OR");
test("(or false true) = true", () => {
  const result = run(sexpr("or", lit(false, "boolean"), lit(true, "boolean")));
  assertEqual(result, true);
});
test("(or false false) = false", () => {
  const result = run(sexpr("or", lit(false, "boolean"), lit(false, "boolean")));
  assertEqual(result, false);
});

// ─── TC-17: NOT ───────────────────────────────────────────────────────────
console.log("\n[TC-17] NOT");
test("(not true) = false", () => {
  assertEqual(run(sexpr("not", lit(true, "boolean"))), false);
});
test("(not false) = true", () => {
  assertEqual(run(sexpr("not", lit(false, "boolean"))), true);
});

// ─── TC-18: MAKE_LIST ─────────────────────────────────────────────────────
console.log("\n[TC-18] MAKE_LIST — 배열 생성");
test("(list 1 2 3) = [1, 2, 3]", () => {
  const result = run(sexpr("list", lit(1), lit(2), lit(3)));
  assertEqual(result, [1, 2, 3]);
});

// ─── TC-19: 연속 define + 참조 ────────────────────────────────────────────
console.log("\n[TC-19] 연속 define + 참조");
test("define $a 5, define $b 3, (+ $a $b) = 8", () => {
  const compiler = new BytecodeCompiler();
  const chunk = compiler.compile(
    sexpr("do",
      sexpr("define", varNode("a"), lit(5)),
      sexpr("define", varNode("b"), lit(3)),
      sexpr("+", varNode("a"), varNode("b"))
    )
  );
  const vm = new VM();
  assertEqual(vm.run(chunk), 8);
});

// ─── TC-20: DUP ───────────────────────────────────────────────────────────
console.log("\n[TC-20] 스택 DUP");
test("DUP: 스택 최상단 복제", () => {
  const chunk: Chunk = {
    name: "dup-test",
    constants: [7],
    instructions: [
      { op: OpCode.PUSH_CONST, arg: 0 }, // 스택: [7]
      { op: OpCode.DUP },                 // 스택: [7, 7]
      { op: OpCode.ADD },                 // 스택: [14]
      { op: OpCode.HALT },
    ],
  };
  const vm = new VM();
  assertEqual(vm.run(chunk), 14);
});

// ─── TC-21: POP ───────────────────────────────────────────────────────────
console.log("\n[TC-21] POP");
test("POP: 스택에서 값 제거 후 다음 값 반환", () => {
  const chunk: Chunk = {
    name: "pop-test",
    constants: [10, 20],
    instructions: [
      { op: OpCode.PUSH_CONST, arg: 0 }, // 스택: [10]
      { op: OpCode.PUSH_CONST, arg: 1 }, // 스택: [10, 20]
      { op: OpCode.POP },                 // 스택: [10]
      { op: OpCode.HALT },
    ],
  };
  const vm = new VM();
  assertEqual(vm.run(chunk), 10);
});

// ─── TC-22: Phase 56 regression ───────────────────────────────────────────
console.log("\n[TC-22] Phase 56 regression 14/14");
test("Phase 56 렉시컬 스코프 regression 실행", () => {
  const { execSync } = require("child_process");
  const output = execSync(
    "npx ts-node src/test-phase56-lexical-scope.ts",
    { cwd: "/home/kimjin/kim/Desktop/kim/01_Active_Projects/freelang-v9", encoding: "utf8" }
  );
  const match = output.match(/(\d+) passed, (\d+) failed/);
  if (!match) throw new Error("Phase 56 테스트 결과를 파싱할 수 없음");
  const pass = parseInt(match[1], 10);
  const fail = parseInt(match[2], 10);
  if (fail > 0) throw new Error(`Phase 56 regression: ${fail}개 실패`);
  if (pass < 14) throw new Error(`Phase 56 regression: ${pass}/14 PASS`);
});

// ─── 결과 요약 ─────────────────────────────────────────────────────────────

console.log("\n──────────────────────────────────────────────────");
console.log(`Phase 83 바이트코드 VM: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
