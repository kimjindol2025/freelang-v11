"use strict";
// FreeLang v9: Phase 44 — fl-check 정적 분석기
//
// 목표: 컴파일 전 정적 검사
//       - 미정의 변수 참조 감지
//       - 인자 개수 불일치 감지
//       - 미사용 정의 경고
//       Gen3 고정점 유지
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vm = __importStar(require("vm"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${e.message?.slice(0, 120)}`);
        failed++;
    }
}
const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"), "utf-8");
const parserSrc = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");
function patternToOp(p) {
    if (!p || p.kind === "wildcard-pattern")
        return "_";
    if (p.kind === "literal-pattern") {
        if (p.type === "string")
            return JSON.stringify(String(p.value));
        return String(p.value);
    }
    if (p.kind === "variable-pattern")
        return p.name;
    return "_";
}
function convertTStoFL(node) {
    if (node === null || node === undefined)
        return node;
    if (typeof node !== "object")
        return node;
    if (Array.isArray(node))
        return node.map(convertTStoFL);
    const kind = node.kind;
    if (kind === "block") {
        const rawFields = node.fields;
        const fields = {};
        if (rawFields instanceof Map) {
            for (const [k, v] of rawFields)
                fields[k] = convertTStoFL(v);
        }
        else if (rawFields && typeof rawFields === "object") {
            for (const [k, v] of Object.entries(rawFields))
                fields[k] = convertTStoFL(v);
        }
        if (node.type === "Array")
            return { kind: "array", items: fields.items || [] };
        if (node.type === "Map")
            return { kind: "map-literal", pairs: fields };
        return { kind: "block", type: node.type, name: node.name, fields, line: node.line ?? null };
    }
    if (kind === "sexpr")
        return { kind: "sexpr", op: node.op, args: (node.args || []).map(convertTStoFL), line: node.line ?? null };
    if (kind === "pattern-match") {
        const subject = convertTStoFL(node.value);
        const cl = (node.cases || []).map((c) => ({
            kind: "sexpr", op: patternToOp(c.pattern), args: [convertTStoFL(c.body)]
        }));
        if (node.defaultCase)
            cl.push({ kind: "sexpr", op: "_", args: [convertTStoFL(node.defaultCase)] });
        return { kind: "sexpr", op: "match", args: [subject, ...cl] };
    }
    const result = {};
    for (const [k, v] of Object.entries(node)) {
        result[k] = Array.isArray(v) ? v.map(convertTStoFL) : convertTStoFL(v);
    }
    return result;
}
function tsCompile(flSrc) {
    const interp = new interpreter_1.Interpreter();
    for (const src of [lexerSrc, parserSrc, codegenSrc]) {
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    }
    const flAst = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(flSrc)));
    interp.context.variables.set("$__fl_ast__", flAst);
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)("(gen-js $__fl_ast__)")));
    return interp.context.lastValue;
}
function makeModule(jsCode) {
    const sandbox = { module: { exports: {} }, console };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    return sandbox.module.exports;
}
// ── Gen1 빌드 ─────────────────────────────────────────────────
console.log("\n[44-A] Gen1 빌드");
let lexerMod1, parserMod1, codegenMod1;
test("lexer.fl → Gen1", () => {
    lexerMod1 = makeModule(tsCompile(lexerSrc));
    if (typeof lexerMod1.lex !== "function")
        throw new Error("lex not exported");
});
test("parser.fl → Gen1", () => {
    parserMod1 = makeModule(tsCompile(parserSrc));
    if (typeof parserMod1.parse !== "function")
        throw new Error("parse not exported");
});
test("codegen.fl → Gen1", () => {
    codegenMod1 = makeModule(tsCompile(codegenSrc));
    if (typeof codegenMod1["gen-js"] !== "function")
        throw new Error("gen-js not exported");
});
function standaloneCompile1(src) {
    return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}
// 내장 함수 목록
const BUILTINS = new Set([
    "+", "-", "*", "/", "%", "=", "!=", "<", ">", "<=", ">=",
    "and", "or", "not", "null?",
    "concat", "length", "slice", "str-join",
    "get", "set", "append", "map", "filter", "reduce", "fold",
    "if", "let", "define", "set!", "do", "begin",
    "loop", "recur", "fn", "match",
    "export", "import", "open",
    "num-to-str", "str-to-num", "replace",
    "null", "true", "false",
    "search", "fetch", "learn", "recall", "remember", "forget",
    "observe", "analyze", "decide", "act", "verify",
    "print", "println", "read-file", "write-file",
    "throw", "try-catch",
]);
class FlChecker {
    constructor() {
        this.errors = [];
        this.funcDefs = new Map(); // name → param count
        this.funcUsed = new Set();
    }
    check(src) {
        this.errors = [];
        this.funcDefs = new Map();
        this.funcUsed = new Set();
        let ast;
        try {
            ast = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(src)));
        }
        catch (e) {
            this.errors.push({ type: "error", message: `Parse error: ${e.message}` });
            return this.errors;
        }
        // Pass 1: 함수 정의 수집
        for (const node of ast) {
            if (node.kind === "block" && node.type === "FUNC") {
                const params = node.fields instanceof Map
                    ? node.fields.get("params")
                    : node.fields.params;
                const paramCount = params?.items?.length ?? 0;
                // variadic check: last param is "&" rest
                const isVariadic = params?.items?.some((p) => p.kind === "literal" && p.value === "&");
                this.funcDefs.set(node.name, isVariadic ? -1 : paramCount);
            }
        }
        // Pass 2: 정적 검사
        for (const node of ast) {
            this.checkNode(node, new Set());
        }
        // Pass 3: 미사용 함수 경고 (export 제외)
        const exported = new Set();
        for (const node of ast) {
            if (node.kind === "sexpr" && node.op === "export") {
                const name = node.args[0]?.value || node.args[0]?.name;
                if (name)
                    exported.add(name);
            }
        }
        for (const [name] of this.funcDefs) {
            if (!this.funcUsed.has(name) && !exported.has(name)) {
                this.errors.push({ type: "warning", message: `Unused function: ${name}` });
            }
        }
        return this.errors;
    }
    checkNode(node, scope) {
        if (!node || typeof node !== "object")
            return;
        if (node.kind === "block") {
            if (node.type === "FUNC") {
                const params = node.fields instanceof Map
                    ? node.fields.get("params")
                    : node.fields.params;
                const body = node.fields instanceof Map
                    ? node.fields.get("body")
                    : node.fields.body;
                const funcScope = new Set(scope);
                if (params?.items) {
                    for (const p of params.items) {
                        if (p.kind === "variable")
                            funcScope.add(p.name);
                        else if (p.kind === "literal" && p.value !== "&")
                            funcScope.add(p.value);
                    }
                }
                if (Array.isArray(body)) {
                    for (const expr of body)
                        this.checkNode(expr, funcScope);
                }
                else {
                    this.checkNode(body, funcScope);
                }
                return;
            }
        }
        if (node.kind === "sexpr") {
            const op = node.op;
            const args = node.args || [];
            if (op === "let") {
                const letScope = new Set(scope);
                const bindings = args[0];
                const letBody = args.slice(1);
                if (bindings?.kind === "array") {
                    for (const binding of bindings.items || []) {
                        if (binding.kind === "array" && binding.items?.length >= 2) {
                            const nameNode = binding.items[0];
                            const valNode = binding.items[1];
                            this.checkNode(valNode, letScope);
                            if (nameNode.kind === "variable")
                                letScope.add(nameNode.name);
                            else if (nameNode.kind === "array") {
                                // destructuring: add each element
                                for (const item of nameNode.items || []) {
                                    if (item.kind === "variable")
                                        letScope.add(item.name);
                                }
                            }
                        }
                    }
                }
                for (const expr of letBody)
                    this.checkNode(expr, letScope);
                return;
            }
            if (op === "define" || op === "set!") {
                if (args[0]?.kind === "variable") {
                    scope.add(args[0].name);
                }
                if (args[1])
                    this.checkNode(args[1], scope);
                return;
            }
            // 함수 호출: 정의된 함수 참조 추적
            if (this.funcDefs.has(op)) {
                this.funcUsed.add(op);
                const expectedArity = this.funcDefs.get(op);
                if (expectedArity >= 0 && args.length !== expectedArity) {
                    this.errors.push({
                        type: "error",
                        message: `Arity mismatch: ${op} expects ${expectedArity} args, got ${args.length}`,
                        line: node.line
                    });
                }
            }
            for (const arg of args)
                this.checkNode(arg, scope);
            return;
        }
        if (node.kind === "variable") {
            const name = node.name;
            if (!scope.has(name) && !this.funcDefs.has(name) && !BUILTINS.has(name)) {
                this.errors.push({
                    type: "error",
                    message: `Undefined variable: $${name}`,
                    line: node.line
                });
            }
            return;
        }
        // 재귀 탐색
        for (const val of Object.values(node)) {
            if (Array.isArray(val)) {
                for (const item of val)
                    this.checkNode(item, scope);
            }
            else if (val && typeof val === "object") {
                this.checkNode(val, scope);
            }
        }
    }
}
const checker = new FlChecker();
// ── 정적 검사 기본 동작 ───────────────────────────────────────
console.log("\n[44-B] 정적 검사 기본 동작");
test("정상 코드 → 에러 없음", () => {
    const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
(export add)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    if (errs.length > 0)
        throw new Error(`unexpected errors: ${errs.map(e => e.message).join(", ")}`);
});
test("구문 오류 감지", () => {
    const src = `[FUNC add :params [$a $b :body ((+ $a $b))]`;
    const errs = checker.check(src);
    if (errs.length === 0)
        throw new Error("should detect parse error");
    console.log(`    → 감지: ${errs[0].message.slice(0, 60)}`);
});
// ── 인자 개수 불일치 감지 ─────────────────────────────────────
console.log("\n[44-C] 인자 개수 불일치 감지");
test("인자 부족 감지", () => {
    const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
[FUNC test :params [] :body ((add 1))]
(export test)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    const arityErr = errs.find(e => e.message.includes("Arity"));
    if (!arityErr)
        throw new Error(`no arity error found. Errors: ${errs.map(e => e.message).join(",")}`);
    console.log(`    → 감지: ${arityErr.message}`);
});
test("인자 과다 감지", () => {
    const src = `
[FUNC double :params [$x] :body ((* $x 2))]
[FUNC test :params [] :body ((double 1 2 3))]
(export test)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    const arityErr = errs.find(e => e.message.includes("Arity"));
    if (!arityErr)
        throw new Error("no arity error found");
    console.log(`    → 감지: ${arityErr.message}`);
});
test("정확한 인자 수 → 에러 없음", () => {
    const src = `
[FUNC mul :params [$a $b] :body ((* $a $b))]
[FUNC test :params [] :body ((mul 3 4))]
(export test)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    if (errs.length > 0)
        throw new Error(`unexpected: ${errs.map(e => e.message).join(",")}`);
});
// ── 미정의 변수 감지 ──────────────────────────────────────────
console.log("\n[44-D] 미정의 변수 감지");
test("함수 내 미정의 변수 감지", () => {
    const src = `
[FUNC bad :params [$x] :body ((+ $x $undefined_var))]
(export bad)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    const varErr = errs.find(e => e.message.includes("Undefined variable"));
    if (!varErr)
        throw new Error("no undefined variable error");
    console.log(`    → 감지: ${varErr.message}`);
});
test("파라미터는 스코프 내 → 에러 없음", () => {
    const src = `
[FUNC f :params [$a $b $c]
  :body (
    (let [[$x (+ $a $b)]]
      (+ $x $c)
    )
  )
]
(export f)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    if (errs.length > 0)
        throw new Error(`unexpected: ${errs.map(e => e.message).join(",")}`);
});
test("let 바인딩 스코프 내 → 에러 없음", () => {
    const src = `
[FUNC compute :params [$n]
  :body (
    (let [[$doubled (* $n 2)] [$tripled (* $n 3)]]
      (+ $doubled $tripled)
    )
  )
]
(export compute)`;
    const errs = checker.check(src).filter(e => e.type === "error");
    if (errs.length > 0)
        throw new Error(`unexpected: ${errs.map(e => e.message).join(",")}`);
});
// ── 미사용 함수 경고 ──────────────────────────────────────────
console.log("\n[44-E] 미사용 함수 경고");
test("미사용 함수 경고 감지", () => {
    const src = `
[FUNC used :params [$x] :body ((+ $x 1))]
[FUNC unused :params [$x] :body ((* $x 2))]
(export used)`;
    const warns = checker.check(src).filter(e => e.type === "warning");
    const unusedWarn = warns.find(e => e.message.includes("unused") || e.message.includes("Unused"));
    if (!unusedWarn)
        throw new Error(`no unused warning. Warnings: ${warns.map(e => e.message).join(",")}`);
    console.log(`    → 감지: ${unusedWarn.message}`);
});
test("export된 함수는 경고 없음", () => {
    const src = `
[FUNC f :params [$x] :body ((+ $x 1))]
(export f)`;
    const warns = checker.check(src).filter(e => e.type === "warning" && e.message.includes("f"));
    if (warns.length > 0)
        throw new Error(`unexpected warning for exported: ${warns[0].message}`);
});
test("내부 함수 참조 → 미사용 아님", () => {
    const src = `
[FUNC helper :params [$x] :body ((* $x 2))]
[FUNC main :params [$n] :body ((helper $n))]
(export main)`;
    const warns = checker.check(src).filter(e => e.type === "warning" && e.message.includes("helper"));
    if (warns.length > 0)
        throw new Error(`helper falsely marked unused`);
});
// ── lexer/parser/codegen.fl 정적 검사 ────────────────────────
console.log("\n[44-F] 핵심 FL 파일 정적 검사");
test("lexer.fl 정적 검사 (에러 없음)", () => {
    const errs = checker.check(lexerSrc).filter(e => e.type === "error");
    if (errs.length > 0) {
        console.log(`    → 에러들: ${errs.slice(0, 3).map(e => e.message).join("; ")}`);
        throw new Error(`${errs.length} errors in lexer.fl`);
    }
    const warns = checker.check(lexerSrc).filter(e => e.type === "warning");
    console.log(`    → 경고 ${warns.length}개, 에러 0개`);
});
test("parser.fl 정적 검사 (에러 없음)", () => {
    const errs = checker.check(parserSrc).filter(e => e.type === "error");
    if (errs.length > 0) {
        console.log(`    → 에러들: ${errs.slice(0, 3).map(e => e.message).join("; ")}`);
        throw new Error(`${errs.length} errors in parser.fl`);
    }
    const warns = checker.check(parserSrc).filter(e => e.type === "warning");
    console.log(`    → 경고 ${warns.length}개, 에러 0개`);
});
// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[44-G] Gen2 + Gen3 고정점 유지");
let lexer2JS = "", parser2JS = "", codegen2JS = "";
let lexerMod2, parserMod2, codegenMod2;
test("standaloneCompile1(lexer.fl) → Gen2", () => {
    lexer2JS = standaloneCompile1(lexerSrc);
    lexerMod2 = makeModule(lexer2JS);
    if (typeof lexerMod2.lex !== "function")
        throw new Error("lex not exported");
    console.log(`    → ${lexer2JS.length} chars`);
});
test("standaloneCompile1(parser.fl) → Gen2", () => {
    parser2JS = standaloneCompile1(parserSrc);
    parserMod2 = makeModule(parser2JS);
    if (typeof parserMod2.parse !== "function")
        throw new Error("parse not exported");
    console.log(`    → ${parser2JS.length} chars`);
});
test("standaloneCompile1(codegen.fl) → Gen2", () => {
    codegen2JS = standaloneCompile1(codegenSrc);
    codegenMod2 = makeModule(codegen2JS);
    if (typeof codegenMod2["gen-js"] !== "function")
        throw new Error("gen-js not exported");
    console.log(`    → ${codegen2JS.length} chars`);
});
function standaloneCompile2(src) {
    return codegenMod2["gen-js"](parserMod2.parse(lexerMod2.lex(src)));
}
let lexer3JS = "", parser3JS = "", codegen3JS = "";
test("standaloneCompile2(lexer.fl) → Gen3", () => {
    lexer3JS = standaloneCompile2(lexerSrc);
    makeModule(lexer3JS);
    console.log(`    → ${lexer3JS.length} chars`);
});
test("standaloneCompile2(parser.fl) → Gen3", () => {
    parser3JS = standaloneCompile2(parserSrc);
    makeModule(parser3JS);
});
test("standaloneCompile2(codegen.fl) → Gen3", () => {
    codegen3JS = standaloneCompile2(codegenSrc);
    makeModule(codegen3JS);
});
test("Gen2===Gen3 lexer 고정점", () => {
    if (lexer2JS !== lexer3JS)
        throw new Error("diff");
});
test("Gen2===Gen3 parser 고정점", () => {
    if (parser2JS !== parser3JS)
        throw new Error("diff");
});
test("Gen2===Gen3 codegen 고정점", () => {
    if (codegen2JS !== codegen3JS)
        throw new Error("diff");
});
// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 44 fl-check: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase44-check.js.map