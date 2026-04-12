// FreeLang v9 Phase 83: 바이트코드 VM

import { OpCode, Chunk, Instruction } from "./bytecode";

export class VM {
  stack: any[] = [];
  vars: Map<string, any> = new Map();
  ip: number = 0;

  run(chunk: Chunk): any {
    this.stack = [];
    this.vars = new Map();
    this.ip = 0;

    while (this.ip < chunk.instructions.length) {
      const instr: Instruction = chunk.instructions[this.ip];
      this.ip++;

      switch (instr.op) {
        case OpCode.PUSH_CONST: {
          const idx = instr.arg as number;
          this.push(chunk.constants[idx]);
          break;
        }

        case OpCode.PUSH_VAR: {
          const name = instr.arg as string;
          if (!this.vars.has(name)) {
            throw new Error(`VM: 정의되지 않은 변수: ${name}`);
          }
          this.push(this.vars.get(name));
          break;
        }

        case OpCode.SET_VAR: {
          const name = instr.arg as string;
          const val = this.pop();
          this.vars.set(name, val);
          break;
        }

        case OpCode.POP: {
          this.pop();
          break;
        }

        case OpCode.DUP: {
          if (this.stack.length === 0) {
            throw new Error("VM: 스택 언더플로 (DUP)");
          }
          this.push(this.stack[this.stack.length - 1]);
          break;
        }

        case OpCode.ADD: {
          const b = this.pop();
          const a = this.pop();
          this.push(a + b);
          break;
        }

        case OpCode.SUB: {
          const b = this.pop();
          const a = this.pop();
          this.push(a - b);
          break;
        }

        case OpCode.MUL: {
          const b = this.pop();
          const a = this.pop();
          this.push(a * b);
          break;
        }

        case OpCode.DIV: {
          const b = this.pop();
          const a = this.pop();
          if (b === 0) throw new Error("VM: 0으로 나누기");
          this.push(a / b);
          break;
        }

        case OpCode.MOD: {
          const b = this.pop();
          const a = this.pop();
          this.push(a % b);
          break;
        }

        case OpCode.EQ: {
          const b = this.pop();
          const a = this.pop();
          this.push(a === b);
          break;
        }

        case OpCode.NEQ: {
          const b = this.pop();
          const a = this.pop();
          this.push(a !== b);
          break;
        }

        case OpCode.LT: {
          const b = this.pop();
          const a = this.pop();
          this.push(a < b);
          break;
        }

        case OpCode.GT: {
          const b = this.pop();
          const a = this.pop();
          this.push(a > b);
          break;
        }

        case OpCode.LE: {
          const b = this.pop();
          const a = this.pop();
          this.push(a <= b);
          break;
        }

        case OpCode.GE: {
          const b = this.pop();
          const a = this.pop();
          this.push(a >= b);
          break;
        }

        case OpCode.AND: {
          const b = this.pop();
          const a = this.pop();
          this.push(Boolean(a) && Boolean(b));
          break;
        }

        case OpCode.OR: {
          const b = this.pop();
          const a = this.pop();
          this.push(Boolean(a) || Boolean(b));
          break;
        }

        case OpCode.NOT: {
          const a = this.pop();
          this.push(!Boolean(a));
          break;
        }

        case OpCode.JUMP: {
          this.ip = instr.arg as number;
          break;
        }

        case OpCode.JUMP_IF_FALSE: {
          const cond = this.pop();
          if (!Boolean(cond)) {
            this.ip = instr.arg as number;
          }
          break;
        }

        case OpCode.MAKE_LIST: {
          const count = instr.arg as number;
          if (this.stack.length < count) {
            throw new Error(`VM: 스택 언더플로 (MAKE_LIST: need ${count}, have ${this.stack.length})`);
          }
          const items = this.stack.splice(this.stack.length - count, count);
          this.push(items);
          break;
        }

        case OpCode.GET_FIELD: {
          const obj = this.pop();
          const field = instr.arg as string;
          if (obj !== null && typeof obj === "object") {
            this.push(obj[field]);
          } else {
            throw new Error(`VM: GET_FIELD 대상이 객체가 아님`);
          }
          break;
        }

        case OpCode.CALL: {
          // 미구현: 함수 호출
          throw new Error("VM: CALL 미구현");
        }

        case OpCode.RETURN: {
          return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
        }

        case OpCode.HALT: {
          return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
        }

        default: {
          throw new Error(`VM: 알 수 없는 OpCode: ${instr.op}`);
        }
      }
    }

    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  private push(val: any): void {
    this.stack.push(val);
  }

  private pop(): any {
    if (this.stack.length === 0) {
      throw new Error("VM: 스택 언더플로");
    }
    return this.stack.pop();
  }
}
