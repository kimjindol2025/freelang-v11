"use strict";
// FreeLang v9 Phase 84: 바이트코드 최적화기
Object.defineProperty(exports, "__esModule", { value: true });
exports.Optimizer = exports.jumpOptimizationPass = exports.pushPopEliminationPass = exports.deadCodeEliminationPass = exports.constantFoldingPass = void 0;
exports.createDefaultOptimizer = createDefaultOptimizer;
const bytecode_1 = require("./bytecode");
// ─────────────────────────────────────────────────────────────
// 헬퍼: Chunk 복사
// ─────────────────────────────────────────────────────────────
function cloneChunk(chunk) {
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
    bytecode_1.OpCode.ADD, bytecode_1.OpCode.SUB, bytecode_1.OpCode.MUL, bytecode_1.OpCode.DIV, bytecode_1.OpCode.MOD,
    bytecode_1.OpCode.EQ, bytecode_1.OpCode.NEQ, bytecode_1.OpCode.LT, bytecode_1.OpCode.GT, bytecode_1.OpCode.LE, bytecode_1.OpCode.GE,
    bytecode_1.OpCode.AND, bytecode_1.OpCode.OR,
]);
function applyBinaryOp(op, a, b) {
    switch (op) {
        case bytecode_1.OpCode.ADD: return a + b;
        case bytecode_1.OpCode.SUB: return a - b;
        case bytecode_1.OpCode.MUL: return a * b;
        case bytecode_1.OpCode.DIV: return b === 0 ? null : a / b;
        case bytecode_1.OpCode.MOD: return a % b;
        case bytecode_1.OpCode.EQ: return a === b;
        case bytecode_1.OpCode.NEQ: return a !== b;
        case bytecode_1.OpCode.LT: return a < b;
        case bytecode_1.OpCode.GT: return a > b;
        case bytecode_1.OpCode.LE: return a <= b;
        case bytecode_1.OpCode.GE: return a >= b;
        case bytecode_1.OpCode.AND: return Boolean(a) && Boolean(b);
        case bytecode_1.OpCode.OR: return Boolean(a) || Boolean(b);
        default: return null;
    }
}
exports.constantFoldingPass = {
    name: "constant-folding",
    run(chunk) {
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
                if (a.op === bytecode_1.OpCode.PUSH_CONST &&
                    b.op === bytecode_1.OpCode.PUSH_CONST &&
                    FOLDABLE_BINARY_OPS.has(op.op)) {
                    const aVal = result.constants[a.arg];
                    const bVal = result.constants[b.arg];
                    // DIV by zero는 폴딩하지 않음
                    if (op.op === bytecode_1.OpCode.DIV && bVal === 0)
                        continue;
                    const foldedVal = applyBinaryOp(op.op, aVal, bVal);
                    // 새 상수 추가 (중복 체크)
                    let newIdx = result.constants.indexOf(foldedVal);
                    if (newIdx === -1) {
                        newIdx = result.constants.length;
                        result.constants.push(foldedVal);
                    }
                    // 3개 명령어를 1개로 교체
                    instrs.splice(i, 3, { op: bytecode_1.OpCode.PUSH_CONST, arg: newIdx });
                    // JUMP 오프셋 보정 (2개 명령어 제거됨)
                    for (let j = 0; j < instrs.length; j++) {
                        const instr = instrs[j];
                        if ((instr.op === bytecode_1.OpCode.JUMP || instr.op === bytecode_1.OpCode.JUMP_IF_FALSE) &&
                            typeof instr.arg === "number") {
                            if (instr.arg > i + 2) {
                                instr.arg -= 2;
                            }
                            else if (instr.arg > i) {
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
exports.deadCodeEliminationPass = {
    name: "dead-code-elimination",
    run(chunk) {
        const result = cloneChunk(chunk);
        const instrs = result.instructions;
        const haltIdx = instrs.findIndex(i => i.op === bytecode_1.OpCode.HALT);
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
exports.pushPopEliminationPass = {
    name: "push-pop-elimination",
    run(chunk) {
        const result = cloneChunk(chunk);
        let changed = true;
        while (changed) {
            changed = false;
            const instrs = result.instructions;
            for (let i = 0; i + 1 < instrs.length; i++) {
                const curr = instrs[i];
                const next = instrs[i + 1];
                // PUSH_CONST 바로 다음 POP → 둘 다 제거
                if (curr.op === bytecode_1.OpCode.PUSH_CONST && next.op === bytecode_1.OpCode.POP) {
                    instrs.splice(i, 2);
                    // JUMP 오프셋 보정
                    for (let j = 0; j < instrs.length; j++) {
                        const instr = instrs[j];
                        if ((instr.op === bytecode_1.OpCode.JUMP || instr.op === bytecode_1.OpCode.JUMP_IF_FALSE) &&
                            typeof instr.arg === "number") {
                            if (instr.arg > i + 1) {
                                instr.arg -= 2;
                            }
                            else if (instr.arg > i) {
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
exports.jumpOptimizationPass = {
    name: "jump-optimization",
    run(chunk) {
        const result = cloneChunk(chunk);
        let changed = true;
        while (changed) {
            changed = false;
            const instrs = result.instructions;
            for (let i = 0; i < instrs.length; i++) {
                const instr = instrs[i];
                // JUMP to next instruction (i+1) → 무의미, 제거
                if (instr.op === bytecode_1.OpCode.JUMP && instr.arg === i + 1) {
                    instrs.splice(i, 1);
                    // JUMP 오프셋 보정
                    for (let j = 0; j < instrs.length; j++) {
                        const other = instrs[j];
                        if ((other.op === bytecode_1.OpCode.JUMP || other.op === bytecode_1.OpCode.JUMP_IF_FALSE) &&
                            typeof other.arg === "number") {
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
class Optimizer {
    constructor() {
        this.passes = [];
        this.stats = [];
    }
    addPass(pass) {
        this.passes.push(pass);
        return this;
    }
    optimize(chunk) {
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
    getStats() {
        return this.stats;
    }
}
exports.Optimizer = Optimizer;
// ─────────────────────────────────────────────────────────────
// createDefaultOptimizer — 4개 패스 모두 포함
// ─────────────────────────────────────────────────────────────
function createDefaultOptimizer() {
    return new Optimizer()
        .addPass(exports.constantFoldingPass)
        .addPass(exports.deadCodeEliminationPass)
        .addPass(exports.pushPopEliminationPass)
        .addPass(exports.jumpOptimizationPass);
}
//# sourceMappingURL=optimizer.js.map