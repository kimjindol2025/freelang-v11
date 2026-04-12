import { PatternMatch, TryBlock, ThrowExpression, Pattern } from "./ast";
interface InterpreterLike {
    eval(node: any): any;
    callFunction(fn: any, args: any[]): any;
    context: {
        variables: {
            push(): void;
            pop(): void;
            set(name: string, value: any): void;
            get(name: string): any;
        };
    };
}
export declare function evalPatternMatch(interp: InterpreterLike, match: PatternMatch): any;
export declare function evalTryBlock(interp: InterpreterLike, tryBlock: TryBlock): any;
export declare function evalThrow(interp: InterpreterLike, throwExpr: ThrowExpression): any;
export declare function matchPattern(interp: InterpreterLike, pattern: Pattern, value: any): {
    matched: boolean;
    bindings: Map<string, any>;
    asBinding?: string;
};
export {};
//# sourceMappingURL=eval-pattern-match.d.ts.map