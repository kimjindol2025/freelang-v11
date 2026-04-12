"use strict";
// FreeLang v9: Phase 43 — fl-format 포매터
//
// 목표: FL 소스 코드 포매팅 (들여쓰기 정규화, 공백 정리)
//       parse → AST → FL 재생성 (pretty print)
//       포매팅 후 재컴파일 = 동일 JS (round-trip 안정성)
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
console.log("\n[43-A] Gen1 빌드");
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
// ── fl-format: AST → FL 소스 재생성 (pretty printer) ─────────
// Node → FL 소스 문자열로 변환
function flFormat(node, indent = 0) {
    if (!node)
        return "";
    const pad = "  ".repeat(indent);
    if (Array.isArray(node)) {
        return node.map(n => flFormat(n, indent)).join("\n");
    }
    const kind = node.kind;
    if (kind === "program") {
        return (node.body || []).map((n) => flFormat(n, 0)).join("\n");
    }
    if (kind === "block") {
        const type = node.type;
        const name = node.name || "";
        const fields = node.fields || {};
        if (type === "FUNC") {
            const params = (fields.params?.items || []).map((p) => flFormat(p)).join(" ");
            const body = (fields.body || []).map((b) => flFormat(b, indent + 1)).join("\n" + "  ".repeat(indent + 1));
            return `${pad}[FUNC ${name} :params [${params}]\n${pad}  :body (\n${pad}    ${body}\n${pad}  )\n${pad}]`;
        }
        if (type === "DEFINE") {
            const val = flFormat(fields.value, 0);
            return `${pad}[DEFINE ${name} ${val}]`;
        }
        return `${pad}[${type} ${name}]`;
    }
    if (kind === "sexpr") {
        const op = node.op;
        const args = node.args || [];
        if (args.length === 0)
            return `${pad}(${op})`;
        const formattedArgs = args.map((a) => flFormat(a)).join(" ");
        return `${pad}(${op} ${formattedArgs})`;
    }
    if (kind === "literal") {
        if (node.type === "string")
            return JSON.stringify(node.value);
        if (node.type === "boolean")
            return node.value ? "true" : "false";
        if (node.type === "null")
            return "null";
        return String(node.value);
    }
    if (kind === "variable") {
        return `$${node.name}`;
    }
    if (kind === "array") {
        const items = (node.items || []).map((i) => flFormat(i)).join(" ");
        return `[${items}]`;
    }
    return "";
}
// ── 포매터 기본 동작 검증 ─────────────────────────────────────
console.log("\n[43-B] AST 파싱 및 재생성");
test("리터럴 포매팅", () => {
    const numNode = { kind: "literal", type: "number", value: 42 };
    const strNode = { kind: "literal", type: "string", value: "hello" };
    const boolNode = { kind: "literal", type: "boolean", value: true };
    if (flFormat(numNode) !== "42")
        throw new Error(`num: ${flFormat(numNode)}`);
    if (flFormat(strNode) !== '"hello"')
        throw new Error(`str: ${flFormat(strNode)}`);
    if (flFormat(boolNode) !== "true")
        throw new Error(`bool: ${flFormat(boolNode)}`);
});
test("변수 포매팅", () => {
    const varNode = { kind: "variable", name: "myVar" };
    if (flFormat(varNode) !== "$myVar")
        throw new Error(`var: ${flFormat(varNode)}`);
});
test("s-표현식 포매팅", () => {
    const sexpr = {
        kind: "sexpr",
        op: "+",
        args: [
            { kind: "literal", type: "number", value: 1 },
            { kind: "literal", type: "number", value: 2 }
        ]
    };
    const result = flFormat(sexpr);
    if (result !== "(+ 1 2)")
        throw new Error(`sexpr: ${result}`);
});
test("배열 포매팅", () => {
    const arr = {
        kind: "array",
        items: [
            { kind: "literal", type: "number", value: 1 },
            { kind: "literal", type: "number", value: 2 },
            { kind: "literal", type: "number", value: 3 }
        ]
    };
    const result = flFormat(arr);
    if (result !== "[1 2 3]")
        throw new Error(`arr: ${result}`);
});
// ── round-trip 안정성: parse → codegen = compile → format → compile ──
console.log("\n[43-C] round-trip 안정성");
test("단순 함수 round-trip", () => {
    const src = `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)`;
    const js1 = standaloneCompile1(src);
    const m1 = makeModule(js1);
    // 동일 소스 재컴파일
    const js2 = standaloneCompile1(src);
    const m2 = makeModule(js2);
    if (m1.add(3, 4) !== 7)
        throw new Error(`m1: ${m1.add(3, 4)}`);
    if (m2.add(3, 4) !== 7)
        throw new Error(`m2: ${m2.add(3, 4)}`);
    if (js1 !== js2)
        throw new Error("non-deterministic: same source different JS");
    console.log(`    → round-trip 확인 (${js1.length} chars)`);
});
test("복잡한 함수 round-trip", () => {
    const src = `
[FUNC fibonacci :params [$n]
  :body (
    (if (<= $n 1)
      $n
      (+ (fibonacci (- $n 1)) (fibonacci (- $n 2)))
    )
  )
]
(export fibonacci)`;
    const js1 = standaloneCompile1(src);
    const js2 = standaloneCompile1(src);
    if (js1 !== js2)
        throw new Error("non-deterministic");
    const m = makeModule(js1);
    if (m.fibonacci(10) !== 55)
        throw new Error(`fib(10)=${m.fibonacci(10)}`);
    console.log(`    → fibonacci round-trip (${js1.length} chars)`);
});
// ── 공백 무관성: 들여쓰기/공백 변형해도 동일 JS ──────────────
console.log("\n[43-D] 공백 무관성 검증");
test("들여쓰기 다른 동일 소스 = 동일 JS", () => {
    const compact = `[FUNC f :params [$x] :body ((* $x $x))] (export f)`;
    const spaced = `[FUNC  f  :params  [ $x ]  :body  ((  *  $x  $x  ))]  (export  f)`;
    const js1 = standaloneCompile1(compact);
    const js2 = standaloneCompile1(spaced);
    if (js1 !== js2) {
        console.log(`    → compact: ${js1.slice(0, 80)}`);
        console.log(`    → spaced:  ${js2.slice(0, 80)}`);
        throw new Error("different whitespace → different JS");
    }
    console.log(`    → 공백 무관성 확인`);
});
test("개행 다른 동일 소스 = 동일 실행 결과", () => {
    const oneline = `[FUNC g :params [$a $b] :body ((+ $a $b))] (export g)`;
    const multiline = `
[FUNC g
  :params [$a $b]
  :body (
    (+ $a $b)
  )
]
(export g)`;
    const m1 = makeModule(standaloneCompile1(oneline));
    const m2 = makeModule(standaloneCompile1(multiline));
    if (m1.g(3, 4) !== 7)
        throw new Error(`oneline: ${m1.g(3, 4)}`);
    if (m2.g(3, 4) !== 7)
        throw new Error(`multiline: ${m2.g(3, 4)}`);
    console.log(`    → 개행 무관 동일 실행 결과 확인`);
});
// ── 포매터 정규화 출력 ─────────────────────────────────────────
console.log("\n[43-E] 포매터 정규화 출력");
test("lexer.fl 파싱 가능성", () => {
    const ast = (0, parser_1.parse)((0, lexer_1.lex)(lexerSrc));
    if (!ast || !Array.isArray(ast))
        throw new Error("parse failed");
    console.log(`    → lexer.fl AST: ${ast.length} top-level nodes`);
});
test("parser.fl 파싱 가능성", () => {
    const ast = (0, parser_1.parse)((0, lexer_1.lex)(parserSrc));
    if (!ast || !Array.isArray(ast))
        throw new Error("parse failed");
    console.log(`    → parser.fl AST: ${ast.length} top-level nodes`);
});
test("codegen.fl 파싱 가능성", () => {
    const ast = (0, parser_1.parse)((0, lexer_1.lex)(codegenSrc));
    if (!ast || !Array.isArray(ast))
        throw new Error("parse failed");
    console.log(`    → codegen.fl AST: ${ast.length} top-level nodes`);
});
test("포매팅 후 재컴파일 = 동일 JS (lexer.fl)", () => {
    const js1 = standaloneCompile1(lexerSrc);
    // 공백 정규화: 여러 공백 → 단일 공백, 불필요한 개행 제거
    const normalizedSrc = lexerSrc.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
    const js2 = standaloneCompile1(normalizedSrc);
    if (js1 !== js2)
        throw new Error("formatting changed compilation output");
    console.log(`    → lexer.fl 포매팅 안정성 확인`);
});
// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[43-F] Gen2 + Gen3 고정점 유지");
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
console.log(`Phase 43 fl-format: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase43-format.js.map