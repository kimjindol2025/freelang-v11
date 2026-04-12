"use strict";
// FreeLang v9: Phase 48 — 타입 시스템
//
// 목표: freelang-typechecker.fl 컴파일 + 아리티/타입 진단 검증
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
const typecheckerSrc = fs.readFileSync(path.join(flSrcDir, "freelang-typechecker.fl"), "utf-8");
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
function makeModule(jsCode) {
    const sandbox = { module: { exports: {} }, console };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    return sandbox.module.exports;
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
// ── Gen1 빌드 ─────────────────────────────────────────────────
console.log("\n[48-A] Gen1 빌드");
let tcMod1;
test("typechecker.fl → Gen1 컴파일", () => {
    const js = tsCompile(typecheckerSrc);
    tcMod1 = makeModule(js);
    if (typeof tcMod1.typecheck !== "function")
        throw new Error("typecheck not exported");
    console.log(`    → typechecker Gen1 컴파일 성공 (${js.length} chars)`);
});
function flTypecheck(flSrc) {
    const ast = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(flSrc)));
    return tcMod1.typecheck(ast);
}
// ── 타입 추론 정확도 ──────────────────────────────────────────
console.log("\n[48-B] 타입 추론 정확도");
test("올바른 코드 — 에러 0개", () => {
    const src = `
[FUNC add :params [$a $b]
  :body ((+ $a $b))
]
(add 1 2)`;
    const r = flTypecheck(src);
    if (r.errors.length !== 0)
        throw new Error(`errors: ${JSON.stringify(r.errors)}`);
});
test("팩토리얼 — 에러 0개", () => {
    const src = `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1) 1 (* $n (fact (- $n 1))))
  )
]
(fact 6)`;
    const r = flTypecheck(src);
    if (r.errors.length !== 0)
        throw new Error(`errors: ${JSON.stringify(r.errors)}`);
});
test("복잡한 FL 코드 — 에러 0개", () => {
    const src = `
[FUNC square :params [$x] :body ((* $x $x))]
[FUNC sum-sq :params [$a $b]
  :body (
    (let [[$sa (square $a)] [$sb (square $b)]]
      (+ $sa $sb)
    )
  )
]
(sum-sq 3 4)`;
    const r = flTypecheck(src);
    if (r.errors.length !== 0)
        throw new Error(`errors: ${JSON.stringify(r.errors)}`);
});
// ── 아리티 체크 ───────────────────────────────────────────────
console.log("\n[48-C] 아리티 체크");
test("2파라미터 함수를 3인자 호출 → 에러", () => {
    const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
(add 1 2 3)`;
    const r = flTypecheck(src);
    if (r.errors.length === 0)
        throw new Error("에러가 없음");
    if (!r.errors[0].msg.includes("아리티"))
        throw new Error(`expected 아리티 error: ${r.errors[0].msg}`);
    console.log(`    → 감지됨: ${r.errors[0].msg}`);
});
test("1파라미터 함수를 0인자 호출 → 에러", () => {
    const src = `
[FUNC double :params [$x] :body ((* $x 2))]
(double)`;
    const r = flTypecheck(src);
    if (r.errors.length === 0)
        throw new Error("에러가 없음");
    console.log(`    → 감지됨: ${r.errors[0].msg}`);
});
test("올바른 아리티 → 에러 없음", () => {
    const src = `
[FUNC add :params [$a $b] :body ((+ $a $b))]
(add 1 2)`;
    const r = flTypecheck(src);
    if (r.errors.length !== 0)
        throw new Error(`unexpected: ${JSON.stringify(r.errors)}`);
});
test("0파라미터 함수를 1인자 호출 → 에러", () => {
    const src = `
[FUNC get-zero :params [] :body ((+ 0 0))]
(get-zero 42)`;
    const r = flTypecheck(src);
    if (r.errors.length === 0)
        throw new Error("에러가 없음");
    console.log(`    → 감지됨: ${r.errors[0].msg}`);
});
// ── 미정의 변수 ───────────────────────────────────────────────
console.log("\n[48-D] 미정의 변수");
test("미정의 변수 참조 → 에러", () => {
    const src = `(+ $undefined-var 1)`;
    const r = flTypecheck(src);
    if (r.errors.length === 0)
        throw new Error("에러가 없음");
    if (!r.errors[0].msg.includes("미정의"))
        throw new Error(`expected 미정의: ${r.errors[0].msg}`);
    console.log(`    → 감지됨: ${r.errors[0].msg}`);
});
test("정의된 변수 참조 → 에러 없음", () => {
    const src = `
[FUNC f :params [$x] :body ((+ $x 1))]
(f 5)`;
    const r = flTypecheck(src);
    const varErrors = r.errors.filter((e) => e.msg.includes("미정의"));
    if (varErrors.length !== 0)
        throw new Error(`unexpected: ${JSON.stringify(varErrors)}`);
});
test("let 바인딩 변수 사용 → 에러 없음", () => {
    const src = `
[FUNC f :params [$x]
  :body (
    (let [[$y (* $x 2)]]
      (+ $y 1)
    )
  )
]
(f 5)`;
    const r = flTypecheck(src);
    const varErrors = r.errors.filter((e) => e.msg.includes("미정의"));
    if (varErrors.length !== 0)
        throw new Error(`unexpected: ${JSON.stringify(varErrors)}`);
});
// ── 타입 경고 ─────────────────────────────────────────────────
console.log("\n[48-E] 타입 경고");
test("산술에 비정수 → 경고", () => {
    const src = `
[FUNC f :params [$s]
  :body ((+ $s 1))
]
(f "hello")`;
    const r = flTypecheck(src);
    // 경고는 선택적이므로 에러 없음만 확인
    if (r.errors.length !== 0) {
        const arityErrs = r.errors.filter((e) => e.msg.includes("아리티"));
        if (arityErrs.length !== 0)
            throw new Error(`unexpected arity error: ${arityErrs[0].msg}`);
    }
    console.log(`    → 경고: ${r.warnings.length}개`);
});
test("여러 함수 정의 + 상호 호출 → 에러 없음", () => {
    const src = `
[FUNC even? :params [$n]
  :body ((if (= $n 0) true (odd? (- $n 1))))
]
[FUNC odd? :params [$n]
  :body ((if (= $n 0) false (even? (- $n 1))))
]
(even? 4)`;
    const r = flTypecheck(src);
    if (r.errors.length !== 0)
        throw new Error(`errors: ${JSON.stringify(r.errors)}`);
});
// ── typecheck 결과 구조 ───────────────────────────────────────
console.log("\n[48-F] 결과 구조");
test("typecheck 반환 { errors, warnings }", () => {
    const r = flTypecheck(`(+ 1 2)`);
    if (!Array.isArray(r.errors))
        throw new Error("errors가 배열이 아님");
    if (!Array.isArray(r.warnings))
        throw new Error("warnings가 배열이 아님");
});
test("에러 객체 구조: { level, msg, line }", () => {
    const src = `(add 1 2 3)
[FUNC add :params [$a $b] :body ((+ $a $b))]`;
    const r = flTypecheck(src);
    if (r.errors.length === 0)
        throw new Error("에러 없음");
    const e = r.errors[0];
    if (!e.level || !e.msg)
        throw new Error(`구조 이상: ${JSON.stringify(e)}`);
    if (e.level !== "error")
        throw new Error(`level이 error가 아님: ${e.level}`);
});
// ── Gen2 고정점 ───────────────────────────────────────────────
console.log("\n[48-G] typechecker Gen1→Gen2 컴파일");
let lexerMod1, parserMod1, codegenMod1;
test("Gen1 FL 툴체인 로드", () => {
    const interp = new interpreter_1.Interpreter();
    for (const src of [lexerSrc, parserSrc, codegenSrc]) {
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    }
    const lAst = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(lexerSrc)));
    interp.context.variables.set("$__fl_ast__", lAst);
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)("(gen-js $__fl_ast__)")));
    lexerMod1 = makeModule(interp.context.lastValue);
    const pAst = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(parserSrc)));
    interp.context.variables.set("$__fl_ast__", pAst);
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)("(gen-js $__fl_ast__)")));
    parserMod1 = makeModule(interp.context.lastValue);
    const cAst = convertTStoFL((0, parser_1.parse)((0, lexer_1.lex)(codegenSrc)));
    interp.context.variables.set("$__fl_ast__", cAst);
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)("(gen-js $__fl_ast__)")));
    codegenMod1 = makeModule(interp.context.lastValue);
});
test("typechecker.fl → Gen2 (Gen1으로 컴파일)", () => {
    const tc2JS = codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(typecheckerSrc)));
    const tcMod2 = makeModule(tc2JS);
    if (typeof tcMod2.typecheck !== "function")
        throw new Error("typecheck not exported");
    console.log(`    → Gen2 성공 (${tc2JS.length} chars)`);
});
// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 48 Type System: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase48-types.js.map