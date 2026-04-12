// FreeLang v9 Phase 84: 바이트코드 최적화기

import { OpCode, Instruction, Chunk } from "./bytecode";

// ─────────────────────────────────────────────────────────────
// OptimizationPass 인터페이스
// ─────────────────────────────────────────────────────────────

export interface OptimizationPass {
  name: string;
  run(chunk: Chunk): Chunk;
}

// ─────────────────────────────────────────────────────────────
// 헬퍼: Chunk 복사
// ─────────────────────────────────────────────────────────────

function cloneChunk(chunk: Chunk): Chunk {
  return {
    instructions: chunk.instructions.map(i => ({ ...i })),
    constants: [...chunk.constants],
    name: chunk.name,
  };
}

// ─────────────────────────────────────────────────────────────
// Pass 1: constant-folding
// PUSH_CONST a, PUSH_CONST b, <binary op> → PUSH_CONST result
// ─────────────────────────────────────────────────────────────

const FOLDABLE_BINARY_OPS = new Set([
  OpCode.ADD, OpCode.SUB, OpCode.MUL, OpCode.DIV, OpCode.MOD,
  OpCode.EQ, OpCode.NEQ, OpCode.LT, OpCode.GT, OpCode.LE, OpCode.GE,
  OpCode.AND, OpCode.OR,
]);

function applyBinaryOp(op: OpCode, a: any, b: any): any {
  switch (op) {
    case OpCode.ADD: return a + b;
    case OpCode.SUB: return a - b;
    case OpCode.MUL: return a * b;
    case OpCode.DIV: return b === 0 ? null : a / b;
    case OpCode.MOD: return a % b;
    case OpCode.EQ:  return a === b;
    case OpCode.NEQ: return a !== b;
    case OpCode.LT:  return a < b;
    case OpCode.GT:  return a > b;
    case OpCode.LE:  return a <= b;
    case OpCode.GE:  return a >= b;
    case OpCode.AND: return Boolean(a) && Boolean(b);
    case OpCode.OR:  return Boolean(a) || Boolean(b);
    default: return null;
  }
}

export const constantFoldingPass: OptimizationPass = {
  name: "constant-folding",
  run(chunk: Chunk): Chunk {
    const result = cloneChunk(chunk);
    let changed = true;

    // 변경이 없을 때까지 반복 (연쇄 폴딩)
    while (changed) {
      changed = false;
      const instrs = result.instructions;

      for (let i = 0; i + 2 < instrs.length; i++) {
        const a = instrs[i];
        const b = instrs[i + 1];
        const op = instrs[i + 2];

        if (
          a.op === OpCode.PUSH_CONST &&
          b.op === OpCode.PUSH_CONST &&
          FOLDABLE_BINARY_OPS.has(op.op)
        ) {
          const aVal = result.constants[a.arg as number];
          const bVal = result.constants[b.arg as number];

          // DIV by zero는 폴딩하지 않음
          if (op.op === OpCode.DIV && bVal === 0) continue;

          const foldedVal = applyBinaryOp(op.op, aVal, bVal);

          // 새 상수 추가 (중복 체크)
          let newIdx = result.constants.indexOf(foldedVal);
          if (newIdx === -1) {
            newIdx = result.constants.length;
            result.constants.push(foldedVal);
          }

          // 3개 명령어를 1개로 교체
          instrs.splice(i, 3, { op: OpCode.PUSH_CONST, arg: newIdx });

          // JUMP 오프셋 보정 (2개 명령어 제거됨)
          for (let j = 0; j < instrs.length; j++) {
            const instr = instrs[j];
            if (
              (instr.op === OpCode.JUMP || instr.op === OpCode.JUMP_IF_FALSE) &&
              typeof instr.arg === "number"
            ) {
              if (instr.arg > i + 2) {
                instr.arg -= 2;
              } else if (instr.arg > i) {
                // jump 대상이 제거된 범위 내 → 폴딩된 자리로
                instr.arg = i;
              }
            }
          }

          changed = true;
          break; // instrs 길이 변경되었으므로 재시작
        }
      }
    }

    return result;
  },
};

// ─────────────────────────────────────────────────────────────
// Pass 2: dead-code-elimination
// HALT 이후 명령어 제거
// ─────────────────────────────────────────────────────────────

export const deadCodeEliminationPass: OptimizationPass = {
  name: "dead-code-elimination",
  run(chunk: Chunk): Chunk {
    const result = cloneChunk(chunk);
    const instrs = result.instructions;

    const haltIdx = instrs.findIndex(i => i.op === OpCode.HALT);
    if (haltIdx !== -1 && haltIdx < instrs.length - 1) {
      // HALT 이후 모두 제거
      result.instructions = instrs.slice(0, haltIdx + 1);
    }

    return result;
  },
};

// ─────────────────────────────────────────────────────────────
// Pass 3: push-pop-elimination
// PUSH_CONST x, POP → 두 명령어 제거
// ─────────────────────────────────────────────────────────────

export const pushPopEliminationPass: OptimizationPass = {
  name: "push-pop-elimination",
  run(chunk: Chunk): Chunk {
    const result = cloneChunk(chunk);
    let changed = true;

    while (changed) {
      changed = false;
      const instrs = result.instructions;

      for (let i = 0; i + 1 < instrs.length; i++) {
        const curr = instrs[i];
        const next = instrs[i + 1];

        // PUSH_CONST 바로 다음 POP → 둘 다 제거
        if (curr.op === OpCode.PUSH_CONST && next.op === OpCode.POP) {
          instrs.splice(i, 2);

          // JUMP 오프셋 보정
          for (let j = 0; j < instrs.length; j++) {
            const instr = instrs[j];
            if (
              (instr.op === OpCode.JUMP || instr.op === OpCode.JUMP_IF_FALSE) &&
              typeof instr.arg === "number"
            ) {
              if (instr.arg > i + 1) {
                instr.arg -= 2;
              } else if (instr.arg > i) {
                instr.arg = i;
              }
            }
          }

          changed = true;
          break;
        }
      }
    }

    return result;
  },
};

// ─────────────────────────────────────────────────────────────
// Pass 4: jump-optimization
// JUMP i+1 (다음 줄로 점프) → 제거
// ─────────────────────────────────────────────────────────────

export const jumpOptimizationPass: OptimizationPass = {
  name: "jump-optimization",
  run(chunk: Chunk): Chunk {
    const result = cloneChunk(chunk);
    let changed = true;

    while (changed) {
      changed = false;
      const instrs = result.instructions;

      for (let i = 0; i < instrs.length; i++) {
        const instr = instrs[i];
        // JUMP to next instruction (i+1) → 무의미, 제거
        if (instr.op === OpCode.JUMP && instr.arg === i + 1) {
          instrs.splice(i, 1);

          // JUMP 오프셋 보정
          for (let j = 0; j < instrs.length; j++) {
            const other = instrs[j];
            if (
              (other.op === OpCode.JUMP || other.op === OpCode.JUMP_IF_FALSE) &&
              typeof other.arg === "number"
            ) {
              if (other.arg > i) {
                other.arg -= 1;
              }
            }
          }

          changed = true;
          break;
        }
      }
    }

    return result;
  },
};

// ─────────────────────────────────────────────────────────────
// Optimizer 클래스
// ─────────────────────────────────────────────────────────────

export class Optimizer {
  private passes: OptimizationPass[] = [];
  private stats: { passName: string; reduced: number }[] = [];

  addPass(pass: OptimizationPass): this {
    this.passes.push(pass);
    return this;
  }

  optimize(chunk: Chunk): Chunk {
    this.stats = [];
    let current = chunk;

    for (const pass of this.passes) {
      const before = current.instructions.length;
      const after = pass.run(current);
      const reduced = before - after.instructions.length;
      this.stats.push({ passName: pass.name, reduced });
      current = after;
    }

    return current;
  }

  getStats(): { passName: string; reduced: number }[] {
    return this.stats;
  }
}

// ─────────────────────────────────────────────────────────────
// createDefaultOptimizer — 4개 패스 모두 포함
// ─────────────────────────────────────────────────────────────

export function createDefaultOptimizer(): Optimizer {
  return new Optimizer()
    .addPass(constantFoldingPass)
    .addPass(deadCodeEliminationPass)
    .addPass(pushPopEliminationPass)
    .addPass(jumpOptimizationPass);
}
