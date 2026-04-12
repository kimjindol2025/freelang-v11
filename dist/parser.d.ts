import { Token } from "./token";
import { ASTNode } from "./ast";
export declare class ParserError extends Error {
    line: number;
    col: number;
    hint?: string | undefined;
    code?: string | undefined;
    stage: string;
    constructor(message: string, line: number, col: number, hint?: string | undefined, code?: string | undefined, stage?: string);
    toJSON(): {
        code: string;
        stage: string;
        message: string;
        file: undefined;
        line: number;
        column: number;
        symbol: undefined;
        cause: undefined;
        hint: string | undefined;
    };
}
export declare class Parser {
    private pos;
    private tokens;
    constructor(tokens: Token[]);
    parse(): ASTNode[];
    private parseBlock;
    private convertBlockToModuleBlock;
    private convertBlockToTypeClass;
    private convertBlockToInstance;
    private parseValue;
    private parseArray;
    private parseMap;
    private isArrayLiteralStart;
    private parseSExpr;
    private parseTypeAnnotation;
    private parsePattern;
    private parseAtomicPattern;
    private parsePatternMatch;
    private peek;
    private peekNext;
    private advance;
    private check;
    private expect;
    private isAtEnd;
    private error;
    private synchronize;
    private parseImportExpression;
    private parseOpenExpression;
    private parseSearchExpression;
    private parseFetchExpression;
    private parseLearnExpression;
    private parseRecallExpression;
    private parseReasoningExpression;
    private parseReasoningSequenceExpression;
    private parseTryExpression;
    private parseThrowExpression;
    private parseReasoningExpressionInternal;
    private parseQualifiedIdentifier;
    private parseSelectiveImport;
    private parseConditionalReasoningBlock;
    private parseWhenReasoningBlock;
    private parseSearchReasoningBlock;
    private parseLearnReasoningBlock;
    private parseLoopReasoningBlock;
    private getReasoningStageName;
}
export declare function parse(tokens: Token[]): ASTNode[];
//# sourceMappingURL=parser.d.ts.map