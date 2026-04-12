"use strict";
// FreeLang v9: Phase 41 — REPL
//
// 목표: fl-repl: 입력 → lex → parse → gen-js → eval → 결과 출력
//       (repl-eval src env) → 결과값 반환 함수
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
console.log("\n[41-A] Gen1 빌드");
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
// REPL eval 함수: FL 소스 → eval → 결과
function replEval(src, env = {}) {
    const js = standaloneCompile1(src);
    const sandbox = { module: { exports: {} }, console, ...env };
    vm.createContext(sandbox);
    vm.runInContext(js, sandbox);
    // 마지막 export된 값 또는 IIFE 결과 반환
    return sandbox.module.exports;
}
// ── REPL 기본 동작 검증 ──────────────────────────────────────
console.log("\n[41-B] REPL 기본 표현식 평가");
test("산술 식 평가: (+ 3 4) = 7", () => {
    const src = `[FUNC __repl__ :params [] :body ((+ 3 4))] (export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 7)
        throw new Error(`got ${m["__repl__"]()}`);
});
test("문자열 연결 평가", () => {
    const src = `[FUNC __repl__ :params [] :body ((concat "hello" " " "world"))] (export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== "hello world")
        throw new Error(`got ${m["__repl__"]()}`);
});
test("let 바인딩 평가", () => {
    const src = `
[FUNC __repl__ :params [] :body (
  (let [[$x 10] [$y 20]]
    (+ $x $y)
  )
)]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 30)
        throw new Error(`got ${m["__repl__"]()}`);
});
// ── REPL 함수 정의 & 사용 ────────────────────────────────────
console.log("\n[41-C] REPL 함수 정의 및 호출");
test("함수 정의 후 호출", () => {
    const src = `
[FUNC square :params [$n] :body ((* $n $n))]
[FUNC __repl__ :params [] :body ((square 5))]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 25)
        throw new Error(`got ${m["__repl__"]()}`);
});
test("재귀 함수 평가", () => {
    const src = `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1)
      1
      (* $n (fact (- $n 1)))
    )
  )
]
[FUNC __repl__ :params [] :body ((fact 5))]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 120)
        throw new Error(`got ${m["__repl__"]()}`);
});
test("고차 함수 평가", () => {
    const src = `
[FUNC apply-twice :params [$f $x] :body (($f ($f $x)))]
[FUNC inc :params [$n] :body ((+ $n 1))]
[FUNC __repl__ :params [] :body ((apply-twice inc 5))]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 7)
        throw new Error(`got ${m["__repl__"]()}`);
});
// ── REPL 환경 지속 (다중 세션 시뮬레이션) ────────────────────
console.log("\n[41-D] REPL 다중 표현식 평가");
test("여러 정의 누적 평가", () => {
    // 세션 1: 함수 정의
    const defs = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
[FUNC mul :params [$a $b] :body ((* $a $b))]
(export add)
(export mul)`;
    const defMod = replEval(defs);
    // 세션 2: 정의된 함수 사용 (재컴파일)
    const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
[FUNC mul :params [$a $b] :body ((* $a $b))]
[FUNC __repl__ :params [] :body ((add (mul 3 4) 5))]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== 17)
        throw new Error(`got ${m["__repl__"]()}`);
});
test("조건 분기 평가", () => {
    const src = `
[FUNC classify :params [$n]
  :body (
    (if (< $n 0) "negative"
      (if (= $n 0) "zero" "positive")
    )
  )
]
[FUNC __repl__ :params [] :body ((classify -5))]
(export __repl__)`;
    const m = replEval(src);
    if (m["__repl__"]() !== "negative")
        throw new Error(`got ${m["__repl__"]()}`);
});
// ── REPL 배열/맵 처리 ────────────────────────────────────────
console.log("\n[41-E] REPL 컬렉션 평가");
test("배열 처리: map identity", () => {
    const src = `
[FUNC __repl__ :params [] :body ((map [1 2 3] [x] $x))]
(export __repl__)`;
    const m = replEval(src);
    const r = m["__repl__"]();
    if (!Array.isArray(r) || r[0] !== 1 || r[2] !== 3)
        throw new Error(`got ${JSON.stringify(r)}`);
});
test("map 변환 평가", () => {
    const src = `
[FUNC double :params [$x] :body ((* $x 2))]
[FUNC __repl__ :params [] :body ((map [1 2 3 4 5] [x] (double $x)))]
(export __repl__)`;
    const m = replEval(src);
    const r = m["__repl__"]();
    if (!Array.isArray(r) || r[4] !== 10)
        throw new Error(`got ${JSON.stringify(r)}`);
});
test("filter 평가", () => {
    const src = `
[FUNC __repl__ :params [] :body ((filter [1 2 3 4 5 6] [x] (= (% $x 2) 0)))]
(export __repl__)`;
    const m = replEval(src);
    const r = m["__repl__"]();
    if (!Array.isArray(r) || r.length !== 3 || r[0] !== 2)
        throw new Error(`got ${JSON.stringify(r)}`);
});
// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[41-F] Gen2 + Gen3 고정점 유지");
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
console.log(`Phase 41 REPL: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase41-repl.js.map