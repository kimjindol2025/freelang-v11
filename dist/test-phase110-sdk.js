"use strict";
// FreeLang v9: Phase 110 — 외부 AI SDK 테스트
// FLSDK + FLCodeBuilder + sdk-version/features/supports/snippet/validate 내장함수
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const fl_sdk_1 = require("./fl-sdk");
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
function assert(cond, msg = "assertion failed") {
    if (!cond)
        throw new Error(msg);
}
function assertEquals(a, b, msg) {
    if (a !== b)
        throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertIncludes(str, sub, msg) {
    if (!str.includes(sub))
        throw new Error(msg ?? `Expected "${sub}" in "${str.slice(0, 200)}"`);
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ─── 1. FLSDK 기본 ─────────────────────────────────────────────────────────
console.log("\n[1] FLSDK 기본 생성 및 속성");
test("1. FLSDK 생성", () => {
    const s = new fl_sdk_1.FLSDK();
    assert(s !== null && s !== undefined);
});
test("2. version = '9.0.0'", () => {
    const s = new fl_sdk_1.FLSDK();
    assertEquals(s.version, '9.0.0');
});
test("3. features 배열 (19개 이상)", () => {
    const s = new fl_sdk_1.FLSDK();
    assert(Array.isArray(s.features), "features should be array");
    assert(s.features.length >= 19, `features.length=${s.features.length}, need >= 19`);
});
test("4. supports('maybe') → true", () => {
    const s = new fl_sdk_1.FLSDK();
    assertEquals(s.supports('maybe'), true);
});
test("5. supports('없는것') → false", () => {
    const s = new fl_sdk_1.FLSDK();
    assertEquals(s.supports('없는것'), false);
});
// ─── 2. FLCodeBuilder ─────────────────────────────────────────────────────
console.log("\n[2] FLCodeBuilder");
test("6. FLCodeBuilder 생성", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    assert(b !== null && b !== undefined);
});
test("7. builder.define() 코드 생성", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.define("x", "42");
    const code = b.build();
    assertIncludes(code, "(define x 42)");
});
test("8. builder.defn() 함수 정의", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.defn("add", ["a", "b"], "(+ $a $b)");
    const code = b.build();
    assertIncludes(code, "(defn add");
    assertIncludes(code, "$a");
    assertIncludes(code, "$b");
});
test("9. builder.call() 호출", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.call("println", '"hello"');
    const code = b.build();
    assertIncludes(code, '(println "hello")');
});
test("10. builder.cot() COT 블록", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.cot("analyze problem", ["step1", "step2"]);
    const code = b.build();
    assertIncludes(code, "[COT");
    assertIncludes(code, ":goal");
    assertIncludes(code, "analyze problem");
});
test("11. builder.agent() AGENT 블록", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.agent("solve task", 10);
    const code = b.build();
    assertIncludes(code, "[AGENT");
    assertIncludes(code, ":goal");
    assertIncludes(code, ":max-steps 10");
});
test("12. builder.maybe() maybe 표현", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.maybe(0.9, '"result"');
    const code = b.build();
    assertIncludes(code, "(maybe 0.9");
});
test("13. builder.result('ok', '42')", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.result('ok', '42');
    const code = b.build();
    assertIncludes(code, "(ok 42)");
});
test("14. builder.result('err', '\"msg\"')", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.result('err', '"msg"', 'MY_ERR');
    const code = b.build();
    assertIncludes(code, '(err "MY_ERR"');
});
test("15. builder.pipe() 파이프라인", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.pipe("parse-json", "filter-errors", "extract-values");
    const code = b.build();
    assertIncludes(code, "(-> $data");
    assertIncludes(code, "parse-json");
});
test("16. builder.comment() 주석", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.comment("this is a comment");
    const code = b.build();
    assertIncludes(code, "; this is a comment");
});
test("17. builder.build() 전체 코드 (여러 줄)", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.comment("multi line test");
    b.define("x", "10");
    b.define("y", "20");
    const code = b.build();
    const lines = code.split('\n');
    assert(lines.length === 3, `expected 3 lines, got ${lines.length}`);
});
test("18. builder.reset() 초기화", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.define("x", "1");
    b.reset();
    assertEquals(b.lineCount(), 0);
    assertEquals(b.build(), "");
});
test("19. builder.lineCount()", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.define("a", "1");
    b.define("b", "2");
    b.comment("hello");
    assertEquals(b.lineCount(), 3);
});
// ─── 3. validate() ─────────────────────────────────────────────────────────
console.log("\n[3] validate()");
test("20. validate() 유효한 코드 → valid=true", () => {
    const s = new fl_sdk_1.FLSDK();
    const result = s.validate("(define x (+ 1 2))");
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
});
test("21. validate() 괄호 불균형 → errors 포함", () => {
    const s = new fl_sdk_1.FLSDK();
    const result = s.validate("(define x (+ 1 2)");
    assertEquals(result.valid, false);
    assert(result.errors.length > 0, "should have errors");
});
test("21b. validate() 닫힘 괄호 초과 → errors 포함", () => {
    const s = new fl_sdk_1.FLSDK();
    const result = s.validate("(define x 1))");
    assertEquals(result.valid, false);
    assert(result.errors.length > 0, "should have errors for extra closing bracket");
});
// ─── 4. snippet() ──────────────────────────────────────────────────────────
console.log("\n[4] snippet()");
test("22. snippet('maybe') 반환", () => {
    const s = new fl_sdk_1.FLSDK();
    const snip = s.snippet('maybe');
    assertIncludes(snip, "maybe");
    assert(!snip.includes("not found"), "should not say not found");
});
test("23. snippet('없는것') → not found", () => {
    const s = new fl_sdk_1.FLSDK();
    const snip = s.snippet('없는것');
    assertIncludes(snip, "not found");
});
// ─── 5. getConfig() ────────────────────────────────────────────────────────
console.log("\n[5] getConfig()");
test("24. getConfig() version/features 포함", () => {
    const s = new fl_sdk_1.FLSDK();
    const config = s.getConfig();
    assertEquals(config.version, '9.0.0');
    assert(Array.isArray(config.features));
    assert(config.features.length >= 19);
});
// ─── 6. sdk 내장 함수 ───────────────────────────────────────────────────────
console.log("\n[6] FL 내장 함수 (sdk-*)");
test("25. sdk-version 내장함수", () => {
    const result = run(`(sdk-version)`);
    assertEquals(result, '9.0.0');
});
test("26. sdk-features 내장함수 (배열, 길이 >= 19)", () => {
    const result = run(`(sdk-features)`);
    assert(Array.isArray(result), "should return array");
    assert(result.length >= 19, `length=${result.length}, need >= 19`);
});
test("27. sdk-supports 'maybe' → true", () => {
    const result = run(`(sdk-supports "maybe")`);
    assertEquals(result, true);
});
test("27b. sdk-supports '없는것' → false", () => {
    const result = run(`(sdk-supports "없는것")`);
    assertEquals(result, false);
});
test("28. sdk-snippet 'cot' 반환", () => {
    const result = run(`(sdk-snippet "cot")`);
    assert(typeof result === 'string', "should be string");
    assertIncludes(result, "COT");
});
test("29. sdk-validate 유효한 코드 → true", () => {
    const result = run(`(sdk-validate "(define x 1)")`);
    assertEquals(result, true);
});
test("30. sdk-validate 불균형 코드 → false", () => {
    const result = run(`(sdk-validate "(define x (+ 1 2)")`);
    assertEquals(result, false);
});
// ─── 7. sdk 싱글톤 & block() ────────────────────────────────────────────────
console.log("\n[7] sdk 싱글톤 & block()");
test("31. sdk 싱글톤 내보내기", () => {
    assert(fl_sdk_1.sdk instanceof fl_sdk_1.FLSDK, "sdk should be FLSDK instance");
    assertEquals(fl_sdk_1.sdk.version, '9.0.0');
});
test("32. sdk.block() FLCodeBlock 생성", () => {
    const b = fl_sdk_1.sdk.block('expression', '(+ 1 2)', 'addition');
    assertEquals(b.type, 'expression');
    assertIncludes(b.code, '(+ 1 2)');
    assertEquals(b.description, 'addition');
});
test("33. sdk.block() description 없이 생성", () => {
    const b = fl_sdk_1.sdk.block('program', '(define x 1)');
    assertEquals(b.type, 'program');
    assertEquals(b.description, undefined);
});
// ─── 8. builder 메서드 체이닝 ─────────────────────────────────────────────
console.log("\n[8] 메서드 체이닝");
test("34. 메서드 체이닝으로 전체 프로그램 빌드", () => {
    const code = fl_sdk_1.sdk.builder()
        .comment("Phase 110 SDK Test")
        .define("result", "nil")
        .defn("process", ["input"], "(+ $input 1)")
        .call("process", "42")
        .build();
    assertIncludes(code, "; Phase 110 SDK Test");
    assertIncludes(code, "(define result nil)");
    assertIncludes(code, "(defn process");
    assertIncludes(code, "(process 42)");
});
test("35. agent 기본 maxSteps=5", () => {
    const b = new fl_sdk_1.FLCodeBuilder();
    b.agent("default steps");
    const code = b.build();
    assertIncludes(code, ":max-steps 5");
});
// ─── 최종 결과 ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`PASS: ${passed}  FAIL: ${failed}  TOTAL: ${passed + failed}`);
console.log("=".repeat(50));
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase110-sdk.js.map