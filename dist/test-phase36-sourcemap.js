"use strict";
// FreeLang v9: Phase 36 — 소스맵 주석 생성
//
// 목표: 생성된 JS에 // @fl:N 소스 위치 주석 삽입
//       FL 소스 line N → JS function/export 앞에 주석
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
console.log("\n[36-A] Gen1 빌드");
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
// ── 소스맵 주석 검증 ──────────────────────────────────────────
console.log("\n[36-B] 소스맵 // @fl:N 주석 생성 검증");
test("FUNC 앞에 @fl 주석", () => {
    const src = `[FUNC add :params [$a $b] :body ((+ $a $b))] (export add)`;
    const js = standaloneCompile1(src);
    if (!js.includes("// @fl:"))
        throw new Error("no @fl comment");
    const match = js.match(/\/\/ @fl:(\d+)/);
    if (!match)
        throw new Error("no @fl:N comment");
    console.log(`    → found "// @fl:${match[1]}"`);
});
test("멀티라인: 각 함수의 FL 소스 라인 추적", () => {
    const src = [
        `[FUNC add :params [$a $b] :body ((+ $a $b))]`,
        `[FUNC mul :params [$a $b] :body ((* $a $b))]`,
        `(export add mul)`,
    ].join("\n");
    const js = standaloneCompile1(src);
    const comments = [...js.matchAll(/\/\/ @fl:(\d+)/g)].map(m => parseInt(m[1]));
    if (comments.length < 3)
        throw new Error(`only ${comments.length} @fl comments`);
    // add: line 1, mul: line 2, export: line 3
    if (comments[0] !== 1)
        throw new Error(`add line=${comments[0]}, want 1`);
    if (comments[1] !== 2)
        throw new Error(`mul line=${comments[1]}, want 2`);
    if (comments[2] !== 3)
        throw new Error(`export line=${comments[2]}, want 3`);
    console.log(`    → @fl lines: ${comments.join(', ')}`);
});
test("들여쓰기 소스의 라인 추적", () => {
    const src = `\n\n[FUNC greet :params [$name]\n  :body ((concat "Hello " $name))\n]\n(export greet)`;
    const js = standaloneCompile1(src);
    const comments = [...js.matchAll(/\/\/ @fl:(\d+)/g)].map(m => parseInt(m[1]));
    if (comments[0] !== 3)
        throw new Error(`greet line=${comments[0]}, want 3`);
    if (comments[1] !== 6)
        throw new Error(`export line=${comments[1]}, want 6`);
    console.log(`    → @fl lines: ${comments.join(', ')}`);
});
test("생성 JS 실행 가능 (주석 포함해도 동작)", () => {
    const src = `[FUNC fact :params [$n] :body ((if (<= $n 1) 1 (* $n (fact (- $n 1)))))] (export fact)`;
    const js = standaloneCompile1(src);
    if (!js.includes("// @fl:"))
        throw new Error("no @fl comment");
    const m = makeModule(js);
    if (m.fact(10) !== 3628800)
        throw new Error(`got ${m.fact(10)}`);
});
test("loop/recur에서 @fl 주석", () => {
    const src = `[FUNC sum-n :params [$n]\n  :body ((loop [[$i $n] [$acc 0]] (if (<= $i 0) $acc (recur (- $i 1) (+ $acc $i)))))\n]\n(export sum-n)`;
    const js = standaloneCompile1(src);
    const m = makeModule(js);
    if (m["sum-n"](100) !== 5050)
        throw new Error(`got ${m["sum-n"](100)}`);
    const comments = [...js.matchAll(/\/\/ @fl:(\d+)/g)].map(m => parseInt(m[1]));
    console.log(`    → @fl lines: ${comments.join(', ')}`);
});
// ── 컴파일러 소스에도 @fl 주석 ────────────────────────────────
console.log("\n[36-C] 컴파일러 소스 자체에 @fl 주석 포함 확인");
test("Gen1 lexer.fl 컴파일 → @fl 주석 포함", () => {
    const js = standaloneCompile1(lexerSrc);
    const comments = [...js.matchAll(/\/\/ @fl:(\d+)/g)];
    if (comments.length < 5)
        throw new Error(`only ${comments.length} @fl comments`);
    console.log(`    → ${comments.length}개 @fl 주석`);
});
test("Gen1 codegen.fl 컴파일 → @fl 주석 포함", () => {
    const js = standaloneCompile1(codegenSrc);
    const comments = [...js.matchAll(/\/\/ @fl:(\d+)/g)];
    if (comments.length < 20)
        throw new Error(`only ${comments.length} @fl comments`);
    console.log(`    → ${comments.length}개 @fl 주석`);
});
// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[36-D] Gen2 + Gen3 고정점 유지");
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
console.log(`Phase 36 Source Map: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase36-sourcemap.js.map