import { Token } from "./token";
import { ASTNode } from "./ast";
export declare class ParserError extends Error {
    line: number;
    col: number;
    constructor(message: string, line: number, col: number);
}
export declare class Parser {
    private pos;
    private tokens;
    constructor(tokens: Token[]);
    parse(): ASTNode[];
    private parseBlock;
    private convertBlockToModuleBlock;
    private parseValue;
    private parseArray;
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
    private parseQualifiedIdentifier;
    private parseSelectiveImport;
}
export declare function parse(tokens: Token[]): ASTNode[];
//# sourceMappingURL=parser.d.ts.map