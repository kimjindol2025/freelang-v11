import { ASTNode, TypeAnnotation } from "./ast";
import { TypeChecker } from "./type-checker";
import { RuntimeTypeChecker } from "./type-system";
import { ScopeStack } from "./interpreter-scope";
import { MacroExpander } from "./macro-expander";
import { ProtocolRegistry } from "./protocol";
import { StructRegistry } from "./struct-system";
export interface ExecutionContext {
    functions: Map<string, FreeLangFunction>;
    routes: Map<string, FreeLangRoute>;
    intents: Map<string, Intent>;
    variables: ScopeStack;
    server?: any;
    middleware: FreeLangMiddleware[];
    errorHandlers: ErrorHandler;
    startTime: number;
    lastValue?: any;
    typeChecker?: TypeChecker;
    runtimeTypeChecker?: RuntimeTypeChecker;
    typeClasses?: Map<string, TypeClassInfo>;
    typeClassInstances?: Map<string, TypeClassInstanceInfo>;
    modules?: Map<string, ModuleInfo>;
    cache?: Map<string, any>;
    learned?: Map<string, any>;
    reasoning?: Map<string, any>;
    currentSearches?: Map<string, any>;
    currentLearned?: Map<string, any>;
    macroExpander: MacroExpander;
    protocols: ProtocolRegistry;
    structs: StructRegistry;
}
export interface FreeLangFunction {
    name: string;
    params: string[];
    body: ASTNode;
    generics?: string[];
    paramTypes?: TypeAnnotation[];
    returnType?: TypeAnnotation;
    capturedEnv?: Map<string, any>;
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
//# sourceMappingURL=interpreter-context.d.ts.map