"use strict";
// FreeLang v9 Phase 83: AST → 바이트코드 컴파일러
Object.defineProperty(exports, "__esModule", { value: true });
exports.BytecodeCompiler = void 0;
const bytecode_1 = require("./bytecode");
class BytecodeCompiler {
    compile(node) {
        const chunk = {
            instructions: [],
            constants: [],
            name: "main",
        };
        this.compileExpr(node, chunk);
        this.emit(chunk, bytecode_1.OpCode.HALT);
        return chunk;
    }
    compileExpr(node, chunk) {
        switch (node.kind) {
            case "literal":
                this.compileLiteral(node, chunk);
                break;
            case "variable":
                this.compileVariable(node, chunk);
                break;
            case "sexpr":
                this.compileSExpr(node, chunk);
                break;
            case "block":
                this.compileBlock(node, chunk);
                break;
            default:
                // 미지원 노드: HALT 발행
                this.emit(chunk, bytecode_1.OpCode.HALT);
                break;
        }
    }
    compileLiteral(node, chunk) {
        const idx = this.addConst(chunk, node.value);
        this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, idx);
    }
    compileVariable(node, chunk) {
        this.emit(chunk, bytecode_1.OpCode.PUSH_VAR, node.name);
    }
    compileSExpr(node, chunk) {
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
                    this.emit(chunk, bytecode_1.OpCode.NOT);
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
                        this.emit(chunk, bytecode_1.OpCode.GET_FIELD, String(field.value));
                    }
                    else {
                        this.emit(chunk, bytecode_1.OpCode.HALT);
                    }
                }
                return;
        }
        // 산술/비교 이항 연산
        const binaryOps = {
            "+": bytecode_1.OpCode.ADD,
            "-": bytecode_1.OpCode.SUB,
            "*": bytecode_1.OpCode.MUL,
            "/": bytecode_1.OpCode.DIV,
            "%": bytecode_1.OpCode.MOD,
            "mod": bytecode_1.OpCode.MOD,
            "==": bytecode_1.OpCode.EQ,
            "=": bytecode_1.OpCode.EQ,
            "!=": bytecode_1.OpCode.NEQ,
            "<": bytecode_1.OpCode.LT,
            ">": bytecode_1.OpCode.GT,
            "<=": bytecode_1.OpCode.LE,
            ">=": bytecode_1.OpCode.GE,
        };
        if (binaryOps[op] !== undefined) {
            if (node.args.length >= 2) {
                this.compileExpr(node.args[0], chunk);
                this.compileExpr(node.args[1], chunk);
                this.emit(chunk, binaryOps[op]);
            }
            else if (node.args.length === 1) {
                // 단항 minus
                if (op === "-") {
                    const zeroIdx = this.addConst(chunk, 0);
                    this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, zeroIdx);
                    this.compileExpr(node.args[0], chunk);
                    this.emit(chunk, bytecode_1.OpCode.SUB);
                }
                else {
                    this.compileExpr(node.args[0], chunk);
                }
            }
            return;
        }
        // 일반 함수 호출 (미지원 - HALT)
        this.emit(chunk, bytecode_1.OpCode.HALT);
    }
    compileIf(node, chunk) {
        // (if cond then else)
        if (node.args.length < 2) {
            this.emit(chunk, bytecode_1.OpCode.HALT);
            return;
        }
        // 조건 컴파일
        this.compileExpr(node.args[0], chunk);
        // JUMP_IF_FALSE → else 분기 위치 (나중에 패치)
        const jumpIfFalseIdx = chunk.instructions.length;
        this.emit(chunk, bytecode_1.OpCode.JUMP_IF_FALSE, 0);
        // then 분기
        this.compileExpr(node.args[1], chunk);
        // JUMP → end (else 건너뛰기)
        const jumpIdx = chunk.instructions.length;
        this.emit(chunk, bytecode_1.OpCode.JUMP, 0);
        // else 분기 위치 패치
        const elseStart = chunk.instructions.length;
        chunk.instructions[jumpIfFalseIdx].arg = elseStart;
        // else 분기
        if (node.args.length >= 3) {
            this.compileExpr(node.args[2], chunk);
        }
        else {
            const nullIdx = this.addConst(chunk, null);
            this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, nullIdx);
        }
        // end 위치 패치
        const end = chunk.instructions.length;
        chunk.instructions[jumpIdx].arg = end;
    }
    compileDefine(node, chunk) {
        // (define $var expr)
        if (node.args.length < 2) {
            this.emit(chunk, bytecode_1.OpCode.HALT);
            return;
        }
        const varNode = node.args[0];
        const valNode = node.args[1];
        this.compileExpr(valNode, chunk);
        const name = varNode.kind === "variable"
            ? varNode.name
            : varNode.kind === "literal"
                ? String(varNode.value)
                : "unknown";
        this.emit(chunk, bytecode_1.OpCode.SET_VAR, name);
        // define은 값을 반환하지 않으므로 null 푸시
        const nullIdx = this.addConst(chunk, null);
        this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, nullIdx);
    }
    compileDo(node, chunk) {
        // (do expr1 expr2 ... exprN) — 각 expr 실행, 중간 결과는 POP
        if (node.args.length === 0) {
            const nullIdx = this.addConst(chunk, null);
            this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, nullIdx);
            return;
        }
        for (let i = 0; i < node.args.length; i++) {
            this.compileExpr(node.args[i], chunk);
            if (i < node.args.length - 1) {
                this.emit(chunk, bytecode_1.OpCode.POP);
            }
        }
    }
    compileList(node, chunk) {
        // (list e1 e2 ... eN)
        for (const arg of node.args) {
            this.compileExpr(arg, chunk);
        }
        this.emit(chunk, bytecode_1.OpCode.MAKE_LIST, node.args.length);
    }
    compileAnd(node, chunk) {
        if (node.args.length === 0) {
            const idx = this.addConst(chunk, true);
            this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, idx);
            return;
        }
        if (node.args.length === 1) {
            this.compileExpr(node.args[0], chunk);
            return;
        }
        // (and a b) → 두 값 스택에 올린 뒤 AND opcode
        this.compileExpr(node.args[0], chunk);
        this.compileExpr(node.args[1], chunk);
        this.emit(chunk, bytecode_1.OpCode.AND);
    }
    compileOr(node, chunk) {
        if (node.args.length === 0) {
            const idx = this.addConst(chunk, false);
            this.emit(chunk, bytecode_1.OpCode.PUSH_CONST, idx);
            return;
        }
        if (node.args.length === 1) {
            this.compileExpr(node.args[0], chunk);
            return;
        }
        this.compileExpr(node.args[0], chunk);
        this.compileExpr(node.args[1], chunk);
        this.emit(chunk, bytecode_1.OpCode.OR);
    }
    compileBlock(node, chunk) {
        // Block은 미지원 — HALT
        this.emit(chunk, bytecode_1.OpCode.HALT);
    }
    addConst(chunk, value) {
        chunk.constants.push(value);
        return chunk.constants.length - 1;
    }
    emit(chunk, op, arg) {
        const instr = { op };
        if (arg !== undefined)
            instr.arg = arg;
        chunk.instructions.push(instr);
    }
}
exports.BytecodeCompiler = BytecodeCompiler;
//# sourceMappingURL=compiler.js.map