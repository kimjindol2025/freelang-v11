export type ASTNode = Block | Literal | Variable | SExpr | Keyword | TypeVariable | PatternMatch | Pattern | FunctionValue | TypeClass | TypeClassInstance;
export interface Block {
    kind: "block";
    type: string;
    name: string;
    fields: Map<string, ASTNode | ASTNode[]>;
    typeAnnotations?: Map<string, TypeAnnotation>;
    generics?: string[];
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
    isTypeVariable?: boolean;
}
export interface TypeVariable {
    kind: "type-variable";
    name: string;
}
export interface LiteralPattern {
    kind: "literal-pattern";
    type: "number" | "string" | "symbol" | "boolean";
    value: string | number | boolean;
}
export interface VariablePattern {
    kind: "variable-pattern";
    name: string;
}
export interface WildcardPattern {
    kind: "wildcard-pattern";
}
export interface ListPattern {
    kind: "list-pattern";
    elements: Pattern[];
    restElement?: string;
}
export interface StructPattern {
    kind: "struct-pattern";
    fields: Map<string, Pattern>;
}
export interface OrPattern {
    kind: "or-pattern";
    alternatives: Pattern[];
}
export type Pattern = LiteralPattern | VariablePattern | WildcardPattern | ListPattern | StructPattern | OrPattern;
export interface PatternMatch {
    kind: "pattern-match";
    value: ASTNode;
    cases: MatchCase[];
    defaultCase?: ASTNode;
}
export interface MatchCase {
    pattern: Pattern;
    guard?: ASTNode;
    body: ASTNode;
}
export interface FunctionValue {
    kind: "function-value";
    params: string[];
    body: ASTNode;
    capturedEnv: Map<string, any>;
    name?: string;
}
export interface TypeClass {
    kind: "type-class";
    name: string;
    typeParams: string[];
    methods: Map<string, TypeClassMethod>;
}
export interface TypeClassMethod {
    name: string;
    type: ASTNode;
}
export interface TypeClassInstance {
    kind: "type-class-instance";
    className: string;
    concreteType: string;
    implementations: Map<string, ASTNode>;
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
export declare function makeTypeVariable(name: string): TypeVariable;
export declare function makeFunctionValue(params: string[], body: ASTNode, capturedEnv: Map<string, any>, name?: string): FunctionValue;
export declare function makeLiteralPattern(type: "number" | "string" | "symbol" | "boolean", value: string | number | boolean): LiteralPattern;
export declare function makeVariablePattern(name: string): VariablePattern;
export declare function makeWildcardPattern(): WildcardPattern;
export declare function makeListPattern(elements: Pattern[], restElement?: string): ListPattern;
export declare function makeStructPattern(fields: Map<string, Pattern>): StructPattern;
export declare function makeOrPattern(alternatives: Pattern[]): OrPattern;
export declare function makeMatchCase(pattern: Pattern, body: ASTNode, guard?: ASTNode): MatchCase;
export declare function makePatternMatch(value: ASTNode, cases: MatchCase[], defaultCase?: ASTNode): PatternMatch;
export declare function makeTypeClass(name: string, typeParams: string[], methods: Map<string, TypeClassMethod>): TypeClass;
export declare function makeTypeClassInstance(className: string, concreteType: string, implementations: Map<string, ASTNode>): TypeClassInstance;
//# sourceMappingURL=ast.d.ts.map