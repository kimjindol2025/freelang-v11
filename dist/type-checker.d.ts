import { ASTNode, TypeAnnotation } from "./ast";
export interface ValidationResult {
    valid: boolean;
    message: string;
    inferredType?: TypeAnnotation;
}
export interface FunctionType {
    params: TypeAnnotation[];
    returnType: TypeAnnotation;
}
export declare class TypeChecker {
    private functionTypes;
    private variableTypes;
    /**
     * Register a function type (from FUNC block with type annotations)
     */
    registerFunction(funcName: string, paramTypes: TypeAnnotation[], returnType: TypeAnnotation): void;
    /**
     * Register a variable type
     */
    registerVariable(varName: string, type: TypeAnnotation): void;
    /**
     * Check function call: verify argument types match parameter types
     */
    checkFunctionCall(funcName: string, argTypes: TypeAnnotation[]): ValidationResult;
    /**
     * Check variable assignment
     */
    checkAssignment(varName: string, valueType: TypeAnnotation, declaredType?: TypeAnnotation): ValidationResult;
    /**
     * Infer type from AST node
     */
    inferType(node: ASTNode): TypeAnnotation;
    /**
     * Check type compatibility
     */
    private isCompatible;
}
export declare function createTypeChecker(): TypeChecker;
//# sourceMappingURL=type-checker.d.ts.map