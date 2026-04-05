import express from "express";
import { ASTNode, TypeAnnotation } from "./ast";
import { TypeChecker } from "./type-checker";
import { Logger } from "./logger";
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
    lastValue?: any;
    typeChecker?: TypeChecker;
    typeClasses?: Map<string, TypeClassInfo>;
    typeClassInstances?: Map<string, TypeClassInstanceInfo>;
    modules?: Map<string, ModuleInfo>;
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
export interface TypeClassInfo {
    name: string;
    typeParams: string[];
    methods: Map<string, string>;
}
export interface TypeClassInstanceInfo {
    className: string;
    concreteType: string;
    implementations: Map<string, any>;
}
export interface ModuleInfo {
    name: string;
    exports: string[];
    functions: Map<string, FreeLangFunction>;
}
export declare class Interpreter {
    private context;
    private logger;
    constructor(app?: express.Express, logger?: Logger);
    interpret(blocks: ASTNode[]): ExecutionContext;
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
    private callAsyncFunctionValue;
    private callFunction;
    private getFieldValue;
    private evalPatternMatch;
    private matchPattern;
    getContext(): ExecutionContext;
    setVariable(name: string, value: any): void;
    private registerBuiltinTypeClasses;
    private bindMonad;
    private bindList;
    private mapResult;
    private mapOption;
    private mapList;
    getTypeClass(name: string): TypeClassInfo | undefined;
    getTypeClassInstance(className: string, concreteType: string): TypeClassInstanceInfo | undefined;
    satisfiesConstraint(type: string, constraintClass: string): boolean;
    private resolveMethod;
    private getModules;
    private evalModuleBlock;
    private evalImportBlock;
    private getConcreteType;
    private evalOpenBlock;
    private evalTypeClass;
    private evalInstance;
}
export declare function interpret(blocks: ASTNode[], app?: express.Express, logger?: Logger): ExecutionContext;
//# sourceMappingURL=interpreter.d.ts.map