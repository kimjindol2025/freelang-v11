import { Token } from "./token";
import { Block } from "./ast";
export declare class ParserError extends Error {
    line: number;
    col: number;
    constructor(message: string, line: number, col: number);
}
export declare class Parser {
    private pos;
    private tokens;
    constructor(tokens: Token[]);
    parse(): Block[];
    private parseBlock;
    private parseValue;
    private parseArray;
    private isArrayLiteralStart;
    private parseSExpr;
    private parseTypeAnnotation;
    private parsePattern;
    private parsePatternMatch;
    private peek;
    private peekNext;
    private advance;
    private check;
    private expect;
    private isAtEnd;
    private error;
    private synchronize;
}
export declare function parse(tokens: Token[]): Block[];
//# sourceMappingURL=parser.d.ts.map