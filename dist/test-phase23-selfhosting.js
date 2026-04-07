"use strict";
// FreeLang v9: Phase 23 Self-Hosting 테스트
// FL source → FL compiler (written in FL) → JavaScript → eval → verify
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
// FreeLang 코드 → 실행 결과
function run(code) {
    const interp = new interpreter_1.Interpreter();
    const ast = (0, parser_1.parse)((0, lexer_1.lex)(code));
    interp.interpret(ast);
    return interp.context.lastValue;
}
// FL 소스 → JS 코드 생성 (FL 컴파일러를 FL로 실행)
function compileFL(src) {
    // 렉서 + 파서 + 코드젠 FL 소스 로드 (이미 위에서 로드됨)
    // FL 인터프리터로 컴파일러 구성요소 적재
    const interp = new interpreter_1.Interpreter();
    // lex, parse, gen-js 로드 (export 무시하고 함수만 등록)
    const loadfl = (source) => {
        const ast = (0, parser_1.parse)((0, lexer_1.lex)(source));
        interp.interpret(ast);
    };
    loadfl(lexerSrc);
    loadfl(parserSrc);
    loadfl(codegenSrc);
    // FL 소스를 컴파일
    const escaped = JSON.stringify(src);
    const pipeline = `
    (let [[tokens (lex ${escaped})]]
      (let [[ast (parse $tokens)]]
        (gen-js $ast)
      )
    )
  `;
    const result = run(pipeline);
    // run()은 새 interpreter를 만들므로 위에서 만든 interp를 직접 사용
    const ast2 = (0, parser_1.parse)((0, lexer_1.lex)(pipeline));
    interp.interpret(ast2);
    return interp.context.lastValue;
}
// 생성된 JS를 Node.js vm sandbox에서 실행
function evalJS(jsCode) {
    const sandbox = {};
    vm.createContext(sandbox);
    return vm.runInContext(jsCode + "\n(typeof module !== 'undefined' ? module.exports : {})", sandbox);
}
// ─── 기본 stdlib: assoc / get (map) ───────────────────────────────────────────
console.log("\n[0] stdlib assoc/get map 검증");
test("assoc: 맵에 키 추가", () => {
    const r = run(`(assoc {:a 1} "b" 2)`);
    if (typeof r !== "object" || r === null || r.b !== 2)
        throw new Error(`got ${JSON.stringify(r)}`);
});
test("get: 맵에서 키 조회", () => {
    const r = run(`(get {:type "NUMBER" :value "42"} "type")`);
    if (r !== "NUMBER")
        throw new Error(`got ${r}`);
});
test("dissoc: 맵에서 키 제거", () => {
    const r = run(`(dissoc {:a 1 :b 2} "a")`);
    if (typeof r !== "object" || r === null || "a" in r)
        throw new Error(`got ${JSON.stringify(r)}`);
    if (r.b !== 2)
        throw new Error(`b missing in ${JSON.stringify(r)}`);
});
// 렉서+파서+코드젠 FL 소스 로드 (src/ 디렉토리에서)
const flSrcDir = path.join(__dirname, "..", "src");
const lexerSrc = fs.readFileSync(path.join(flSrcDir, "freelang-lexer.fl"), "utf-8");
const parserSrc = fs.readFileSync(path.join(flSrcDir, "freelang-parser.fl"), "utf-8");
const codegenSrc = fs.readFileSync(path.join(flSrcDir, "freelang-codegen.fl"), "utf-8");
// ─── 렉서 FL 로드 ─────────────────────────────────────────────────────────────
console.log("\n[1] 렉서 FL 자체 실행");
test("lex FL 파일 로드 성공", () => {
    // lexerSrc 로드 후 lex 함수가 등록되는지 확인
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(lexerSrc)));
    if (!interp.context.functions.has("lex"))
        throw new Error("lex function not registered");
});
function runWithCompiler(code) {
    const interp = new interpreter_1.Interpreter();
    // 컴파일러 구성 로드
    for (const src of [lexerSrc, parserSrc, codegenSrc]) {
        interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    }
    // 사용자 코드 실행
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(code)));
    return interp.context.lastValue;
}
console.log("\n[2] lex() in FreeLang");
test("lex: 숫자 토큰 타입", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "42")]]
      (get (get $toks 0) "type")
    )
  `);
    if (r !== "NUMBER")
        throw new Error(`expected NUMBER, got ${r}`);
});
test("lex: 변수 토큰 타입", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "$hello")]]
      (get (get $toks 0) "type")
    )
  `);
    if (r !== "VARIABLE")
        throw new Error(`expected VARIABLE, got ${r}`);
});
test("lex: 문자열 토큰", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "\\"hello\\"")]]
      (get (get $toks 0) "value")
    )
  `);
    if (r !== "hello")
        throw new Error(`expected hello, got ${r}`);
});
test("lex: KEYWORD 토큰", () => {
    const r = runWithCompiler(`
    (let [[toks (lex ":type")]]
      (get (get $toks 0) "type")
    )
  `);
    if (r !== "KEYWORD")
        throw new Error(`expected KEYWORD, got ${r}`);
});
test("lex: BOOL true", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "true")]]
      (get (get $toks 0) "type")
    )
  `);
    if (r !== "BOOL")
        throw new Error(`expected BOOL, got ${r}`);
});
test("lex: EOF 토큰 포함", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "42")]]
      (get (get $toks (- (length $toks) 1)) "type")
    )
  `);
    if (r !== "EOF")
        throw new Error(`expected EOF, got ${r}`);
});
// ─── 파서 FL 테스트 ───────────────────────────────────────────────────────────
console.log("\n[3] parse() in FreeLang");
test("parse: 숫자 리터럴 AST", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "42")]]
      (let [[ast (parse $toks)]]
        (get (get $ast 0) "kind")
      )
    )
  `);
    if (r !== "literal")
        throw new Error(`expected literal, got ${r}`);
});
test("parse: FUNC 블록 kind", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "[FUNC add :params [$a $b] :body ((+ $a $b))]")]]
      (let [[ast (parse $toks)]]
        (get (get $ast 0) "kind")
      )
    )
  `);
    if (r !== "block")
        throw new Error(`expected block, got ${r}`);
});
test("parse: FUNC 블록 타입", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "[FUNC add :params [$a $b] :body ((+ $a $b))]")]]
      (let [[ast (parse $toks)]]
        (get (get $ast 0) "type")
      )
    )
  `);
    if (r !== "FUNC")
        throw new Error(`expected FUNC, got ${r}`);
});
test("parse: S-expr kind", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "(+ 1 2)")]]
      (let [[ast (parse $toks)]]
        (get (get $ast 0) "kind")
      )
    )
  `);
    if (r !== "sexpr")
        throw new Error(`expected sexpr, got ${r}`);
});
test("parse: 맵 리터럴", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "{:type \\"NUMBER\\" :value \\"42\\"}")]]
      (let [[ast (parse $toks)]]
        (get (get $ast 0) "kind")
      )
    )
  `);
    if (r !== "map-literal")
        throw new Error(`expected map-literal, got ${r}`);
});
// ─── 코드젠 FL 테스트 ─────────────────────────────────────────────────────────
console.log("\n[4] gen-js() in FreeLang");
test("codegen: 숫자 리터럴 → JS", () => {
    const r = runWithCompiler(`
    (let [[toks (lex "42")]]
      (let [[ast (parse $toks)]]
        (gen-js $ast)
      )
    )
  `);
    if (typeof r !== "string")
        throw new Error(`expected string, got ${typeof r}`);
    if (!r.includes("42"))
        throw new Error(`JS does not contain 42: ${r}`);
});
test("codegen: FUNC 블록 → JS function", () => {
    const r = runWithCompiler(`
    (let [[src "[FUNC add :params [$a $b] :body ((+ $a $b))]"]]
      (let [[ast (parse (lex $src))]]
        (gen-js $ast)
      )
    )
  `);
    if (typeof r !== "string")
        throw new Error(`expected string, got ${typeof r}`);
    if (!r.includes("function add"))
        throw new Error(`JS missing function add: ${r.substring(0, 200)}`);
    if (!r.includes("a + b") && !r.includes("a+b"))
        throw new Error(`JS missing a+b: ${r.substring(0, 200)}`);
});
// ─── 완전한 컴파일-실행 라운드트립 ───────────────────────────────────────────
console.log("\n[5] FL → JS → 실행 (Round-trip)");
test("컴파일: 단순 덧셈 함수", () => {
    const flSrc = `
[FUNC add :params [$a $b]
  :body ((+ $a $b))
]
(export add)
  `.trim();
    const jsCode = runWithCompiler(`
    (let [[src ${JSON.stringify(flSrc)}]]
      (gen-js (parse (lex $src)))
    )
  `);
    if (typeof jsCode !== "string")
        throw new Error(`codegen returned ${typeof jsCode}`);
    // 생성된 JS 실행
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    const addFn = sandbox.module.exports.add || sandbox.add;
    if (typeof addFn !== "function")
        throw new Error(`add not exported: ${jsCode.substring(0, 300)}`);
    const result = addFn(3, 4);
    if (result !== 7)
        throw new Error(`expected 7, got ${result}`);
});
test("컴파일: if 표현식", () => {
    const flSrc = `
[FUNC max2 :params [$a $b]
  :body ((if (> $a $b) $a $b))
]
(export max2)
  `.trim();
    const jsCode = runWithCompiler(`
    (gen-js (parse (lex ${JSON.stringify(flSrc)})))
  `);
    const sandbox = { module: { exports: {} } };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    const max2 = sandbox.module.exports.max2;
    if (typeof max2 !== "function")
        throw new Error(`max2 not exported: ${jsCode.substring(0, 300)}`);
    if (max2(3, 7) !== 7)
        throw new Error(`expected 7, got ${max2(3, 7)}`);
    if (max2(9, 5) !== 9)
        throw new Error(`expected 9, got ${max2(9, 5)}`);
});
test("컴파일: let 바인딩", () => {
    const flSrc = `
[FUNC greet :params [$name]
  :body (
    (let [[msg (concat "Hello, " $name "!")]]
      $msg
    )
  )
]
(export greet)
  `.trim();
    const jsCode = runWithCompiler(`
    (gen-js (parse (lex ${JSON.stringify(flSrc)})))
  `);
    const sandbox = { module: { exports: {} } };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    const greet = sandbox.module.exports.greet;
    if (typeof greet !== "function")
        throw new Error(`greet not exported: ${jsCode.substring(0, 300)}`);
    const r = greet("World");
    if (r !== "Hello, World!")
        throw new Error(`expected "Hello, World!", got "${r}"`);
});
test("컴파일: 재귀 팩토리얼", () => {
    const flSrc = `
[FUNC fact :params [$n]
  :body (
    (if (<= $n 1)
      1
      (* $n (fact (- $n 1)))
    )
  )
]
(export fact)
  `.trim();
    const jsCode = runWithCompiler(`
    (gen-js (parse (lex ${JSON.stringify(flSrc)})))
  `);
    const sandbox = { module: { exports: {} } };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    const fact = sandbox.module.exports.fact;
    if (typeof fact !== "function")
        throw new Error(`fact not exported: ${jsCode.substring(0, 300)}`);
    if (fact(5) !== 120)
        throw new Error(`expected 120, got ${fact(5)}`);
});
test("컴파일: concat 문자열 연결", () => {
    const flSrc = `
[FUNC join3 :params [$a $b $c]
  :body ((concat $a $b $c))
]
(export join3)
  `.trim();
    const jsCode = runWithCompiler(`
    (gen-js (parse (lex ${JSON.stringify(flSrc)})))
  `);
    const sandbox = { module: { exports: {} } };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);
    const join3 = sandbox.module.exports.join3;
    if (typeof join3 !== "function")
        throw new Error(`join3 not exported`);
    if (join3("a", "b", "c") !== "abc")
        throw new Error(`expected abc, got ${join3("a", "b", "c")}`);
});
// ─── 결과 ─────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 23 Self-Hosting: ${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase23-selfhosting.js.map