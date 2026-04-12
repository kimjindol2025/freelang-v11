"use strict";
// FreeLang v9: Phase 74 — Static Analysis Linter
// FLLinter: 플러그인 기반 정적 분석 엔진
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLLinter = void 0;
exports.walkAST = walkAST;
exports.buildLintContext = buildLintContext;
exports.createDefaultLinter = createDefaultLinter;
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
// ──────────────────────────────────────────────
// AST 순회 유틸
// ──────────────────────────────────────────────
/**
 * AST를 깊이 우선 순회하며 콜백 실행
 */
function walkAST(nodes, cb, parent) {
    for (const node of nodes) {
        cb(node, parent);
        if (node.kind === "block") {
            for (const [, val] of node.fields) {
                const children = Array.isArray(val) ? val : [val];
                walkAST(children, cb, node);
            }
        }
        else if (node.kind === "sexpr") {
            cb(node, parent);
            walkAST(node.args, cb, node);
        }
        else if (node.kind === "pattern-match") {
            walkAST([node.value], cb, node);
            for (const c of node.cases) {
                walkAST([c.body], cb, node);
                if (c.guard)
                    walkAST([c.guard], cb, node);
            }
            if (node.defaultCase)
                walkAST([node.defaultCase], cb, node);
        }
        else if (node.kind === "try-block") {
            walkAST([node.body], cb, node);
            if (node.catchClauses) {
                for (const clause of node.catchClauses) {
                    walkAST([clause.handler], cb, node);
                }
            }
            if (node.finallyBlock)
                walkAST([node.finallyBlock], cb, node);
        }
        else if (node.kind === "await") {
            walkAST([node.argument], cb, node);
        }
        else if (node.kind === "throw") {
            walkAST([node.argument], cb, node);
        }
        else if (node.kind === "async-function") {
            walkAST([node.body], cb, node);
        }
    }
}
/**
 * 소스에서 심볼의 줄 번호 추정 (간단 구현)
 */
function estimateLine(src, varName) {
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(varName))
            return i + 1;
    }
    return undefined;
}
// ──────────────────────────────────────────────
// LintContext 빌더
// ──────────────────────────────────────────────
function buildLintContext(ast, source) {
    const functions = new Set();
    const variables = new Set();
    const funcArity = new Map();
    // 내장 함수들
    const builtins = [
        "print", "println", "+", "-", "*", "/", "%", "<", ">", "<=", ">=", "=", "!=",
        "and", "or", "not", "if", "cond", "let", "define", "do", "begin",
        "list", "array", "map", "get", "set", "push", "pop", "length", "count",
        "filter", "reduce", "each", "range", "concat", "str", "num", "bool",
        "first", "rest", "cons", "nil?", "empty?", "null?", "type-of",
        "string-length", "substring", "string-split", "string-join", "string-contains",
        "keys", "values", "entries", "merge", "json-parse", "json-stringify",
        "throw", "try", "catch", "await", "async",
        "match", "fn", "let*",
        "append", "reverse", "sort", "zip", "flat-map",
        "max", "min", "abs", "floor", "ceil", "round", "sqrt", "pow",
        "now", "date-format", "sleep", "http-get", "http-post",
        // Phase 63+ 추가 내장
        "defstruct", "defprotocol", "impl", "->", "push!", "map-get", "map-set",
        "defmacro", "when", "unless", "iterate", "take", "filter-lazy",
        "parallel", "channel", "send!", "receive!",
        "assoc", "dissoc", "update",
    ];
    for (const b of builtins) {
        functions.add(b);
    }
    // 미리 정의된 arities (알려진 내장 함수)
    const knownArities = {
        "not": 1, "nil?": 1, "empty?": 1, "null?": 1, "type-of": 1,
        "length": 1, "count": 1, "first": 1, "rest": 1, "reverse": 1,
        "keys": 1, "values": 1, "json-parse": 1, "json-stringify": 1,
        "str": 1, "num": 1, "bool": 1, "abs": 1, "floor": 1, "ceil": 1,
        "round": 1, "sqrt": 1,
        "print": 1, "println": 1,
        "+": 2, "-": 2, "*": 2, "/": 2, "%": 2,
        "<": 2, ">": 2, "<=": 2, ">=": 2, "=": 2, "!=": 2,
        "and": 2, "or": 2,
        "get": 2, "push": 2, "cons": 2, "concat": 2, "pow": 2,
        "merge": 2, "zip": 2, "append": 2, "assoc": 3, "dissoc": 2,
        "filter": 2, "each": 2, "map": 2, "sort": 2, "flat-map": 2,
        "reduce": 3, "range": 2, "substring": 3,
    };
    for (const [fn, arity] of Object.entries(knownArities)) {
        funcArity.set(fn, arity);
    }
    // FUNC 블록에서 함수 정의 수집
    for (const node of ast) {
        if (node.kind === "block" && node.type === "FUNC") {
            functions.add(node.name);
            const paramsField = node.fields.get("params");
            if (paramsField) {
                const params = Array.isArray(paramsField) ? paramsField : [paramsField];
                // Array 블록이면 items를 확인
                if (params.length === 1 && params[0].kind === "block" && params[0].type === "Array") {
                    const items = params[0].fields?.get("items");
                    if (Array.isArray(items)) {
                        funcArity.set(node.name, items.length);
                    }
                    else {
                        funcArity.set(node.name, 0);
                    }
                }
                else {
                    // 직접 변수 배열인 경우
                    const varParams = params.filter((p) => p.kind === "variable");
                    funcArity.set(node.name, varParams.length);
                }
            }
            else {
                funcArity.set(node.name, 0);
            }
        }
    }
    // 전역 define에서 변수 수집
    for (const node of ast) {
        if (node.kind === "sexpr" && node.op === "define" && node.args.length >= 1) {
            const nameNode = node.args[0];
            if (nameNode.kind === "variable") {
                variables.add(nameNode.name);
            }
        }
    }
    return { source, functions, variables, funcArity };
}
// ──────────────────────────────────────────────
// FLLinter 클래스
// ──────────────────────────────────────────────
class FLLinter {
    constructor() {
        this.rules = [];
    }
    addRule(rule) {
        this.rules.push(rule);
        return this;
    }
    lint(src) {
        let tokens;
        let ast;
        try {
            tokens = (0, lexer_1.lex)(src);
            ast = (0, parser_1.parse)(tokens);
        }
        catch (e) {
            return [{
                    rule: "parse-error",
                    severity: "error",
                    message: `Parse error: ${e.message}`,
                }];
        }
        const ctx = buildLintContext(ast, src);
        const diagnostics = [];
        for (const rule of this.rules) {
            try {
                const diags = rule.check(ast, ctx);
                diagnostics.push(...diags);
            }
            catch (e) {
                // 규칙 자체 에러는 무시
            }
        }
        return diagnostics;
    }
    /**
     * severity 필터링
     */
    lintFiltered(src, severity) {
        return this.lint(src).filter(d => d.severity === severity);
    }
}
exports.FLLinter = FLLinter;
/**
 * 기본 7개 규칙이 모두 포함된 FLLinter 인스턴스 생성
 */
function createDefaultLinter() {
    const { ALL_RULES } = require("./lint-rules");
    const linter = new FLLinter();
    for (const rule of ALL_RULES) {
        linter.addRule(rule);
    }
    return linter;
}
//# sourceMappingURL=linter.js.map