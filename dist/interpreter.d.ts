import { ASTNode, Pattern, PatternMatch, ModuleBlock, ImportBlock, OpenBlock, SearchBlock, LearnBlock, ReasoningBlock, ReasoningSequence, TryBlock, ThrowExpression, TypeClass, TypeClassInstance } from "./ast";
import { Logger } from "./logger";
import { FreeLangPromise } from "./async-runtime";
import { WebSearchAdapter } from "./web-search-adapter";
import { LearnedFactsStore } from "./learned-facts-store";
export type { ExecutionContext, FreeLangFunction, FreeLangRoute, Intent, FreeLangMiddleware, ErrorHandler, TypeClassInfo, TypeClassInstanceInfo, ModuleInfo, } from "./interpreter-context";
import type { ExecutionContext, TypeClassInfo, TypeClassInstanceInfo, ModuleInfo } from "./interpreter-context";
export declare class Interpreter {
    context: ExecutionContext;
    logger: Logger;
    searchAdapter: WebSearchAdapter;
    learnedFactsStore: LearnedFactsStore;
    currentLine: number;
    callDepth: number;
    static readonly MAX_CALL_DEPTH = 5000;
    tcoMode: boolean;
    importedFiles: Set<string>;
    currentFilePath: string;
    constructor(logger?: Logger, options?: {
        strict?: boolean;
    });
    private registerStandardMacros;
    private loadFlStdlib;
    registerModule(module: Record<string, unknown>): void;
    interpret(blocks: ASTNode[]): ExecutionContext;
    /**
     * Phase 59: 소스 코드 문자열을 받아 lex → parse → interpret 후 ExecutionContext 반환
     * 테스트와 인라인 실행에 편리한 단축 메서드
     */
    run(source: string): ExecutionContext;
    private evalBlock;
    private serverConfig;
    private handleServerBlock;
    private handleRouteBlock;
    private handleFuncBlock;
    private handleIntentBlock;
    private handleMiddlewareBlock;
    private handleWebSocketBlock;
    private handleErrorHandlerBlock;
    eval(node: ASTNode): any;
    private evalSExpr;
    private callProtocolMethod;
    interpolateString(template: string): string;
    toDisplayString(val: any): string;
    callUserFunction(name: string, args: any[]): any;
    callFunctionValue(fn: any, args: any[]): any;
    callAsyncFunctionValue(fn: any, args: any[]): FreeLangPromise;
    callFunction(fn: any, args: any[]): any;
    callUserFunctionTCO(name: string, args: any[]): any;
    callFunctionValueTCO(fn: any, args: any[]): any;
    callUserFunctionRaw(name: string, args: any[]): any;
    callFunctionValueRaw(fn: any, args: any[]): any;
    private getFieldValue;
    evalPatternMatch(match: PatternMatch): any;
    evalTryBlock(tryBlock: TryBlock): any;
    evalThrow(throwExpr: ThrowExpression): any;
    matchPattern(pattern: Pattern, value: any): {
        matched: boolean;
        bindings: Map<string, any>;
    };
    getContext(): ExecutionContext;
    setVariable(name: string, value: any): void;
    evalDefmacro(expr: any): void;
    registerBuiltinTypeClasses(): void;
    evalTypeClass(typeClass: TypeClass): void;
    evalInstance(instance: TypeClassInstance): void;
    getTypeClass(name: string): TypeClassInfo | undefined;
    getTypeClassInstance(className: string, concreteType: string): TypeClassInstanceInfo | undefined;
    satisfiesConstraint(type: string, constraintClass: string): boolean;
    getConcreteType(value: any): string | undefined;
    resolveMethod(className: string, concreteType: string, methodName: string): any;
    getModules(): Map<string, ModuleInfo>;
    evalModuleBlock(moduleBlock: ModuleBlock): void;
    evalImportBlock(importBlock: ImportBlock): void;
    evalImportFromFile(relPath: string, prefix: string, selective: string[] | undefined, alias: string | undefined): void;
    evalOpenBlock(openBlock: OpenBlock): void;
    handleSearchBlock(searchBlock: SearchBlock): any;
    handleLearnBlock(learnBlock: LearnBlock): any;
    handleReasoningBlock(reasoningBlock: ReasoningBlock): any;
    handleReasoningSequence(reasoningSeq: ReasoningSequence): any;
    /**
     * Cleanup: Destroy all resources and stop timers
     * Call this when shutting down the interpreter to prevent memory leaks
     * (e.g., after all tests complete or on process exit)
     */
    destroy(): void;
}
export declare function interpret(blocks: ASTNode[], logger?: Logger): ExecutionContext;
//# sourceMappingURL=interpreter.d.ts.map