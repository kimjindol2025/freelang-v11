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
exports.makeAsyncFunction = makeAsyncFunction;
exports.makeAwaitExpression = makeAwaitExpression;
exports.makeTryBlock = makeTryBlock;
exports.makeCatchClause = makeCatchClause;
exports.makeThrowExpression = makeThrowExpression;
exports.makeReasoningBlock = makeReasoningBlock;
exports.makeReasoningTransition = makeReasoningTransition;
exports.makeReasoningSequence = makeReasoningSequence;
exports.isBlock = isBlock;
exports.isLiteral = isLiteral;
exports.isSymbolLiteral = isSymbolLiteral;
exports.isArrayBlock = isArrayBlock;
exports.isFuncBlock = isFuncBlock;
exports.isVariable = isVariable;
exports.isSExpr = isSExpr;
exports.isModuleBlock = isModuleBlock;
exports.isImportBlock = isImportBlock;
exports.isOpenBlock = isOpenBlock;
exports.isSearchBlock = isSearchBlock;
exports.isLearnBlock = isLearnBlock;
exports.isReasoningBlock = isReasoningBlock;
exports.isReasoningSequence = isReasoningSequence;
exports.isTryBlock = isTryBlock;
exports.isCatchClause = isCatchClause;
exports.isThrowExpression = isThrowExpression;
// Helpers
function makeLiteral(type, value) {
    return { kind: "literal", type, value };
}
function makeVariable(name) {
    return { kind: "variable", name };
}
function makeSExpr(op, args, line) {
    return { kind: "sexpr", op, args, line };
}
function makeKeyword(name) {
    return { kind: "keyword", name };
}
function makeBlock(type, name, fields, line) {
    return { kind: "block", type, name, fields, line };
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
// Helper: Create async function (Phase 7)
function makeAsyncFunction(name, params, body) {
    return { kind: "async-function", name, params, body };
}
// Helper: Create await expression (Phase 7)
function makeAwaitExpression(argument) {
    return { kind: "await", argument };
}
// Helper: Create try block (Phase 11)
function makeTryBlock(body, catchClauses, finallyBlock) {
    return { kind: "try-block", body, catchClauses, finallyBlock };
}
// Helper: Create catch clause (Phase 11)
function makeCatchClause(handler, pattern, variable) {
    return { kind: "catch-clause", pattern, variable, handler };
}
// Helper: Create throw expression (Phase 11)
function makeThrowExpression(argument) {
    return { kind: "throw", argument };
}
// Helper: Create reasoning block (Phase 9c)
function makeReasoningBlock(stage, data, observations, analysis, decisions, actions, verifications, transitions, metadata) {
    return {
        kind: "reasoning-block",
        stage,
        data,
        observations,
        analysis,
        decisions,
        actions,
        verifications,
        transitions,
        metadata
    };
}
// Helper: Create reasoning transition (Phase 9c)
function makeReasoningTransition(from, to, condition, action) {
    return { from, to, condition, action };
}
// Helper: Create reasoning sequence (Phase 9c Extension)
function makeReasoningSequence(stages, metadata) {
    return { kind: "reasoning-sequence", stages, metadata };
}
// ============================================================
// Phase 6: Type Guard Functions (타입 안전성 강화)
// ============================================================
// Block 타입 가드
function isBlock(node) {
    return node && node.kind === "block";
}
// Literal 타입 가드
function isLiteral(node) {
    return node && node.kind === "literal";
}
// Symbol 리터럴 가드
function isSymbolLiteral(node) {
    return isLiteral(node) && node.type === "symbol";
}
// 배열 블록 가드 (특수: [Array ...] 형식)
function isArrayBlock(node) {
    return isBlock(node) && node.type === "Array";
}
// FUNC 블록 가드
function isFuncBlock(node) {
    return isBlock(node) && node.type === "FUNC";
}
// Variable 타입 가드
function isVariable(node) {
    return node && node.kind === "variable";
}
// SExpr 타입 가드
function isSExpr(node) {
    return node && node.kind === "sexpr";
}
// ModuleBlock 타입 가드
function isModuleBlock(node) {
    return node && node.kind === "module";
}
// ImportBlock 타입 가드
function isImportBlock(node) {
    return node && node.kind === "import";
}
// OpenBlock 타입 가드
function isOpenBlock(node) {
    return node && node.kind === "open";
}
// SearchBlock 타입 가드 (NEW for Phase 9a)
function isSearchBlock(node) {
    return node && node.kind === "search-block";
}
// LearnBlock 타입 가드 (NEW for Phase 9b)
function isLearnBlock(node) {
    return node && node.kind === "learn-block";
}
// ReasoningBlock 타입 가드 (NEW for Phase 9c)
function isReasoningBlock(node) {
    return node && node.kind === "reasoning-block";
}
// ReasoningSequence 타입 가드 (NEW for Phase 9c Extension)
function isReasoningSequence(node) {
    return node && node.kind === "reasoning-sequence";
}
// TryBlock 타입 가드 (NEW for Phase 11)
function isTryBlock(node) {
    return node && node.kind === "try-block";
}
// CatchClause 타입 가드 (NEW for Phase 11)
function isCatchClause(node) {
    return node && node.kind === "catch-clause";
}
// ThrowExpression 타입 가드 (NEW for Phase 11)
function isThrowExpression(node) {
    return node && node.kind === "throw";
}
//# sourceMappingURL=ast.js.map