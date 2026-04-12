"use strict";
// FreeLang v9: Phase 85 — JS 코드 생성 테스트
// FL AST → JavaScript 코드 변환 검증 (22개 이상 PASS 목표)
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_js_1 = require("./codegen-js");
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
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 200)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label ?? ""}:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}
// 헬퍼: 리터럴 노드 생성
function lit(type, value) {
    return { kind: "literal", type, value };
}
function numLit(v) {
    return lit("number", v);
}
function strLit(v) {
    return lit("string", v);
}
function boolLit(v) {
    return lit("boolean", v);
}
// 헬퍼: 변수 노드 생성
function varNode(name) {
    return { kind: "variable", name };
}
// 헬퍼: SExpr 노드 생성
function sexpr(op, ...args) {
    return { kind: "sexpr", op, args };
}
// 헬퍼: FUNC 블록 생성
function funcBlock(name, params, body) {
    const fields = new Map();
    fields.set("params", params.map((p) => varNode(p)));
    fields.set("body", body);
    return { kind: "block", type: "FUNC", name, fields };
}
// Phase 56 regression: FL 소스 실행
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ─────────────────────────────────────────────────────────────────────────────
console.log("[Phase 85] JS 코드 생성 테스트\n");
// ── TC-1: JSCodegen 생성 ──────────────────────────────────────────────────
console.log("[TC-1] JSCodegen 생성");
test("JSCodegen 인스턴스 생성 가능", () => {
    const cg = new codegen_js_1.JSCodegen();
    assert(cg instanceof codegen_js_1.JSCodegen, "JSCodegen 생성 실패");
});
// ── TC-2: 숫자 리터럴 ────────────────────────────────────────────────────
console.log("[TC-2] 숫자 리터럴");
test("숫자 리터럴 → '42'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const result = cg.genNode(numLit(42));
    assertEqual(result, "42", "숫자 리터럴");
});
// ── TC-3: 문자열 리터럴 ──────────────────────────────────────────────────
console.log("[TC-3] 문자열 리터럴");
test('문자열 리터럴 → `"hello"`', () => {
    const cg = new codegen_js_1.JSCodegen();
    const result = cg.genNode(strLit("hello"));
    assertEqual(result, '"hello"', "문자열 리터럴");
});
// ── TC-4: boolean 리터럴 ─────────────────────────────────────────────────
console.log("[TC-4] boolean 리터럴");
test("true 리터럴 → 'true'", () => {
    const cg = new codegen_js_1.JSCodegen();
    assertEqual(cg.genNode(boolLit(true)), "true");
});
test("false 리터럴 → 'false'", () => {
    const cg = new codegen_js_1.JSCodegen();
    assertEqual(cg.genNode(boolLit(false)), "false");
});
// ── TC-5: (+ 1 2) → "(1 + 2)" ────────────────────────────────────────────
console.log("[TC-5] 덧셈");
test("(+ 1 2) → '(1 + 2)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("+", numLit(1), numLit(2));
    const result = cg.genNode(node);
    assertEqual(result, "(1 + 2)", "덧셈");
});
// ── TC-6: (- 10 3) → "(10 - 3)" ──────────────────────────────────────────
console.log("[TC-6] 뺄셈");
test("(- 10 3) → '(10 - 3)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("-", numLit(10), numLit(3));
    assertEqual(cg.genNode(node), "(10 - 3)", "뺄셈");
});
// ── TC-7: (* 2 3) → "(2 * 3)" ────────────────────────────────────────────
console.log("[TC-7] 곱셈");
test("(* 2 3) → '(2 * 3)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("*", numLit(2), numLit(3));
    assertEqual(cg.genNode(node), "(2 * 3)", "곱셈");
});
// ── TC-8: (if true 1 2) → "(true ? 1 : 2)" ──────────────────────────────
console.log("[TC-8] if → 삼항 연산자");
test("(if true 1 2) → '(true ? 1 : 2)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("if", boolLit(true), numLit(1), numLit(2));
    assertEqual(cg.genNode(node), "(true ? 1 : 2)", "if 삼항");
});
// ── TC-9: (define x 42) → "let $x = 42;" ────────────────────────────────
console.log("[TC-9] define → let");
test("(define x 42) → 'let $x = 42;'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("define", varNode("$x"), numLit(42));
    assertEqual(cg.genNode(node), "let $x = 42;", "define");
});
// ── TC-10: (fn [$x] $x) → "(($x) => $x)" ────────────────────────────────
console.log("[TC-10] fn → 화살표 함수");
test("(fn [$x] $x) → '(($x) => $x)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const params = sexpr("list", varNode("$x"));
    const node = sexpr("fn", params, varNode("$x"));
    const result = cg.genNode(node);
    assertEqual(result, "(($x) => $x)", "fn");
});
// ── TC-11: FUNC 블록 → function 선언 ─────────────────────────────────────
console.log("[TC-11] FUNC 블록");
test("FUNC add($a, $b) → function add($a, $b) { return ... }", () => {
    const cg = new codegen_js_1.JSCodegen();
    const body = sexpr("+", varNode("$a"), varNode("$b"));
    const block = funcBlock("add", ["$a", "$b"], body);
    const result = cg.genNode(block);
    assert(result.includes("function add"), "function 선언 없음");
    assert(result.includes("$a"), "$a 파라미터 없음");
    assert(result.includes("$b"), "$b 파라미터 없음");
    assert(result.includes("return"), "return 없음");
});
// ── TC-12: (do 1 2 3) → IIFE 마지막 return ───────────────────────────────
console.log("[TC-12] do → IIFE");
test("(do 1 2 3) → IIFE with return 3", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("do", numLit(1), numLit(2), numLit(3));
    const result = cg.genNode(node);
    assert(result.includes("=>"), "화살표 없음");
    assert(result.includes("return 3"), "마지막 return 없음");
    assert(result.startsWith("(()"), "IIFE 아님");
});
// ── TC-13: (list 1 2 3) → "[1, 2, 3]" ───────────────────────────────────
console.log("[TC-13] list → 배열");
test("(list 1 2 3) → '[1, 2, 3]'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("list", numLit(1), numLit(2), numLit(3));
    assertEqual(cg.genNode(node), "[1, 2, 3]", "list");
});
// ── TC-14: 변수 참조 $x → "$x" ───────────────────────────────────────────
console.log("[TC-14] 변수 참조");
test("변수 $x → '$x'", () => {
    const cg = new codegen_js_1.JSCodegen();
    assertEqual(cg.genNode(varNode("$x")), "$x", "variable");
});
// ── TC-15: 중첩 산술 (+ (* 2 3) 4) → "((2 * 3) + 4)" ────────────────────
console.log("[TC-15] 중첩 산술");
test("(+ (* 2 3) 4) → '((2 * 3) + 4)'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const inner = sexpr("*", numLit(2), numLit(3));
    const outer = sexpr("+", inner, numLit(4));
    assertEqual(cg.genNode(outer), "((2 * 3) + 4)", "중첩 산술");
});
// ── TC-16: module="esm" → export 키워드 포함 ─────────────────────────────
console.log("[TC-16] ESM export");
test("module=esm → export { ... } 포함", () => {
    const cg = new codegen_js_1.JSCodegen();
    const body = sexpr("+", varNode("$a"), varNode("$b"));
    const block = funcBlock("add", ["$a", "$b"], body);
    const exportNode = sexpr("export", varNode("add"));
    const result = cg.generate([block, exportNode], { module: "esm" });
    assert(result.includes("export {"), `ESM export 없음: ${result}`);
    assert(result.includes("add"), "add 없음");
});
// ── TC-17: module="commonjs" → module.exports 포함 ───────────────────────
console.log("[TC-17] CommonJS export");
test("module=commonjs → module.exports 포함", () => {
    const cg = new codegen_js_1.JSCodegen();
    const body = sexpr("+", varNode("$a"), varNode("$b"));
    const block = funcBlock("add", ["$a", "$b"], body);
    const exportNode = sexpr("export", varNode("add"));
    const result = cg.generate([block, exportNode], { module: "commonjs" });
    assert(result.includes("module.exports"), `module.exports 없음: ${result}`);
});
// ── TC-18: runtime=true → __fl_map 등 포함 ───────────────────────────────
console.log("[TC-18] runtime inline");
test("runtime=true → __fl_map 포함", () => {
    const cg = new codegen_js_1.JSCodegen();
    const result = cg.generate([numLit(1)], { runtime: true });
    assert(result.includes("__fl_map"), `__fl_map 없음: ${result}`);
    assert(result.includes("__fl_filter"), "__fl_filter 없음");
    assert(result.includes("__fl_reduce"), "__fl_reduce 없음");
    assert(result.includes("__fl_print"), "__fl_print 없음");
});
// ── TC-19: 생성된 코드 eval → 실제 실행 가능 ─────────────────────────────
console.log("[TC-19] eval 실행 가능");
test("생성된 JS 코드가 eval 가능", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("+", numLit(1), numLit(2));
    const code = cg.genNode(node);
    // eval로 실행
    // eslint-disable-next-line no-eval
    const result = eval(code);
    assert(result !== undefined, "eval 결과 undefined");
    assert(typeof result === "number", `결과가 숫자가 아님: ${result}`);
});
// ── TC-20: (+ 1 2) 생성 후 eval → 3 ─────────────────────────────────────
console.log("[TC-20] eval → 3");
test("(+ 1 2) → eval → 3", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("+", numLit(1), numLit(2));
    const code = cg.genNode(node);
    // eslint-disable-next-line no-eval
    const result = eval(code);
    assertEqual(result, 3, "(+ 1 2) eval");
});
// ── TC-21: FUNC 생성 후 eval → 함수 호출 가능 ────────────────────────────
console.log("[TC-21] FUNC eval 호출");
test("FUNC add eval 후 호출 가능", () => {
    const cg = new codegen_js_1.JSCodegen();
    const body = sexpr("+", varNode("$a"), varNode("$b"));
    const block = funcBlock("add", ["$a", "$b"], body);
    const funcCode = cg.genNode(block);
    // function 선언을 즉시 실행하는 방식으로 eval
    // "function add($a, $b) { return ($a + $b); }" 형태
    // Function 생성자를 사용해 스코프 문제 우회
    // return 문을 추가해야 값이 반환됨
    // eslint-disable-next-line no-new-func
    const result = new Function(`${funcCode}; return add(3, 4);`)();
    assertEqual(result, 7, "add(3, 4)");
});
// ── TC-22: Phase 56 regression 14/14 ─────────────────────────────────────
console.log("[TC-22] Phase 56 regression");
// Phase 56 주요 케이스 빠른 검증
test("함수 내 define 격리", () => {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `)));
    const x = interp.context.variables.get("$x");
    assertEqual(x, 10, "전역 $x 오염 안 함");
});
test("클로저: 외부 변수 캡처", () => {
    const result = run(`
    (define n 5)
    [FUNC makeAdder :params [$k] :body (fn [] (+ $n $k))]
    (define adder (makeAdder 3))
    (adder)
  `);
    assertEqual(result, 8, "클로저 n+k");
});
test("재귀 함수 동작", () => {
    const result = run(`
    [FUNC fact :params [$n] :body
      (if (= $n 0) 1 (* $n (fact (- $n 1))))
    ]
    (fact 5)
  `);
    assertEqual(result, 120, "fact(5)");
});
test("str-concat 코드 생성", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("str-concat", strLit("hello"), strLit(" world"));
    const result = cg.genNode(node);
    assert(result.includes("+"), "str-concat + 없음");
    assert(result.includes("hello"), "hello 없음");
});
test("비교 연산자 = → ===", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("=", numLit(1), numLit(1));
    const result = cg.genNode(node);
    assert(result.includes("==="), `=== 없음: ${result}`);
});
test("not 단항 연산자", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("not", boolLit(true));
    const result = cg.genNode(node);
    assert(result.includes("!"), `! 없음: ${result}`);
});
test("null 리터럴 → 'null'", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = { kind: "literal", type: "null", value: null };
    assertEqual(cg.genNode(node), "null");
});
test("and 연산자 → &&", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("and", boolLit(true), boolLit(false));
    const result = cg.genNode(node);
    assert(result.includes("&&"), `&& 없음: ${result}`);
});
test("or 연산자 → ||", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("or", boolLit(false), boolLit(true));
    const result = cg.genNode(node);
    assert(result.includes("||"), `|| 없음: ${result}`);
});
test("minify=true → 공백 정규화", () => {
    const cg = new codegen_js_1.JSCodegen();
    const node = sexpr("+", numLit(1), numLit(2));
    const result = cg.generate([node], { minify: true });
    assert(!result.includes("\n"), "개행 포함됨");
});
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────");
console.log(`[Phase 85] 결과: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
    console.log("✅ 모든 테스트 PASS!");
}
else {
    console.log(`❌ ${failed}개 실패`);
    process.exit(1);
}
//# sourceMappingURL=test-phase85-codegen.js.map