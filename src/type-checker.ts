// FreeLang v9: Type Checker (Phase 3)
// Type validation and inference engine

import { ASTNode, TypeAnnotation, Block, Literal, Variable, SExpr } from "./ast";

export interface ValidationResult {
  valid: boolean;
  message: string;
  inferredType?: TypeAnnotation;
}

export interface FunctionType {
  params: TypeAnnotation[];
  returnType: TypeAnnotation;
  generics?: string[]; // Generic type variables (Phase 4)
  isGeneric?: boolean; // true if function has generic parameters
}

// Built-in operator types
const BUILTIN_TYPES: Map<string, FunctionType> = new Map([
  // Arithmetic
  ["+", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "int" } }],
  ["-", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "int" } }],
  ["*", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "int" } }],
  ["/", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "int" } }],

  // Comparison
  ["=", { params: [{ kind: "type", name: "any" }, { kind: "type", name: "any" }], returnType: { kind: "type", name: "bool" } }],
  ["<", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "bool" } }],
  [">", { params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }], returnType: { kind: "type", name: "bool" } }],

  // String
  ["concat", { params: [{ kind: "type", name: "string" }, { kind: "type", name: "string" }], returnType: { kind: "type", name: "string" } }],
  ["upper", { params: [{ kind: "type", name: "string" }], returnType: { kind: "type", name: "string" } }],
  ["lower", { params: [{ kind: "type", name: "string" }], returnType: { kind: "type", name: "string" } }],

  // Collection
  ["list", { params: [{ kind: "type", name: "any" }], returnType: { kind: "type", name: "array<any>" } }],
]);

export class TypeChecker {
  private functionTypes: Map<string, FunctionType> = new Map();
  private variableTypes: Map<string, TypeAnnotation> = new Map();

  /**
   * Register a function type (from FUNC block with type annotations)
   */
  registerFunction(funcName: string, paramTypes: TypeAnnotation[], returnType: TypeAnnotation): void {
    this.functionTypes.set(funcName, { params: paramTypes, returnType });
  }

  /**
   * Register a variable type
   */
  registerVariable(varName: string, type: TypeAnnotation): void {
    this.variableTypes.set(varName, type);
  }

  /**
   * Check function call: verify argument types match parameter types
   */
  checkFunctionCall(funcName: string, argTypes: TypeAnnotation[]): ValidationResult {
    // Check built-in functions first
    const builtinType = BUILTIN_TYPES.get(funcName);
    if (builtinType) {
      if (argTypes.length !== builtinType.params.length) {
        return {
          valid: false,
          message: `Function '${funcName}' expects ${builtinType.params.length} arguments, got ${argTypes.length}`,
        };
      }
      return { valid: true, message: "OK", inferredType: builtinType.returnType };
    }

    // Check user-defined functions
    const userFuncType = this.functionTypes.get(funcName);
    if (userFuncType) {
      if (argTypes.length !== userFuncType.params.length) {
        return {
          valid: false,
          message: `Function '${funcName}' expects ${userFuncType.params.length} arguments, got ${argTypes.length}`,
        };
      }
      // Check type compatibility
      for (let i = 0; i < argTypes.length; i++) {
        if (!this.isCompatible(argTypes[i], userFuncType.params[i])) {
          return {
            valid: false,
            message: `Argument ${i + 1} to '${funcName}': expected ${userFuncType.params[i].name}, got ${argTypes[i].name}`,
          };
        }
      }
      return { valid: true, message: "OK", inferredType: userFuncType.returnType };
    }

    return { valid: false, message: `Unknown function: ${funcName}` };
  }

  /**
   * Check variable assignment
   */
  checkAssignment(varName: string, valueType: TypeAnnotation, declaredType?: TypeAnnotation): ValidationResult {
    if (declaredType && !this.isCompatible(valueType, declaredType)) {
      return {
        valid: false,
        message: `Variable '${varName}' declared as ${declaredType.name}, but assigned ${valueType.name}`,
      };
    }
    return { valid: true, message: "OK" };
  }

  /**
   * Infer type from AST node
   */
  inferType(node: ASTNode): TypeAnnotation {
    const literal = node as Literal;
    const variable = node as Variable;
    const sexpr = node as SExpr;

    if (literal.kind === "literal") {
      switch (literal.type) {
        case "number":
          return { kind: "type", name: "int" };
        case "string":
          return { kind: "type", name: "string" };
        case "boolean":
          return { kind: "type", name: "bool" };
        default:
          return { kind: "type", name: "any" };
      }
    }

    if (variable.kind === "variable") {
      const varType = this.variableTypes.get(variable.name);
      return varType || { kind: "type", name: "any" };
    }

    if (sexpr.kind === "sexpr") {
      const funcType = BUILTIN_TYPES.get(sexpr.op) || this.functionTypes.get(sexpr.op);
      if (funcType) {
        return funcType.returnType;
      }
    }

    return { kind: "type", name: "any" };
  }

  /**
   * Register a generic function type (Phase 4)
   */
  registerGenericFunction(funcName: string, generics: string[], paramTypes: TypeAnnotation[], returnType: TypeAnnotation): void {
    this.functionTypes.set(funcName, {
      params: paramTypes,
      returnType,
      generics,
      isGeneric: generics.length > 0,
    });
  }

  /**
   * Instantiate generic function with concrete types (Phase 4)
   * E.g., identity[T] with T=int becomes identity with param type int
   */
  instantiateGenericFunction(funcName: string, typeArgs: TypeAnnotation[]): ValidationResult {
    const funcType = this.functionTypes.get(funcName);
    if (!funcType || !funcType.isGeneric) {
      return {
        valid: false,
        message: `Function '${funcName}' is not generic`,
      };
    }

    if (!funcType.generics || typeArgs.length !== funcType.generics.length) {
      return {
        valid: false,
        message: `Function '${funcName}' expects ${funcType.generics?.length || 0} type arguments, got ${typeArgs.length}`,
      };
    }

    // Create type substitution map
    const substitution = new Map<string, TypeAnnotation>();
    for (let i = 0; i < funcType.generics.length; i++) {
      substitution.set(funcType.generics[i], typeArgs[i]);
    }

    // Substitute types in parameters and return type
    const instantiatedParams = funcType.params.map((param) => this.substituteType(param, substitution));
    const instantiatedReturn = this.substituteType(funcType.returnType, substitution);

    return {
      valid: true,
      message: "OK",
      inferredType: instantiatedReturn,
    };
  }

  /**
   * Substitute type variables with concrete types (Phase 4)
   */
  private substituteType(type: TypeAnnotation, substitution: Map<string, TypeAnnotation>): TypeAnnotation {
    // If this type is a generic variable, replace it
    if (type.isTypeVariable && substitution.has(type.name)) {
      return substitution.get(type.name) || type;
    }

    // If this type has a generic parameter, substitute recursively
    if (type.generic) {
      return {
        ...type,
        generic: this.substituteType(type.generic, substitution),
      };
    }

    // If this type is a union, substitute all members
    if (type.union) {
      return {
        ...type,
        union: type.union.map((t) => this.substituteType(t, substitution)),
      };
    }

    return type;
  }

  /**
   * Check type compatibility
   */
  private isCompatible(actualType: TypeAnnotation, expectedType: TypeAnnotation): boolean {
    // Exact match
    if (actualType.name === expectedType.name) return true;

    // "any" is compatible with everything
    if (expectedType.name === "any" || actualType.name === "any") return true;

    // Type coercion rules (simple)
    if (actualType.name === "int" && expectedType.name === "string") return true; // int → string
    if (actualType.name === "string" && expectedType.name === "int") return true; // string → int (simple coercion)

    return false;
  }
}

export function createTypeChecker(): TypeChecker {
  return new TypeChecker();
}
