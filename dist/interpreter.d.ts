import express from "express";
import { ASTNode, Block, TypeAnnotation } from "./ast";
import { TypeChecker } from "./type-checker";
export interface ExecutionContext {
    functions: Map<string, FreeLangFunction>;
    routes: Map<string, FreeLangRoute>;
    intents: Map<string, Intent>;
    variables: Map<string, any>;
    app: express.Express;
    server?: any;
    middleware: FreeLangMiddleware[];
    errorHandlers: ErrorHandler;
    startTime: number;
    typeChecker?: TypeChecker;
}
export interface FreeLangFunction {
    name: string;
    params: string[];
    body: ASTNode;
    generics?: string[];
    paramTypes?: TypeAnnotation[];
    returnType?: TypeAnnotation;
}
export interface FreeLangRoute {
    name: string;
    method: string;
    path: string;
    handler: ASTNode;
}
export interface Intent {
    name: string;
    fields: Map<string, ASTNode>;
}
export interface FreeLangMiddleware {
    name: string;
    config: Map<string, any>;
}
export interface ErrorHandler {
    handlers: Map<number | "default", ASTNode>;
}
export declare class Interpreter {
    private context;
    constructor(app?: express.Express);
    interpret(blocks: Block[]): ExecutionContext;
    private evalBlock;
    private handleServerBlock;
    private handleRouteBlock;
    private handleFuncBlock;
    private handleIntentBlock;
    private handleMiddlewareBlock;
    private handleWebSocketBlock;
    private handleErrorHandlerBlock;
    private setupExpressRoutes;
    eval(node: ASTNode): any;
    private evalSExpr;
    private evalLet;
    private evalCond;
    private callUserFunction;
    private callFunctionValue;
    private callFunction;
    private getFieldValue;
    private evalPatternMatch;
    private matchPattern;
    getContext(): ExecutionContext;
    setVariable(name: string, value: any): void;
}
export declare function interpret(blocks: Block[], app?: express.Express): ExecutionContext;
//# sourceMappingURL=interpreter.d.ts.map