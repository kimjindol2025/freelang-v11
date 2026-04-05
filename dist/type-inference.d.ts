import { TypeAnnotation } from "./ast";
export { TypeAnnotation };
export interface InferenceContext {
    variableTypes: Map<string, TypeAnnotation>;
    functionTypes: Map<string, {
        params: TypeAnnotation[];
        returnType: TypeAnnotation;
    }>;
    constraints: Array<{
        type: string;
        left: string;
        right: TypeAnnotation;
    }>;
    typeVariables: Map<string, TypeAnnotation>;
}
export declare class TypeInferenceEngine {
    private context;
    constructor();
    private registerBuiltinOperators;
    /**
     * Infer the type of an AST node
     */
    inferType(node: any): TypeAnnotation;
    /**
     * Register a variable type in the context
     */
    registerVariable(name: string, type: TypeAnnotation): void;
    /**
     * Register a function type in the context
     */
    registerFunction(name: string, paramTypes: TypeAnnotation[], returnType: TypeAnnotation): void;
    /**
     * Resolve generic type parameters
     * Example: identity<T>(x: T) called with 5 (int) → T = int
     */
    resolveGenericType(genericFunc: any, concreteArgType: TypeAnnotation): Map<string, TypeAnnotation>;
    /**
     * Solve type constraints
     * Example: constraints like "T must support +" → T = int
     */
    solveConstraints(constraints: Array<{
        variable: string;
        operator: string;
    }>): Map<string, TypeAnnotation>;
    /**
     * Unify two types (make them compatible)
     */
    private unifyTypes;
    /**
     * Get context for inspection
     */
    getContext(): InferenceContext;
    /**
     * Pretty-print type annotation
     */
    static typeToString(type: TypeAnnotation): string;
}
//# sourceMappingURL=type-inference.d.ts.map