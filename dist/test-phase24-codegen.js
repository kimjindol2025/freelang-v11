"use strict";
// FreeLang v9: Phase 24 Codegen 완성도 테스트
// match / cond / fn / 고차함수 / 상호재귀
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
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}
const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"), "utf-8");
const parserSrc = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");
function runWithCompiler(code) {
    const interp = new interpreter_1.Interpreter();
    for (const src of [lexerSrc, parserSrc, codegenSrc]) {
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    }
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(code)));
    return interp.context.lastValue;
}
function compileAndRun(flSrc) {
    const jsCode = runWithCompiler(`
    (gen-js (parse (lex ${JSON.stringify(flSrc)})))
  `);
    if (typeof jsCode !== "string")
        throw new Error(`codegen returned ${typeof jsCode}: ${jsCode}`);
    const sandbox = { module: { exports: {} } };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    return sandbox.module.exports;
}
// ─── [6] match 컴파일 ─────────────────────────────────────────────
console.log("\n[6] match 컴파일");
test("match: 문자열 패턴", () => {
    const exports = compileAndRun(`
[FUNC grade :params [$s]
  :body (
    (match $s
      ("A" "excellent")
      ("B" "good")
      (_ "ok")
    )
  )
]
(export grade)
  `.trim());
    if (typeof exports.grade !== "function")
        throw new Error("grade not exported");
    if (exports.grade("A") !== "excellent")
        throw new Error(`A: ${exports.grade("A")}`);
    if (exports.grade("B") !== "good")
        throw new Error(`B: ${exports.grade("B")}`);
    if (exports.grade("C") !== "ok")
        throw new Error(`C: ${exports.grade("C")}`);
});
test("match: 와일드카드 default", () => {
    const exports = compileAndRun(`
[FUNC describe :params [$x]
  :body (
    (match $x
      ("yes" true)
      ("no"  false)
      (_     false)
    )
  )
]
(export describe)
  `.trim());
    if (exports.describe("yes") !== true)
        throw new Error(`yes: ${exports.describe("yes")}`);
    if (exports.describe("no") !== false)
        throw new Error(`no: ${exports.describe("no")}`);
    if (exports.describe("?") !== false)
        throw new Error(`?: ${exports.describe("?")}`);
});
test("match: gen-sexpr 내부 match (codegen 자체 패턴)", () => {
    const exports = compileAndRun(`
[FUNC op-to-sym :params [$op]
  :body (
    (match $op
      ("add" "+")
      ("sub" "-")
      ("mul" "*")
      (_     "?")
    )
  )
]
(export op-to-sym)
  `.trim());
    if (exports["op-to-sym"]("add") !== "+")
        throw new Error("add");
    if (exports["op-to-sym"]("sub") !== "-")
        throw new Error("sub");
    if (exports["op-to-sym"]("mul") !== "*")
        throw new Error("mul");
    if (exports["op-to-sym"]("div") !== "?")
        throw new Error("div");
});
// ─── [7] cond 컴파일 ─────────────────────────────────────────────
console.log("\n[7] cond 컴파일");
test("cond: 단순 조건 분기", () => {
    const exports = compileAndRun(`
[FUNC score-grade :params [$score]
  :body (
    (cond
      [(>= $score 90) "A"]
      [(>= $score 80) "B"]
      [(>= $score 70) "C"]
      [else "F"]
    )
  )
]
(export score-grade)
  `.trim());
    if (exports["score-grade"](95) !== "A")
        throw new Error(`95: ${exports["score-grade"](95)}`);
    if (exports["score-grade"](85) !== "B")
        throw new Error(`85: ${exports["score-grade"](85)}`);
    if (exports["score-grade"](75) !== "C")
        throw new Error(`75: ${exports["score-grade"](75)}`);
    if (exports["score-grade"](60) !== "F")
        throw new Error(`60: ${exports["score-grade"](60)}`);
});
test("cond: else 절 없이 조건만", () => {
    const exports = compileAndRun(`
[FUNC sign :params [$n]
  :body (
    (cond
      [(> $n 0) "positive"]
      [(< $n 0) "negative"]
      [else "zero"]
    )
  )
]
(export sign)
  `.trim());
    if (exports.sign(5) !== "positive")
        throw new Error(`5: ${exports.sign(5)}`);
    if (exports.sign(-3) !== "negative")
        throw new Error(`-3: ${exports.sign(-3)}`);
    if (exports.sign(0) !== "zero")
        throw new Error(`0: ${exports.sign(0)}`);
});
// ─── [8] fn (람다) 컴파일 ────────────────────────────────────────
console.log("\n[8] fn 컴파일");
test("fn: 람다 반환 함수", () => {
    const exports = compileAndRun(`
[FUNC make-adder :params [$n]
  :body (
    (fn [$x] (+ $x $n))
  )
]
(export make-adder)
  `.trim());
    const add5 = exports["make-adder"](5);
    if (typeof add5 !== "function")
        throw new Error("make-adder did not return function");
    if (add5(3) !== 8)
        throw new Error(`add5(3): ${add5(3)}`);
    if (add5(10) !== 15)
        throw new Error(`add5(10): ${add5(10)}`);
});
test("fn: 즉시 호출 람다", () => {
    const exports = compileAndRun(`
[FUNC double-it :params [$x]
  :body (
    ((fn [$n] (* $n 2)) $x)
  )
]
(export double-it)
  `.trim());
    if (exports["double-it"](7) !== 14)
        throw new Error(`7: ${exports["double-it"](7)}`);
});
// ─── [9] 고차 함수 ───────────────────────────────────────────────
console.log("\n[9] 재귀 + 고차함수");
test("재귀: fibonacci", () => {
    const exports = compileAndRun(`
[FUNC fib :params [$n]
  :body (
    (if (<= $n 1)
      $n
      (+ (fib (- $n 1)) (fib (- $n 2)))
    )
  )
]
(export fib)
  `.trim());
    if (exports.fib(0) !== 0)
        throw new Error(`fib(0): ${exports.fib(0)}`);
    if (exports.fib(1) !== 1)
        throw new Error(`fib(1): ${exports.fib(1)}`);
    if (exports.fib(7) !== 13)
        throw new Error(`fib(7): ${exports.fib(7)}`);
});
test("재귀: match 기반 fibonacci", () => {
    const exports = compileAndRun(`
[FUNC fib2 :params [$n]
  :body (
    (if (<= $n 1)
      $n
      (+ (fib2 (- $n 1)) (fib2 (- $n 2)))
    )
  )
]
(export fib2)
  `.trim());
    if (exports.fib2(10) !== 55)
        throw new Error(`fib2(10): ${exports.fib2(10)}`);
});
test("고차함수: 함수를 인자로 전달", () => {
    const exports = compileAndRun(`
[FUNC apply-twice :params [$f $x]
  :body (
    ($f ($f $x))
  )
]
[FUNC double :params [$n]
  :body ((* $n 2))
]
(export apply-twice double)
  `.trim());
    if (exports["apply-twice"](exports.double, 3) !== 12) {
        throw new Error(`apply-twice(double, 3): ${exports["apply-twice"](exports.double, 3)}`);
    }
});
// ─── 결과 ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 24 Codegen: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase24-codegen.js.map