"use strict";
// FreeLang v9: Phase 45 — Self-Hosting Interpreter
//
// 목표: freelang-interpreter.fl → Gen1 컴파일 → FL 코드 직접 해석
//       lexer.fl + parser.fl + interpreter.fl = 완전한 자가호스팅 파이프라인
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
const interpreterSrc = fs.readFileSync(path.join(flSrcDir, "freelang-interpreter.fl"), "utf-8");
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
console.log("\n[45-A] Gen1 빌드");
let lexerMod1, parserMod1, codegenMod1, interpMod1;
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
test("interpreter.fl → Gen1 컴파일", () => {
    const js = tsCompile(interpreterSrc);
    interpMod1 = makeModule(js);
    if (typeof interpMod1.interpret !== "function")
        throw new Error("interpret not exported");
    console.log(`    → interpreter.fl 컴파일 성공`);
});
function standaloneCompile1(src) {
    return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}
// FL 코드를 인터프리터로 직접 실행
function flInterpret(flSrc) {
    const ast = parserMod1.parse(lexerMod1.lex(flSrc));
    const converted = convertTStoFL(ast);
    return interpMod1.interpret(converted);
}
// ── 인터프리터 기본 동작 ─────────────────────────────────────
console.log("\n[45-B] 기본 값 평가");
test("정수 리터럴 평가", () => {
    const src = `[FUNC f :params [] :body ((+ 1 0))] (f)`;
    const result = flInterpret(src);
    if (result !== 1)
        throw new Error(`got ${result}`);
});
test("산술 연산 (+)", () => {
    const src = `[FUNC f :params [] :body ((+ 3 4))] (f)`;
    const result = flInterpret(src);
    if (result !== 7)
        throw new Error(`got ${result}`);
});
test("산술 연산 (*)", () => {
    const src = `[FUNC f :params [] :body ((* 6 7))] (f)`;
    const result = flInterpret(src);
    if (result !== 42)
        throw new Error(`got ${result}`);
});
test("비교 연산 (=)", () => {
    const src = `[FUNC f :params [] :body ((= 3 3))] (f)`;
    const result = flInterpret(src);
    if (result !== true)
        throw new Error(`got ${result}`);
});
test("문자열 concat", () => {
    const src = `[FUNC f :params [] :body ((concat "hello" " world"))] (f)`;
    const result = flInterpret(src);
    if (result !== "hello world")
        throw new Error(`got ${result}`);
});
// ── 제어 흐름 ────────────────────────────────────────────────
console.log("\n[45-C] 제어 흐름");
test("if true 분기", () => {
    const src = `[FUNC f :params [] :body ((if true 1 2))] (f)`;
    const result = flInterpret(src);
    if (result !== 1)
        throw new Error(`got ${result}`);
});
test("if false 분기", () => {
    const src = `[FUNC f :params [] :body ((if false 1 2))] (f)`;
    const result = flInterpret(src);
    if (result !== 2)
        throw new Error(`got ${result}`);
});
test("if 중첩", () => {
    const src = `[FUNC f :params [$n] :body ((if (< $n 0) "neg" (if (= $n 0) "zero" "pos")))] (f 5)`;
    const result = flInterpret(src);
    if (result !== "pos")
        throw new Error(`got ${result}`);
});
// ── 변수 바인딩 ───────────────────────────────────────────────
console.log("\n[45-D] 변수 및 함수 파라미터");
test("파라미터 바인딩", () => {
    const src = `[FUNC double :params [$x] :body ((* $x 2))] (double 21)`;
    const result = flInterpret(src);
    if (result !== 42)
        throw new Error(`got ${result}`);
});
test("두 개 파라미터", () => {
    const src = `[FUNC add :params [$a $b] :body ((+ $a $b))] (add 10 32)`;
    const result = flInterpret(src);
    if (result !== 42)
        throw new Error(`got ${result}`);
});
test("let 바인딩", () => {
    const src = `
[FUNC f :params [$x]
  :body (
    (let [[$y (* $x 2)] [$z (+ $x 1)]]
      (+ $y $z)
    )
  )
]
(f 5)`;
    const result = flInterpret(src);
    if (result !== 16)
        throw new Error(`got ${result}`);
});
// ── 재귀 함수 ────────────────────────────────────────────────
console.log("\n[45-E] 재귀 함수");
test("팩토리얼 재귀", () => {
    const src = `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1)
      1
      (* $n (fact (- $n 1)))
    )
  )
]
(fact 6)`;
    const result = flInterpret(src);
    if (result !== 720)
        throw new Error(`got ${result}`);
});
test("피보나치 재귀", () => {
    const src = `
[FUNC fib :params [$n]
  :body (
    (if (<= $n 1)
      $n
      (+ (fib (- $n 1)) (fib (- $n 2)))
    )
  )
]
(fib 10)`;
    const result = flInterpret(src);
    if (result !== 55)
        throw new Error(`got ${result}`);
});
test("상호 재귀: even/odd", () => {
    const src = `
[FUNC fl-even :params [$n]
  :body ((if (= $n 0) true (fl-odd (- $n 1))))
]
[FUNC fl-odd :params [$n]
  :body ((if (= $n 0) false (fl-even (- $n 1))))
]
(fl-even 10)`;
    const result = flInterpret(src);
    if (result !== true)
        throw new Error(`got ${result}`);
});
// ── 고차 함수 ────────────────────────────────────────────────
console.log("\n[45-F] 함수 호출 체인");
test("함수 조합 호출", () => {
    const src = `
[FUNC square :params [$n] :body ((* $n $n))]
[FUNC inc :params [$n] :body ((+ $n 1))]
[FUNC f :params [$x] :body ((square (inc $x)))]
(f 4)`;
    const result = flInterpret(src);
    if (result !== 25)
        throw new Error(`got ${result}`);
});
test("중간 결과 let으로 저장", () => {
    const src = `
[FUNC cube :params [$n] :body ((* $n (* $n $n)))]
[FUNC sum-sq-cube :params [$x]
  :body (
    (let [[$sq (* $x $x)] [$cb (cube $x)]]
      (+ $sq $cb)
    )
  )
]
(sum-sq-cube 3)`;
    const result = flInterpret(src);
    if (result !== 36)
        throw new Error(`got ${result}`);
});
// ── 완전한 자가호스팅 파이프라인 ─────────────────────────────
console.log("\n[45-G] 완전한 자가호스팅 파이프라인");
test("FL lexer(Gen1) → parser(Gen1) → interpreter(Gen1) 동작", () => {
    // Gen1 FL 인터프리터로 간단한 FL 코드 직접 해석
    const src = `
[FUNC countdown :params [$n $acc]
  :body (
    (if (<= $n 0)
      $acc
      (countdown (- $n 1) (+ $acc 1))
    )
  )
]
(countdown 100 0)`;
    const result = flInterpret(src);
    if (result !== 100)
        throw new Error(`got ${result}`);
    console.log(`    → 재귀 100회 OK`);
});
test("interpreter.fl을 Gen1 컴파일러로 재컴파일 (Gen2 interpreter)", () => {
    const js = standaloneCompile1(interpreterSrc);
    const mod2 = makeModule(js);
    if (typeof mod2.interpret !== "function")
        throw new Error("interpret not exported");
    console.log(`    → interpreter Gen2 컴파일 성공 (${js.length} chars)`);
});
// ── Gen2 + Gen3 고정점 유지 ───────────────────────────────────
console.log("\n[45-H] Gen2 + Gen3 고정점 유지");
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
console.log(`Phase 45 Self-Hosting Interpreter: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase45-interpreter.js.map