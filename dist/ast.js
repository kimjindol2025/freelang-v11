"use strict";
// FreeLang v9: AST Node definitions
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLiteral = makeLiteral;
exports.makeVariable = makeVariable;
exports.makeSExpr = makeSExpr;
exports.makeKeyword = makeKeyword;
exports.makeBlock = makeBlock;
exports.makeTypeAnnotation = makeTypeAnnotation;
exports.makeFuncSignature = makeFuncSignature;
exports.makeTypeVariable = makeTypeVariable;
exports.makeFunctionValue = makeFunctionValue;
exports.makeLiteralPattern = makeLiteralPattern;
exports.makeVariablePattern = makeVariablePattern;
exports.makeWildcardPattern = makeWildcardPattern;
exports.makeListPattern = makeListPattern;
exports.makeStructPattern = makeStructPattern;
exports.makeOrPattern = makeOrPattern;
exports.makeMatchCase = makeMatchCase;
exports.makePatternMatch = makePatternMatch;
exports.makeTypeClass = makeTypeClass;
exports.makeTypeClassInstance = makeTypeClassInstance;
exports.makeModuleBlock = makeModuleBlock;
exports.makeImportBlock = makeImportBlock;
exports.makeOpenBlock = makeOpenBlock;
// Helpers
function makeLiteral(type, value) {
    return { kind: "literal", type, value };
}
function makeVariable(name) {
    return { kind: "variable", name };
}
function makeSExpr(op, args) {
    return { kind: "sexpr", op, args };
}
function makeKeyword(name) {
    return { kind: "keyword", name };
}
function makeBlock(type, name, fields) {
    return { kind: "block", type, name, fields };
}
// Helper: Create type annotation (Phase 3)
function makeTypeAnnotation(name, generic, union, optional) {
    return { kind: "type", name, generic, union, optional };
}
// Helper: Create function signature (Phase 3)
function makeFuncSignature(name, params, returnType) {
    return { name, params, returnType };
}
// Helper: Create type variable (Phase 4)
function makeTypeVariable(name) {
    return { kind: "type-variable", name };
}
// Helper: Create function value (Phase 4 Week 1)
function makeFunctionValue(params, body, capturedEnv, name) {
    return { kind: "function-value", params, body, capturedEnv, name };
}
// Helpers: Create patterns (Phase 4 Week 3-4)
function makeLiteralPattern(type, value) {
    return { kind: "literal-pattern", type, value };
}
function makeVariablePattern(name) {
    return { kind: "variable-pattern", name };
}
function makeWildcardPattern() {
    return { kind: "wildcard-pattern" };
}
function makeListPattern(elements, restElement) {
    return { kind: "list-pattern", elements, restElement };
}
function makeStructPattern(fields) {
    return { kind: "struct-pattern", fields };
}
function makeOrPattern(alternatives) {
    return { kind: "or-pattern", alternatives };
}
function makeMatchCase(pattern, body, guard) {
    return { pattern, guard, body };
}
function makePatternMatch(value, cases, defaultCase) {
    return { kind: "pattern-match", value, cases, defaultCase };
}
// Helper: Create type class (Phase 5 Week 2)
function makeTypeClass(name, typeParams, methods) {
    return { kind: "type-class", name, typeParams, methods };
}
// Helper: Create type class instance (Phase 5 Week 2)
function makeTypeClassInstance(className, concreteType, implementations) {
    return { kind: "type-class-instance", className, concreteType, implementations };
}
// Helper: Create module block (Phase 5 Week 3)
function makeModuleBlock(name, exports, body, path) {
    return { kind: "module", name, exports, body, path };
}
// Helper: Create import block (Phase 5 Week 3)
function makeImportBlock(moduleName, source, selective, alias) {
    return { kind: "import", moduleName, source, selective, alias };
}
// Helper: Create open block (Phase 5 Week 3)
function makeOpenBlock(moduleName, source) {
    return { kind: "open", moduleName, source };
}
//# sourceMappingURL=ast.js.map