export type ASTNode = Block | Literal | Variable | SExpr | Keyword;
export interface Block {
    kind: "block";
    type: string;
    name: string;
    fields: Map<string, ASTNode | ASTNode[]>;
    typeAnnotations?: Map<string, TypeAnnotation>;
}
export interface Literal {
    kind: "literal";
    type: "number" | "string" | "symbol" | "boolean" | "null";
    value: string | number | boolean | null;
}
export interface Variable {
    kind: "variable";
    name: string;
}
export interface SExpr {
    kind: "sexpr";
    op: string;
    args: ASTNode[];
}
export interface Keyword {
    kind: "keyword";
    name: string;
}
export interface TypeAnnotation {
    kind: "type";
    name: string;
    generic?: TypeAnnotation;
    union?: TypeAnnotation[];
    optional?: boolean;
}
export interface FuncSignature {
    name: string;
    params: Array<{
        name: string;
        type: TypeAnnotation;
    }>;
    returnType: TypeAnnotation;
}
export interface ParserState {
    tokens: any[];
    pos: number;
}
export declare function makeLiteral(type: "number" | "string" | "symbol" | "boolean" | "null", value: any): Literal;
export declare function makeVariable(name: string): Variable;
export declare function makeSExpr(op: string, args: ASTNode[]): SExpr;
export declare function makeKeyword(name: string): Keyword;
export declare function makeBlock(type: string, name: string, fields: Map<string, ASTNode | ASTNode[]>): Block;
export declare function makeTypeAnnotation(name: string, generic?: TypeAnnotation, union?: TypeAnnotation[], optional?: boolean): TypeAnnotation;
export declare function makeFuncSignature(name: string, params: Array<{
    name: string;
    type: TypeAnnotation;
}>, returnType: TypeAnnotation): FuncSignature;
//# sourceMappingURL=ast.d.ts.map