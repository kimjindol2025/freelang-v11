import { ASTNode, Block, Literal, SExpr } from "./ast";
export interface CodegenOptions {
    module: "commonjs" | "esm";
    runtime: boolean;
    minify: boolean;
    target: "node" | "browser";
}
export declare class JSCodegen {
    private opts;
    private exportedNames;
    constructor();
    generate(nodes: ASTNode[], opts?: Partial<CodegenOptions>): string;
    genNode(node: ASTNode): string;
    genLiteral(node: Literal): string;
    private genVariable;
    private genKeyword;
    genSExpr(node: SExpr): string;
    private genFn;
    private genDo;
    private genFuncCall;
    genBlock(node: Block): string;
    private genFuncBlock;
    private genModuleBlock;
    private extractVarName;
    private extractParamList;
    private extractBlockParams;
    private minify;
}
//# sourceMappingURL=codegen-js.d.ts.map