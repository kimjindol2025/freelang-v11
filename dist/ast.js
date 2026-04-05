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
//# sourceMappingURL=ast.js.map