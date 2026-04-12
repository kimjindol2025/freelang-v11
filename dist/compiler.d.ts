import { ASTNode } from "./ast";
import { OpCode, Chunk } from "./bytecode";
export declare class BytecodeCompiler {
    compile(node: ASTNode): Chunk;
    compileExpr(node: ASTNode, chunk: Chunk): void;
    private compileLiteral;
    private compileVariable;
    private compileSExpr;
    private compileIf;
    private compileDefine;
    private compileDo;
    private compileList;
    private compileAnd;
    private compileOr;
    private compileBlock;
    addConst(chunk: Chunk, value: any): number;
    emit(chunk: Chunk, op: OpCode, arg?: number | string | null): void;
}
//# sourceMappingURL=compiler.d.ts.map