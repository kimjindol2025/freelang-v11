"use strict";
// Phase 6: Type Inference Engine
// 변수 타입 추론, 함수 반환 타입 추론, 제네릭 타입 매개변수 추론
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeInferenceEngine = void 0;
class TypeInferenceEngine {
    constructor() {
        this.context = {
            variableTypes: new Map(),
            functionTypes: new Map(),
            constraints: [],
            typeVariables: new Map(),
        };
        // Register built-in operators
        this.registerBuiltinOperators();
    }
    registerBuiltinOperators() {
        // Arithmetic: int -> int -> int
        for (const op of ["+", "-", "*", "/"]) {
            this.context.functionTypes.set(op, {
                params: [{ kind: "type", name: "int" }, { kind: "type", name: "int" }],
                returnType: { kind: "type", name: "int" },
            });
        }
        // Comparison: any -> any -> bool
        for (const op of ["=", "<", ">", "<=", ">="]) {
            this.context.functionTypes.set(op, {
                params: [{ kind: "type", name: "any" }, { kind: "type", name: "any" }],
                returnType: { kind: "type", name: "bool" },
            });
        }
        // String operations
        this.context.functionTypes.set("concat", {
            params: [{ kind: "type", name: "string" }, { kind: "type", name: "string" }],
            returnType: { kind: "type", name: "string" },
        });
        this.context.functionTypes.set("strlen", {
            params: [{ kind: "type", name: "string" }],
            returnType: { kind: "type", name: "int" },
        });
        // Array operations
        this.context.functionTypes.set("first", {
            params: [{ kind: "type", name: "array<T>", isTypeVariable: true }],
            returnType: { kind: "type", name: "T", isTypeVariable: true },
        });
        // Logic
        this.context.functionTypes.set("not", {
            params: [{ kind: "type", name: "bool" }],
            returnType: { kind: "type", name: "bool" },
        });
    }
    /**
     * Infer the type of an AST node
     */
    inferType(node) {
        if (!node) {
            return { kind: "type", name: "any" };
        }
        const kind = node.kind;
        switch (kind) {
            // Literals: determine type from value
            case "literal": {
                const lit = node;
                if (lit.type === "number") {
                    return { kind: "type", name: "int" };
                }
                else if (lit.type === "string") {
                    return { kind: "type", name: "string" };
                }
                else if (lit.type === "boolean") {
                    return { kind: "type", name: "bool" };
                }
                else if (Array.isArray(lit.value)) {
                    // Array type: infer element type
                    if (lit.value.length === 0) {
                        return { kind: "type", name: "array<any>" };
                    }
                    const elemType = this.inferType(lit.value[0]);
                    return { kind: "type", name: `array<${elemType.name}>` };
                }
                return { kind: "type", name: "any" };
            }
            // Variables: look up in context
            case "variable": {
                const v = node;
                if (this.context.variableTypes.has(v.name)) {
                    return this.context.variableTypes.get(v.name);
                }
                // If not found, check if it's a type variable (generic)
                if (this.context.typeVariables.has(v.name)) {
                    return this.context.typeVariables.get(v.name);
                }
                return { kind: "type", name: "unknown" };
            }
            // Function calls (SExpr): look up operator type and infer from operands
            case "sexpr": {
                const sexpr = node;
                const opName = sexpr.op;
                // Look up function type
                if (this.context.functionTypes.has(opName)) {
                    const funcType = this.context.functionTypes.get(opName);
                    return funcType.returnType;
                }
                // Default: any
                return { kind: "type", name: "any" };
            }
            // Block: infer type of last field value
            case "block": {
                const block = node;
                if (block.fields && block.fields.size > 0) {
                    const fields = Array.from(block.fields.values());
                    const lastField = fields[fields.length - 1];
                    if (Array.isArray(lastField)) {
                        return this.inferType(lastField[lastField.length - 1]);
                    }
                    return this.inferType(lastField);
                }
                return { kind: "type", name: "any" };
            }
            // If expression: unify branch types
            case "if": {
                const ifNode = node;
                const thenType = this.inferType(ifNode.consequent);
                const elseType = ifNode.alternate ? this.inferType(ifNode.alternate) : { kind: "type", name: "any" };
                // Unify types
                return this.unifyTypes(thenType, elseType);
            }
            // Function block: infer return type from body
            case "function-block": {
                const func = node;
                // Register parameter types if available
                if (func.params && Array.isArray(func.params)) {
                    for (const param of func.params) {
                        if (param.type) {
                            this.context.variableTypes.set(param.name, param.type);
                        }
                    }
                }
                // Infer type from function body
                if (func.body) {
                    return this.inferType(func.body);
                }
                return { kind: "type", name: "any" };
            }
            default:
                return { kind: "type", name: "any" };
        }
    }
    /**
     * Register a variable type in the context
     */
    registerVariable(name, type) {
        this.context.variableTypes.set(name, type);
    }
    /**
     * Register a function type in the context
     */
    registerFunction(name, paramTypes, returnType) {
        this.context.functionTypes.set(name, { params: paramTypes, returnType });
    }
    /**
     * Resolve generic type parameters
     * Example: identity<T>(x: T) called with 5 (int) → T = int
     */
    resolveGenericType(genericFunc, concreteArgType) {
        const typeMap = new Map();
        if (genericFunc.generics && genericFunc.generics.length > 0) {
            const typeVar = genericFunc.generics[0]; // First generic parameter
            typeMap.set(typeVar, concreteArgType);
        }
        return typeMap;
    }
    /**
     * Solve type constraints
     * Example: constraints like "T must support +" → T = int
     */
    solveConstraints(constraints) {
        const solution = new Map();
        for (const constraint of constraints) {
            // If operator is +, constraint is T: int (must support +)
            if (["+", "-", "*", "/"].includes(constraint.operator)) {
                solution.set(constraint.variable, { kind: "type", name: "int" });
            }
            else if (["concat", "++"].includes(constraint.operator)) {
                solution.set(constraint.variable, { kind: "type", name: "string" });
            }
        }
        return solution;
    }
    /**
     * Unify two types (make them compatible)
     */
    unifyTypes(type1, type2) {
        // Same type
        if (type1.name === type2.name) {
            return type1;
        }
        // One is 'any'
        if (type1.name === "any")
            return type2;
        if (type2.name === "any")
            return type1;
        // One is 'unknown'
        if (type1.name === "unknown")
            return type2;
        if (type2.name === "unknown")
            return type1;
        // Type mismatch: create union type
        return {
            kind: "type",
            name: `${type1.name} | ${type2.name}`,
            union: [type1, type2],
        };
    }
    /**
     * Get context for inspection
     */
    getContext() {
        return this.context;
    }
    /**
     * Pretty-print type annotation
     */
    static typeToString(type) {
        if (type.union) {
            return type.union.map((t) => this.typeToString(t)).join(" | ");
        }
        if (type.generic) {
            return `${type.name}<${this.typeToString(type.generic)}>`;
        }
        if (type.optional) {
            return `${type.name}?`;
        }
        return type.name;
    }
}
exports.TypeInferenceEngine = TypeInferenceEngine;
//# sourceMappingURL=type-inference.js.map