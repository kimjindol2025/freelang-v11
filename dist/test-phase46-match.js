"use strict";
// FreeLang v9: Phase 46 — Pattern Matching in interpreter.fl
//
// 목표: fl-eval-sexpr에 match 처리 추가
//       FL 인터프리터(Gen1)로 match 표현식 직접 평가
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
console.log("\n[46-A] Gen1 빌드");
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
test("interpreter.fl → Gen1 (match 추가 후)", () => {
    interpMod1 = makeModule(tsCompile(interpreterSrc));
    if (typeof interpMod1.interpret !== "function")
        throw new Error("interpret not exported");
    console.log(`    → interpreter Gen1 컴파일 성공`);
});
function flInterpret(flSrc) {
    const ast = parserMod1.parse(lexerMod1.lex(flSrc));
    const converted = convertTStoFL(ast);
    return interpMod1.interpret(converted);
}
// ── 기본 match ───────────────────────────────────────────────
console.log("\n[46-B] 기본 match");
test("숫자 패턴 매칭", () => {
    const src = `
[FUNC label :params [$n]
  :body (
    (match $n
      (0 "zero")
      (1 "one")
      (2 "two")
      (_ "other")
    )
  )
]
(label 1)`;
    const result = flInterpret(src);
    if (result !== "one")
        throw new Error(`got ${result}`);
});
test("숫자 wildcard", () => {
    const src = `
[FUNC label :params [$n]
  :body (
    (match $n
      (0 "zero")
      (_ "other")
    )
  )
]
(label 99)`;
    const result = flInterpret(src);
    if (result !== "other")
        throw new Error(`got ${result}`);
});
test("문자열 패턴 매칭", () => {
    const src = `
[FUNC greet :params [$lang]
  :body (
    (match $lang
      ("ko" "안녕")
      ("en" "hello")
      (_ "?")
    )
  )
]
(greet "ko")`;
    const result = flInterpret(src);
    if (result !== "안녕")
        throw new Error(`got ${result}`);
});
test("문자열 wildcard", () => {
    const src = `
[FUNC greet :params [$lang]
  :body (
    (match $lang
      ("ko" "안녕")
      (_ "unknown")
    )
  )
]
(greet "ja")`;
    const result = flInterpret(src);
    if (result !== "unknown")
        throw new Error(`got ${result}`);
});
test("패턴 없음 → null", () => {
    const src = `
[FUNC f :params [$n]
  :body (
    (match $n
      (0 "zero")
    )
  )
]
(f 5)`;
    const result = flInterpret(src);
    if (result !== null)
        throw new Error(`got ${result}`);
});
// ── 중첩 match ────────────────────────────────────────────────
console.log("\n[46-C] 중첩 및 조합");
test("match 결과를 if에서 사용", () => {
    const src = `
[FUNC sign :params [$n]
  :body (
    (match $n
      (0 "zero")
      (_ (if (> $n 0) "pos" "neg"))
    )
  )
]
(sign -3)`;
    const result = flInterpret(src);
    if (result !== "neg")
        throw new Error(`got ${result}`);
});
test("match 결과 산술 연산", () => {
    const src = `
[FUNC bonus :params [$grade]
  :body (
    (match $grade
      (1 100)
      (2 50)
      (3 10)
      (_ 0)
    )
  )
]
(+ (bonus 1) (bonus 2))`;
    const result = flInterpret(src);
    if (result !== 150)
        throw new Error(`got ${result}`);
});
test("중첩 match", () => {
    const src = `
[FUNC classify :params [$n]
  :body (
    (match $n
      (0 "zero")
      (_ (match (% $n 2)
           (0 "even")
           (_ "odd")
         )
      )
    )
  )
]
(classify 4)`;
    const result = flInterpret(src);
    if (result !== "even")
        throw new Error(`got ${result}`);
});
// ── match + 재귀 (FizzBuzz) ──────────────────────────────────
console.log("\n[46-D] match + 재귀");
test("FizzBuzz (match으로 분기)", () => {
    const src = `
[FUNC fizzbuzz :params [$n]
  :body (
    (match (% $n 15)
      (0 "FizzBuzz")
      (_ (match (% $n 3)
           (0 "Fizz")
           (_ (match (% $n 5)
                (0 "Buzz")
                (_ (num-to-str $n))
              )
           )
         )
      )
    )
  )
]
(fizzbuzz 15)`;
    const result = flInterpret(src);
    if (result !== "FizzBuzz")
        throw new Error(`got ${result}`);
});
test("FizzBuzz(3) = Fizz", () => {
    const src = `
[FUNC fizzbuzz :params [$n]
  :body (
    (match (% $n 15)
      (0 "FizzBuzz")
      (_ (match (% $n 3)
           (0 "Fizz")
           (_ (match (% $n 5)
                (0 "Buzz")
                (_ (num-to-str $n))
              )
           )
         )
      )
    )
  )
]
(fizzbuzz 3)`;
    const result = flInterpret(src);
    if (result !== "Fizz")
        throw new Error(`got ${result}`);
});
test("match + 재귀 카운트", () => {
    const src = `
[FUNC count-odds :params [$n $acc]
  :body (
    (if (<= $n 0)
      $acc
      (count-odds (- $n 1)
        (+ $acc (match (% $n 2)
                  (0 0)
                  (_ 1)
                ))
      )
    )
  )
]
(count-odds 10 0)`;
    const result = flInterpret(src);
    if (result !== 5)
        throw new Error(`got ${result}`);
});
// ── codegen vs interpreter 동치 ───────────────────────────────
console.log("\n[46-E] codegen vs interpreter 동치");
function standaloneCompile1(src) {
    return codegenMod1["gen-js"](parserMod1.parse(lexerMod1.lex(src)));
}
test("match 숫자 패턴 — compile vs interpret 동치", () => {
    const body = `
[FUNC f :params [$n]
  :body (
    (match $n (1 "one") (2 "two") (_ "other"))
  )
]`;
    const interpreted = flInterpret(body + `\n(f 2)`);
    const compiled = makeModule(standaloneCompile1(body + `\n(export f)`)).f(2);
    if (interpreted !== "two")
        throw new Error(`interpret: ${interpreted}`);
    if (compiled !== "two")
        throw new Error(`compile: ${compiled}`);
});
test("match 문자열 패턴 — compile vs interpret 동치", () => {
    const body = `
[FUNC f :params [$s]
  :body (
    (match $s ("a" 1) ("b" 2) (_ 0))
  )
]`;
    const interpreted = flInterpret(body + `\n(f "b")`);
    const compiled = makeModule(standaloneCompile1(body + `\n(export f)`)).f("b");
    if (interpreted !== 2)
        throw new Error(`interpret: ${interpreted}`);
    if (compiled !== 2)
        throw new Error(`compile: ${compiled}`);
});
// ── Phase 45 regression ───────────────────────────────────────
console.log("\n[46-F] Phase 45 regression 확인");
test("팩토리얼 재귀 (regression)", () => {
    const src = `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1) 1 (* $n (fact (- $n 1))))
  )
]
(fact 6)`;
    const result = flInterpret(src);
    if (result !== 720)
        throw new Error(`got ${result}`);
});
test("let 바인딩 (regression)", () => {
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
// ── 결과 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 46 Pattern Matching: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
process.exit(0);
//# sourceMappingURL=test-phase46-match.js.map