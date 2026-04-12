"use strict";
// FreeLang v9 Phase 83: 바이트코드 VM
Object.defineProperty(exports, "__esModule", { value: true });
exports.VM = void 0;
const bytecode_1 = require("./bytecode");
class VM {
    constructor() {
        this.stack = [];
        this.vars = new Map();
        this.ip = 0;
    }
    run(chunk) {
        this.stack = [];
        this.vars = new Map();
        this.ip = 0;
        while (this.ip < chunk.instructions.length) {
            const instr = chunk.instructions[this.ip];
            this.ip++;
            switch (instr.op) {
                case bytecode_1.OpCode.PUSH_CONST: {
                    const idx = instr.arg;
                    this.push(chunk.constants[idx]);
                    break;
                }
                case bytecode_1.OpCode.PUSH_VAR: {
                    const name = instr.arg;
                    if (!this.vars.has(name)) {
                        throw new Error(`VM: 정의되지 않은 변수: ${name}`);
                    }
                    this.push(this.vars.get(name));
                    break;
                }
                case bytecode_1.OpCode.SET_VAR: {
                    const name = instr.arg;
                    const val = this.pop();
                    this.vars.set(name, val);
                    break;
                }
                case bytecode_1.OpCode.POP: {
                    this.pop();
                    break;
                }
                case bytecode_1.OpCode.DUP: {
                    if (this.stack.length === 0) {
                        throw new Error("VM: 스택 언더플로 (DUP)");
                    }
                    this.push(this.stack[this.stack.length - 1]);
                    break;
                }
                case bytecode_1.OpCode.ADD: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a + b);
                    break;
                }
                case bytecode_1.OpCode.SUB: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a - b);
                    break;
                }
                case bytecode_1.OpCode.MUL: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a * b);
                    break;
                }
                case bytecode_1.OpCode.DIV: {
                    const b = this.pop();
                    const a = this.pop();
                    if (b === 0)
                        throw new Error("VM: 0으로 나누기");
                    this.push(a / b);
                    break;
                }
                case bytecode_1.OpCode.MOD: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a % b);
                    break;
                }
                case bytecode_1.OpCode.EQ: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a === b);
                    break;
                }
                case bytecode_1.OpCode.NEQ: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a !== b);
                    break;
                }
                case bytecode_1.OpCode.LT: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a < b);
                    break;
                }
                case bytecode_1.OpCode.GT: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a > b);
                    break;
                }
                case bytecode_1.OpCode.LE: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a <= b);
                    break;
                }
                case bytecode_1.OpCode.GE: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(a >= b);
                    break;
                }
                case bytecode_1.OpCode.AND: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(Boolean(a) && Boolean(b));
                    break;
                }
                case bytecode_1.OpCode.OR: {
                    const b = this.pop();
                    const a = this.pop();
                    this.push(Boolean(a) || Boolean(b));
                    break;
                }
                case bytecode_1.OpCode.NOT: {
                    const a = this.pop();
                    this.push(!Boolean(a));
                    break;
                }
                case bytecode_1.OpCode.JUMP: {
                    this.ip = instr.arg;
                    break;
                }
                case bytecode_1.OpCode.JUMP_IF_FALSE: {
                    const cond = this.pop();
                    if (!Boolean(cond)) {
                        this.ip = instr.arg;
                    }
                    break;
                }
                case bytecode_1.OpCode.MAKE_LIST: {
                    const count = instr.arg;
                    if (this.stack.length < count) {
                        throw new Error(`VM: 스택 언더플로 (MAKE_LIST: need ${count}, have ${this.stack.length})`);
                    }
                    const items = this.stack.splice(this.stack.length - count, count);
                    this.push(items);
                    break;
                }
                case bytecode_1.OpCode.GET_FIELD: {
                    const obj = this.pop();
                    const field = instr.arg;
                    if (obj !== null && typeof obj === "object") {
                        this.push(obj[field]);
                    }
                    else {
                        throw new Error(`VM: GET_FIELD 대상이 객체가 아님`);
                    }
                    break;
                }
                case bytecode_1.OpCode.CALL: {
                    // 미구현: 함수 호출
                    throw new Error("VM: CALL 미구현");
                }
                case bytecode_1.OpCode.RETURN: {
                    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
                }
                case bytecode_1.OpCode.HALT: {
                    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
                }
                default: {
                    throw new Error(`VM: 알 수 없는 OpCode: ${instr.op}`);
                }
            }
        }
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }
    push(val) {
        this.stack.push(val);
    }
    pop() {
        if (this.stack.length === 0) {
            throw new Error("VM: 스택 언더플로");
        }
        return this.stack.pop();
    }
}
exports.VM = VM;
//# sourceMappingURL=vm.js.map