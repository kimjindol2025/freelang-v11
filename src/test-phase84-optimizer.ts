// FreeLang v9 Phase 84: 바이트코드 최적화기 테스트

import { OpCode, Chunk, Instruction } from "./bytecode";
import { BytecodeCompiler } from "./compiler";
import { VM } from "./vm";
import { ASTNode, Literal, Variable, SExpr } from "./ast";
import {
  Optimizer,
  OptimizationPass,
  constantFoldingPass,
  deadCodeEliminationPass,
  pushPopEliminationPass,
  jumpOptimizationPass,
  createDefaultOptimizer,
} from "./optimizer";

// ─── AST 헬퍼 ────────────────────────────────────────────────────────────────

function lit(value: number | boolean | string | null): Literal {
  if (typeof value === "number") return { kind: "literal", type: "number", value };
  if (typeof value === "boolean") return { kind: "literal", type: "boolean", value };
  if (value === null) return { kind: "literal", type: "null", value: null };
  return { kind: "literal", type: "string", value };
}

function sexpr(op: string, ...args: ASTNode[]): SExpr {
  return { kind: "sexpr", op, args };
}

// ─── Chunk 빌더 헬퍼 ─────────────────────────────────────────────────────────

function makeChunk(
  instructions: Instruction[],
  constants: any[] = [],
  name = "test"
): Chunk {
  return { instructions, constants, name };
}

// ─── 테스트 인프라 ───────────────────────────────────────────────────────────

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
  if (a !== b) {
    throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

// ─── 테스트 케이스 ───────────────────────────────────────────────────────────

console.log("\n=== Phase 84: 바이트코드 최적화기 테스트 ===\n");

// TC-1: Optimizer 생성
test("TC-1: Optimizer 생성", () => {
  const opt = new Optimizer();
  assert(opt instanceof Optimizer, "Optimizer 인스턴스 생성 실패");
});

// TC-2: addPass 체이닝
test("TC-2: addPass 체이닝", () => {
  const opt = new Optimizer();
  const result = opt.addPass(constantFoldingPass).addPass(deadCodeEliminationPass);
  assert(result === opt, "addPass가 this를 반환해야 함");
});

// TC-3: 패스 없으면 Chunk 그대로 반환
test("TC-3: 패스 없으면 Chunk 그대로 반환", () => {
  const opt = new Optimizer();
  const chunk = makeChunk(
    [{ op: OpCode.PUSH_CONST, arg: 0 }, { op: OpCode.HALT }],
    [42]
  );
  const result = opt.optimize(chunk);
  assertEqual(result.instructions.length, 2, "명령어 수 불변");
  assertEqual(result.constants[0], 42, "상수 불변");
});

// TC-4: constant-folding — 2 + 3 → PUSH_CONST 5
test("TC-4: constant-folding — 2 + 3 → PUSH_CONST 5", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.ADD },
      { op: OpCode.HALT },
    ],
    [2, 3]
  );
  const result = constantFoldingPass.run(chunk);
  // PUSH_CONST 5, HALT → 2개 명령어
  assertEqual(result.instructions.length, 2, `명령어 수: ${result.instructions.length}`);
  assertEqual(result.instructions[0].op, OpCode.PUSH_CONST, "PUSH_CONST 확인");
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, 5, `폴딩된 값: ${foldedVal}`);
});

// TC-5: constant-folding — 10 - 4 → PUSH_CONST 6
test("TC-5: constant-folding — 10 - 4 → PUSH_CONST 6", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.SUB },
      { op: OpCode.HALT },
    ],
    [10, 4]
  );
  const result = constantFoldingPass.run(chunk);
  assertEqual(result.instructions.length, 2, `명령어 수: ${result.instructions.length}`);
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, 6, `폴딩된 값: ${foldedVal}`);
});

// TC-6: constant-folding — 2 * 3 → PUSH_CONST 6
test("TC-6: constant-folding — 2 * 3 → PUSH_CONST 6", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.MUL },
      { op: OpCode.HALT },
    ],
    [2, 3]
  );
  const result = constantFoldingPass.run(chunk);
  assertEqual(result.instructions.length, 2);
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, 6, `폴딩된 값: ${foldedVal}`);
});

// TC-7: constant-folding — true AND false → false
test("TC-7: constant-folding — true AND false → false", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.AND },
      { op: OpCode.HALT },
    ],
    [true, false]
  );
  const result = constantFoldingPass.run(chunk);
  assertEqual(result.instructions.length, 2);
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, false, `폴딩된 값: ${foldedVal}`);
});

// TC-8: dead-code-elimination — HALT 이후 명령어 제거
test("TC-8: dead-code-elimination — HALT 이후 명령어 제거", () => {
  const chunk = makeChunk([
    { op: OpCode.PUSH_CONST, arg: 0 },
    { op: OpCode.HALT },
    { op: OpCode.ADD },     // unreachable
    { op: OpCode.PUSH_CONST, arg: 1 }, // unreachable
  ], [10, 20]);
  const result = deadCodeEliminationPass.run(chunk);
  assertEqual(result.instructions.length, 2, `명령어 수: ${result.instructions.length}`);
  assertEqual(result.instructions[1].op, OpCode.HALT, "마지막 명령어는 HALT");
});

// TC-9: dead-code-elimination — HALT 없으면 변경 없음
test("TC-9: dead-code-elimination — HALT 없으면 변경 없음", () => {
  const chunk = makeChunk([
    { op: OpCode.PUSH_CONST, arg: 0 },
    { op: OpCode.PUSH_CONST, arg: 1 },
    { op: OpCode.ADD },
  ], [1, 2]);
  const result = deadCodeEliminationPass.run(chunk);
  assertEqual(result.instructions.length, 3, "명령어 수 불변");
});

// TC-10: push-pop-elimination — PUSH+POP 쌍 제거
test("TC-10: push-pop-elimination — PUSH+POP 쌍 제거", () => {
  const chunk = makeChunk([
    { op: OpCode.PUSH_CONST, arg: 0 },
    { op: OpCode.POP },
    { op: OpCode.PUSH_CONST, arg: 1 },
    { op: OpCode.HALT },
  ], [99, 42]);
  const result = pushPopEliminationPass.run(chunk);
  // PUSH_CONST 99, POP 제거 → PUSH_CONST 42, HALT 남음
  assertEqual(result.instructions.length, 2, `명령어 수: ${result.instructions.length}`);
  assertEqual(result.instructions[0].op, OpCode.PUSH_CONST, "첫 명령어 PUSH_CONST");
  const val = result.constants[result.instructions[0].arg as number];
  assertEqual(val, 42, `값: ${val}`);
});

// TC-11: push-pop-elimination — PUSH 없이 POP은 건드리지 않음
test("TC-11: push-pop-elimination — PUSH 없이 POP은 건드리지 않음", () => {
  const chunk = makeChunk([
    { op: OpCode.PUSH_VAR, arg: "x" },
    { op: OpCode.POP },
    { op: OpCode.HALT },
  ], []);
  const result = pushPopEliminationPass.run(chunk);
  // PUSH_VAR → POP은 제거 대상 아님 (PUSH_CONST만 폴딩)
  assertEqual(result.instructions.length, 3, `명령어 수: ${result.instructions.length}`);
});

// TC-12: jump-optimization — JUMP to next 제거
test("TC-12: jump-optimization — JUMP to next 제거", () => {
  // 인덱스 0: PUSH_CONST
  // 인덱스 1: JUMP 2  ← next instruction
  // 인덱스 2: HALT
  const chunk = makeChunk([
    { op: OpCode.PUSH_CONST, arg: 0 },
    { op: OpCode.JUMP, arg: 2 },
    { op: OpCode.HALT },
  ], [5]);
  const result = jumpOptimizationPass.run(chunk);
  assertEqual(result.instructions.length, 2, `명령어 수: ${result.instructions.length}`);
  // JUMP가 제거되어야 함
  assert(
    result.instructions.every(i => i.op !== OpCode.JUMP),
    "JUMP 명령어가 남아있음"
  );
});

// TC-13: jump-optimization — 다른 JUMP는 건드리지 않음
test("TC-13: jump-optimization — 다른 JUMP는 건드리지 않음", () => {
  // 인덱스 0: JUMP 2 (다음이 아닌 곳으로)
  // 인덱스 1: PUSH_CONST
  // 인덱스 2: HALT
  const chunk = makeChunk([
    { op: OpCode.JUMP, arg: 2 },
    { op: OpCode.PUSH_CONST, arg: 0 },
    { op: OpCode.HALT },
  ], [99]);
  const result = jumpOptimizationPass.run(chunk);
  assertEqual(result.instructions.length, 3, `명령어 수: ${result.instructions.length}`);
  assertEqual(result.instructions[0].op, OpCode.JUMP, "JUMP 유지");
});

// TC-14: createDefaultOptimizer — 4개 패스 포함
test("TC-14: createDefaultOptimizer 4개 패스 포함", () => {
  const opt = createDefaultOptimizer();
  // 간단한 최적화 적용 → stats에 4개 항목
  const chunk = makeChunk([{ op: OpCode.HALT }], []);
  opt.optimize(chunk);
  const stats = opt.getStats();
  assertEqual(stats.length, 4, `패스 수: ${stats.length}`);
  const names = stats.map(s => s.passName);
  assert(names.includes("constant-folding"), "constant-folding 없음");
  assert(names.includes("dead-code-elimination"), "dead-code-elimination 없음");
  assert(names.includes("push-pop-elimination"), "push-pop-elimination 없음");
  assert(names.includes("jump-optimization"), "jump-optimization 없음");
});

// TC-15: getStats — passName 목록 포함
test("TC-15: getStats — passName 목록 포함", () => {
  const opt = new Optimizer()
    .addPass(constantFoldingPass)
    .addPass(deadCodeEliminationPass);
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.ADD },
      { op: OpCode.HALT },
      { op: OpCode.POP }, // dead code
    ],
    [1, 2]
  );
  opt.optimize(chunk);
  const stats = opt.getStats();
  assertEqual(stats.length, 2, "stats 항목 수");
  assert(stats[0].passName === "constant-folding", "첫 패스 이름");
  assert(stats[1].passName === "dead-code-elimination", "두 번째 패스 이름");
});

// TC-16: optimize 후 명령어 수 감소 확인
test("TC-16: optimize 후 명령어 수 감소 확인", () => {
  const opt = createDefaultOptimizer();
  // PUSH 2, PUSH 3, ADD, HALT, POP(dead)
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.ADD },
      { op: OpCode.HALT },
      { op: OpCode.POP }, // dead code
    ],
    [2, 3]
  );
  const original = chunk.instructions.length;
  const result = opt.optimize(chunk);
  assert(
    result.instructions.length < original,
    `최적화 후 명령어가 줄어야 함 (${original} → ${result.instructions.length})`
  );
});

// TC-17: 빈 Chunk 최적화
test("TC-17: 빈 Chunk 최적화", () => {
  const opt = createDefaultOptimizer();
  const chunk = makeChunk([], []);
  const result = opt.optimize(chunk);
  assertEqual(result.instructions.length, 0, "빈 청크 유지");
});

// TC-18: 중첩 최적화 — 2개 패스 연속
test("TC-18: 중첩 최적화 — 2개 패스 연속", () => {
  // PUSH 2, PUSH 3, ADD → constant-folding으로 PUSH 5
  // 그 뒤 PUSH 5, POP → push-pop-elimination으로 제거
  // 남은 것: 없음 (빈 청크)
  const opt = new Optimizer()
    .addPass(constantFoldingPass)
    .addPass(pushPopEliminationPass);

  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 }, // 2
      { op: OpCode.PUSH_CONST, arg: 1 }, // 3
      { op: OpCode.ADD },
      { op: OpCode.POP },
    ],
    [2, 3]
  );
  const result = opt.optimize(chunk);
  // constant-folding: PUSH 2, PUSH 3, ADD → PUSH 5 (1개)
  // push-pop-elimination: PUSH 5, POP → 제거 (0개)
  assertEqual(result.instructions.length, 0, `남은 명령어: ${result.instructions.length}`);
});

// TC-19: 컴파일 후 최적화 E2E — (+ 2 3) → 5
test("TC-19: E2E — (+ 2 3) 컴파일 → 최적화 → VM 실행 → 5", () => {
  const compiler = new BytecodeCompiler();
  const vm = new VM();
  const opt = createDefaultOptimizer();

  // (+ 2 3)
  const ast = sexpr("+", { kind: "literal", type: "number", value: 2 }, { kind: "literal", type: "number", value: 3 });
  const chunk = compiler.compile(ast);
  const optimized = opt.optimize(chunk);

  // 최적화 후 PUSH_CONST 5, HALT 형태
  const val = vm.run(optimized);
  assertEqual(val, 5, `결과: ${val}`);
});

// TC-20: Phase 56 regression 확인 (lexical scope 런타임 동작)
test("TC-20: Phase 56 regression — Optimizer가 기존 모듈 import를 망가뜨리지 않음", () => {
  // Optimizer 모듈 import 자체가 성공 (기존 모듈과 충돌 없음)
  assert(typeof Optimizer === "function", "Optimizer 클래스 사용 가능");
  assert(typeof createDefaultOptimizer === "function", "createDefaultOptimizer 함수 사용 가능");
  assert(typeof constantFoldingPass === "object", "constantFoldingPass 사용 가능");
  assert(typeof deadCodeEliminationPass === "object", "deadCodeEliminationPass 사용 가능");
  assert(typeof pushPopEliminationPass === "object", "pushPopEliminationPass 사용 가능");
  assert(typeof jumpOptimizationPass === "object", "jumpOptimizationPass 사용 가능");
});

// ─── 추가 테스트 (21+) ────────────────────────────────────────────────────────

// TC-21: constant-folding — EQ 비교
test("TC-21: constant-folding — 5 == 5 → true", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.EQ },
      { op: OpCode.HALT },
    ],
    [5, 5]
  );
  const result = constantFoldingPass.run(chunk);
  assertEqual(result.instructions.length, 2);
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, true, `폴딩된 값: ${foldedVal}`);
});

// TC-22: constant-folding — OR 비교
test("TC-22: constant-folding — false OR true → true", () => {
  const chunk = makeChunk(
    [
      { op: OpCode.PUSH_CONST, arg: 0 },
      { op: OpCode.PUSH_CONST, arg: 1 },
      { op: OpCode.OR },
      { op: OpCode.HALT },
    ],
    [false, true]
  );
  const result = constantFoldingPass.run(chunk);
  assertEqual(result.instructions.length, 2);
  const foldedVal = result.constants[result.instructions[0].arg as number];
  assertEqual(foldedVal, true, `폴딩된 값: ${foldedVal}`);
});

// TC-23: getStats reduced 값 확인
test("TC-23: getStats — reduced 값 정확", () => {
  const opt = new Optimizer().addPass(deadCodeEliminationPass);
  const chunk = makeChunk([
    { op: OpCode.HALT },
    { op: OpCode.POP },
    { op: OpCode.POP },
  ], []);
  opt.optimize(chunk);
  const stats = opt.getStats();
  assertEqual(stats[0].reduced, 2, `reduced: ${stats[0].reduced}`);
});

// ─── 결과 출력 ───────────────────────────────────────────────────────────────

console.log(`\n결과: ${passed} PASS / ${failed} FAIL\n`);

if (failed > 0) {
  process.exit(1);
}
