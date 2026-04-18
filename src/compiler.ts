// FreeLang v9 Phase 83: AST → 바이트코드 컴파일러

import { ASTNode, Literal, Variable, SExpr, Block } from "./ast";
import { OpCode, Instruction, Chunk } from "./bytecode";

export class BytecodeCompiler {
  compile(node: ASTNode): Chunk {
    const chunk: Chunk = {
      instructions: [],
      constants: [],
      name: "main",
    };
    this.compileExpr(node, chunk);
    this.emit(chunk, OpCode.HALT);
    return chunk;
  }

  compileExpr(node: ASTNode, chunk: Chunk): void {
    switch (node.kind) {
      case "literal":
        this.compileLiteral(node as Literal, chunk);
        break;
      case "variable":
        this.compileVariable(node as Variable, chunk);
        break;
      case "sexpr":
        this.compileSExpr(node as SExpr, chunk);
        break;
      case "block":
        this.compileBlock(node as Block, chunk);
        break;
      default:
        // 미지원 노드: HALT 발행
        this.emit(chunk, OpCode.HALT);
        break;
    }
  }

  private compileLiteral(node: Literal, chunk: Chunk): void {
    const idx = this.addConst(chunk, node.value);
    this.emit(chunk, OpCode.PUSH_CONST, idx);
  }

  private compileVariable(node: Variable, chunk: Chunk): void {
    this.emit(chunk, OpCode.PUSH_VAR, node.name);
  }

  private compileSExpr(node: SExpr, chunk: Chunk): void {
    const op = node.op;

    // 특수 폼 처리
    switch (op) {
      case "if":
        this.compileIf(node, chunk);
        return;
      case "define":
        this.compileDefine(node, chunk);
        return;
      case "do":
        this.compileDo(node, chunk);
        return;
      case "list":
        this.compileList(node, chunk);
        return;
      case "not":
        if (node.args.length >= 1) {
          this.compileExpr(node.args[0], chunk);
          this.emit(chunk, OpCode.NOT);
        }
        return;
      case "and":
        this.compileAnd(node, chunk);
        return;
      case "or":
        this.compileOr(node, chunk);
        return;
      case "get":
      case ".":
        if (node.args.length >= 2) {
          this.compileExpr(node.args[0], chunk);
          const field = node.args[1];
          if (field.kind === "literal") {
            this.emit(chunk, OpCode.GET_FIELD, String((field as Literal).value));
          } else {
            this.emit(chunk, OpCode.HALT);
          }
        }
        return;
    }

    // 산술/비교 이항 연산
    const binaryOps: Record<string, OpCode> = {
      "+": OpCode.ADD,
      "-": OpCode.SUB,
      "*": OpCode.MUL,
      "/": OpCode.DIV,
      "%": OpCode.MOD,
      "mod": OpCode.MOD,
      "==": OpCode.EQ,
      "=": OpCode.EQ,
      "!=": OpCode.NEQ,
      "<": OpCode.LT,
      ">": OpCode.GT,
      "<=": OpCode.LE,
      ">=": OpCode.GE,
    };

    if (binaryOps[op] !== undefined) {
      if (node.args.length >= 2) {
        this.compileExpr(node.args[0], chunk);
        this.compileExpr(node.args[1], chunk);
        this.emit(chunk, binaryOps[op]);
      } else if (node.args.length === 1) {
        // 단항 minus
        if (op === "-") {
          const zeroIdx = this.addConst(chunk, 0);
          this.emit(chunk, OpCode.PUSH_CONST, zeroIdx);
          this.compileExpr(node.args[0], chunk);
          this.emit(chunk, OpCode.SUB);
        } else {
          this.compileExpr(node.args[0], chunk);
        }
      }
      return;
    }

    // 일반 함수 호출 (미지원 - HALT)
    this.emit(chunk, OpCode.HALT);
  }

  private compileIf(node: SExpr, chunk: Chunk): void {
    // (if cond then else)
    if (node.args.length < 2) {
      this.emit(chunk, OpCode.HALT);
      return;
    }

    // 조건 컴파일
    this.compileExpr(node.args[0], chunk);

    // JUMP_IF_FALSE → else 분기 위치 (나중에 패치)
    const jumpIfFalseIdx = chunk.instructions.length;
    this.emit(chunk, OpCode.JUMP_IF_FALSE, 0);

    // then 분기
    this.compileExpr(node.args[1], chunk);

    // JUMP → end (else 건너뛰기)
    const jumpIdx = chunk.instructions.length;
    this.emit(chunk, OpCode.JUMP, 0);

    // else 분기 위치 패치
    const elseStart = chunk.instructions.length;
    chunk.instructions[jumpIfFalseIdx].arg = elseStart;

    // else 분기
    if (node.args.length >= 3) {
      this.compileExpr(node.args[2], chunk);
    } else {
      const nullIdx = this.addConst(chunk, null);
      this.emit(chunk, OpCode.PUSH_CONST, nullIdx);
    }

    // end 위치 패치
    const end = chunk.instructions.length;
    chunk.instructions[jumpIdx].arg = end;
  }

  private compileDefine(node: SExpr, chunk: Chunk): void {
    // (define $var expr)
    if (node.args.length < 2) {
      this.emit(chunk, OpCode.HALT);
      return;
    }
    const varNode = node.args[0];
    const valNode = node.args[1];
    this.compileExpr(valNode, chunk);
    const name = varNode.kind === "variable"
      ? (varNode as Variable).name
      : varNode.kind === "literal"
        ? String((varNode as Literal).value)
        : "unknown";
    this.emit(chunk, OpCode.SET_VAR, name);
    // define은 값을 반환하지 않으므로 null 푸시
    const nullIdx = this.addConst(chunk, null);
    this.emit(chunk, OpCode.PUSH_CONST, nullIdx);
  }

  private compileDo(node: SExpr, chunk: Chunk): void {
    // (do expr1 expr2 ... exprN) — 각 expr 실행, 중간 결과는 POP
    if (node.args.length === 0) {
      const nullIdx = this.addConst(chunk, null);
      this.emit(chunk, OpCode.PUSH_CONST, nullIdx);
      return;
    }
    for (let i = 0; i < node.args.length; i++) {
      this.compileExpr(node.args[i], chunk);
      if (i < node.args.length - 1) {
        this.emit(chunk, OpCode.POP);
      }
    }
  }

  private compileList(node: SExpr, chunk: Chunk): void {
    // (list e1 e2 ... eN)
    for (const arg of node.args) {
      this.compileExpr(arg, chunk);
    }
    this.emit(chunk, OpCode.MAKE_LIST, node.args.length);
  }

  private compileAnd(node: SExpr, chunk: Chunk): void {
    if (node.args.length === 0) {
      const idx = this.addConst(chunk, true);
      this.emit(chunk, OpCode.PUSH_CONST, idx);
      return;
    }
    if (node.args.length === 1) {
      this.compileExpr(node.args[0], chunk);
      return;
    }
    // (and a b) → 두 값 스택에 올린 뒤 AND opcode
    this.compileExpr(node.args[0], chunk);
    this.compileExpr(node.args[1], chunk);
    this.emit(chunk, OpCode.AND);
  }

  private compileOr(node: SExpr, chunk: Chunk): void {
    if (node.args.length === 0) {
      const idx = this.addConst(chunk, false);
      this.emit(chunk, OpCode.PUSH_CONST, idx);
      return;
    }
    if (node.args.length === 1) {
      this.compileExpr(node.args[0], chunk);
      return;
    }
    this.compileExpr(node.args[0], chunk);
    this.compileExpr(node.args[1], chunk);
    this.emit(chunk, OpCode.OR);
  }

  private compileBlock(node: Block, chunk: Chunk): void {
    // Block은 미지원 — HALT
    this.emit(chunk, OpCode.HALT);
  }

  addConst(chunk: Chunk, value: any): number {
    chunk.constants.push(value);
    return chunk.constants.length - 1;
  }

  emit(chunk: Chunk, op: OpCode, arg?: number | string | null): void {
    const instr: Instruction = { op };
    if (arg !== undefined) instr.arg = arg;
    chunk.instructions.push(instr);
  }
}
