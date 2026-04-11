export type ASTNode = Block | Literal | Variable | SExpr | Keyword | TypeVariable | PatternMatch | Pattern | FunctionValue | TypeClass | TypeClassInstance | ModuleBlock | ImportBlock | OpenBlock | SearchBlock | LearnBlock | ReasoningBlock | ReasoningSequence | AsyncFunction | AwaitExpression | TryBlock | CatchClause | ThrowExpression;
export interface Block {
    kind: "block";
    type: string;
    name: string;
    fields: Map<string, ASTNode | ASTNode[]>;
    typeAnnotations?: Map<string, TypeAnnotation>;
    generics?: string[];
    line?: number;
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
    line?: number;
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
export interface ModuleBlock {
    kind: "module";
    name: string;
    exports: string[];
    body: ASTNode[];
    path?: string;
}
export interface ImportBlock {
    kind: "import";
    moduleName: string;
    source?: string;
    selective?: string[];
    alias?: string;
}
export interface OpenBlock {
    kind: "open";
    moduleName: string;
    source?: string;
}
export interface SearchBlock {
    kind: "search-block";
    query: string;
    source: "web" | "api" | "kb";
    cache?: boolean;
    limit?: number;
    name?: string;
}
export interface LearnBlock {
    kind: "learn-block";
    key: string;
    data: any;
    source?: "search" | "feedback" | "analysis";
    confidence?: number;
    timestamp?: string;
}
export interface ReasoningBlock {
    kind: "reasoning-block";
    stage: "observe" | "analyze" | "decide" | "act" | "verify";
    data: Map<string, any>;
    observations?: any[];
    analysis?: any[];
    decisions?: any[];
    actions?: any[];
    verifications?: any[];
    transitions?: ReasoningTransition[];
    metadata?: {
        startTime?: string;
        endTime?: string;
        confidence?: number;
        feedback?: string;
    };
    conditional?: {
        condition: ASTNode;
        thenBlock: ReasoningBlock;
        elseBlock?: ReasoningBlock;
    };
    whenGuard?: ASTNode;
    loopControl?: {
        type: "repeat-until" | "repeat-while";
        condition: ASTNode;
        maxIterations?: number;
    };
}
export interface ReasoningTransition {
    from: string;
    to: string;
    condition?: ASTNode;
    action?: ASTNode;
}
export interface ReasoningSequence {
    kind: "reasoning-sequence";
    stages: (ReasoningBlock | SearchBlock | LearnBlock)[];
    metadata?: {
        startTime?: string;
        endTime?: string;
        totalConfidence?: number;
        executionPath?: string[];
    };
    context?: {
        searches?: Map<string, any>;
        learned?: Map<string, any>;
    };
    feedbackLoop?: {
        enabled: boolean;
        fromStage: "verify" | "act";
        toStage: "analyze" | "decide";
        condition?: ASTNode;
        maxIterations?: number;
        confidenceDamping?: number;
    };
}
export interface AsyncFunction {
    kind: "async-function";
    name: string;
    params: Array<{
        name: string;
        type?: TypeAnnotation;
    }>;
    body: ASTNode;
}
export interface AwaitExpression {
    kind: "await";
    argument: ASTNode;
}
export interface TryBlock {
    kind: "try-block";
    body: ASTNode;
    catchClauses?: CatchClause[];
    finallyBlock?: ASTNode;
}
export interface CatchClause {
    kind: "catch-clause";
    pattern?: Pattern;
    variable?: string;
    handler: ASTNode;
}
export interface ThrowExpression {
    kind: "throw";
    argument: ASTNode;
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
export declare function makeSExpr(op: string, args: ASTNode[], line?: number): SExpr;
export declare function makeKeyword(name: string): Keyword;
export declare function makeBlock(type: string, name: string, fields: Map<string, ASTNode | ASTNode[]>, line?: number): Block;
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
export declare function makeModuleBlock(name: string, exports: string[], body: ASTNode[], path?: string): ModuleBlock;
export declare function makeImportBlock(moduleName: string, source?: string, selective?: string[], alias?: string): ImportBlock;
export declare function makeOpenBlock(moduleName: string, source?: string): OpenBlock;
export declare function makeAsyncFunction(name: string, params: Array<{
    name: string;
    type?: TypeAnnotation;
}>, body: ASTNode): AsyncFunction;
export declare function makeAwaitExpression(argument: ASTNode): AwaitExpression;
export declare function makeTryBlock(body: ASTNode, catchClauses?: CatchClause[], finallyBlock?: ASTNode): TryBlock;
export declare function makeCatchClause(handler: ASTNode, pattern?: Pattern, variable?: string): CatchClause;
export declare function makeThrowExpression(argument: ASTNode): ThrowExpression;
export declare function makeReasoningBlock(stage: "observe" | "analyze" | "decide" | "act" | "verify", data: Map<string, any>, observations?: any[], analysis?: any[], decisions?: any[], actions?: any[], verifications?: any[], transitions?: ReasoningTransition[], metadata?: {
    startTime?: string;
    endTime?: string;
    confidence?: number;
    feedback?: string;
}): ReasoningBlock;
export declare function makeReasoningTransition(from: string, to: string, condition?: ASTNode, action?: ASTNode): ReasoningTransition;
export declare function makeReasoningSequence(stages: ReasoningBlock[], metadata?: {
    startTime?: string;
    endTime?: string;
    totalConfidence?: number;
    executionPath?: string[];
}): ReasoningSequence;
export declare function isBlock(node: any): node is Block;
export declare function isLiteral(node: any): node is Literal;
export declare function isSymbolLiteral(node: any): node is Literal;
export declare function isArrayBlock(node: any): node is Block;
export declare function isFuncBlock(node: any): node is Block;
export declare function isVariable(node: any): node is Variable;
export declare function isSExpr(node: any): node is SExpr;
export declare function isModuleBlock(node: any): node is ModuleBlock;
export declare function isImportBlock(node: any): node is ImportBlock;
export declare function isOpenBlock(node: any): node is OpenBlock;
export declare function isSearchBlock(node: any): node is SearchBlock;
export declare function isLearnBlock(node: any): node is LearnBlock;
export declare function isReasoningBlock(node: any): node is ReasoningBlock;
export declare function isReasoningSequence(node: any): node is ReasoningSequence;
export declare function isTryBlock(node: any): node is TryBlock;
export declare function isCatchClause(node: any): node is CatchClause;
export declare function isThrowExpression(node: any): node is ThrowExpression;
//# sourceMappingURL=ast.d.ts.map