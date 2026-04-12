"use strict";
// FreeLang v9: Phase 109 — FL → 최적 프롬프트 컴파일러 테스트
// PromptCompiler 클래스 + prompt-compile/tokens/target/from-code 내장함수
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const prompt_compiler_1 = require("./prompt-compiler");
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
        throw new Error(msg ?? `Expected "${sub}" in "${str.slice(0, 100)}"`);
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// ─── 1. PromptCompiler 생성 ─────────────────────────────────────────────────
console.log("\n[1] PromptCompiler 기본 생성");
test("1. PromptCompiler 기본 생성 (claude)", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    assert(compiler !== null);
});
test("2. compileBlock('COT', {steps:[...]})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('COT', { steps: ['분석', '결론'] });
    assert(section !== null);
    assertEquals(section.name, 'chain-of-thought');
    assertIncludes(section.content, '1. 분석');
    assertIncludes(section.content, '2. 결론');
});
test("3. compileBlock('TOT', {branches:[...]})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('TOT', { branches: ['접근A', '접근B'] });
    assert(section !== null);
    assertEquals(section.name, 'tree-of-thought');
    assertIncludes(section.content, '- 접근A');
    assertIncludes(section.content, '- 접근B');
});
test("4. compileBlock('REFLECT', {criteria:[...]})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('REFLECT', { criteria: ['accuracy'] });
    assert(section !== null);
    assertEquals(section.name, 'self-reflection');
    assertIncludes(section.content, '- accuracy');
});
test("5. compileBlock('AGENT', {goal:'test'})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('AGENT', { goal: 'test' });
    assert(section !== null);
    assertEquals(section.name, 'agent-loop');
    assertIncludes(section.content, 'test');
});
test("6. compileBlock('CONTEXT', {maxTokens:4096})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('CONTEXT', { maxTokens: 4096 });
    assert(section !== null);
    assertEquals(section.name, 'context');
    assertIncludes(section.content, '4096');
});
test("7. compileBlock('SELF-IMPROVE', {iterations:3})", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('SELF-IMPROVE', { iterations: 3 });
    assert(section !== null);
    assertEquals(section.name, 'self-improvement');
    assertIncludes(section.content, '3');
});
test("8. compileBlock 없는 타입 → null", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('UNKNOWN_BLOCK', {});
    assertEquals(section, null);
});
// ─── 2. compile() ─────────────────────────────────────────────────────────
console.log("\n[2] compile() 섹션 → 프롬프트");
test("9. compile() 섹션 → 프롬프트 문자열 반환", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 'test-section', content: 'Test content here', priority: 1 }
    ];
    const result = compiler.compile(sections, 'Do something');
    assert(typeof result.prompt === 'string');
    assert(result.prompt.length > 0);
});
test("10. compile() target='claude' → Human:/Assistant: 포함", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 'sec', content: 'Think step by step.', priority: 1 }
    ];
    const result = compiler.compile(sections, 'Explain FL');
    assertIncludes(result.prompt, 'Human:');
    assertIncludes(result.prompt, 'Assistant:');
});
test("11. compile() target='gpt' → [System]/[User] 포함", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('gpt');
    const sections = [
        { name: 'sec', content: 'Be helpful.', priority: 1 }
    ];
    const result = compiler.compile(sections, 'Hello');
    assertIncludes(result.prompt, '[System]');
    assertIncludes(result.prompt, '[User]:');
});
test("12. compile() sections 배열 반환", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 'alpha', content: 'Alpha', priority: 0.5 },
        { name: 'beta', content: 'Beta', priority: 1 },
    ];
    const result = compiler.compile(sections, 'test');
    assert(Array.isArray(result.sections));
    assert(result.sections.includes('alpha'));
    assert(result.sections.includes('beta'));
});
test("13. compile() tokens 추정 (숫자)", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 's', content: 'x'.repeat(400), priority: 1 }
    ];
    const result = compiler.compile(sections, 'instruction');
    assert(typeof result.tokens === 'number');
    assert(result.tokens > 0);
    // 400자 / 4 = 100 tokens 이상
    assert(result.tokens >= 100);
});
test("14. 우선순위 정렬 (priority=1 먼저)", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 'low', content: 'Low priority', priority: 0 },
        { name: 'high', content: 'High priority', priority: 1 },
        { name: 'mid', content: 'Mid priority', priority: 0.5 },
    ];
    const result = compiler.compile(sections, 'test');
    // sections 배열의 첫 번째가 priority=1 ('high')
    assertEquals(result.sections[0], 'high');
});
// ─── 3. compileFromCode() ────────────────────────────────────────────────
console.log("\n[3] compileFromCode() FL 코드 파싱");
test("15. compileFromCode() COT 블록 감지", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const flCode = `(define $x [COT :step "analyze" :conclude $ans])`;
    const result = compiler.compileFromCode(flCode, 'Solve the problem');
    assert(result.sections.includes('chain-of-thought'));
});
test("16. compileFromCode() 여러 블록 감지", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const flCode = `[COT :steps []] [REFLECT :criteria []] [AGENT :goal "run"]`;
    const result = compiler.compileFromCode(flCode, 'Do it');
    assert(result.sections.includes('chain-of-thought'));
    assert(result.sections.includes('self-reflection'));
    assert(result.sections.includes('agent-loop'));
    assert(result.sections.length >= 3);
});
test("17. compileFromCode() 블록 없음 → default 섹션", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const flCode = `(define $x 42) (print $x)`;
    const result = compiler.compileFromCode(flCode, 'No blocks here');
    assert(result.sections.includes('default'));
});
test("18. setTarget() → 타겟 변경", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    compiler.setTarget('gpt');
    const sections = [
        { name: 's', content: 'content', priority: 1 }
    ];
    const result = compiler.compile(sections, 'hi');
    assertIncludes(result.prompt, '[System]');
    assertEquals(result.target, 'gpt');
    // 복원
    compiler.setTarget('claude');
});
test("19. globalCompiler 싱글톤 — 동일 인스턴스", () => {
    // globalCompiler는 모듈 레벨 싱글톤
    assert(prompt_compiler_1.globalCompiler instanceof prompt_compiler_1.PromptCompiler);
    // 두 번 임포트해도 같은 참조
    const { globalCompiler: gc2 } = require("./prompt-compiler");
    assert(prompt_compiler_1.globalCompiler === gc2);
});
// ─── 4. 내장 함수 (Interpreter) ──────────────────────────────────────────
console.log("\n[4] 내장 함수 테스트");
test("20. prompt-compile 내장함수", () => {
    // globalCompiler를 claude 타겟으로 초기화
    prompt_compiler_1.globalCompiler.setTarget('claude');
    const result = run(`(prompt-compile "COT" "Solve the problem")`);
    assert(typeof result === 'string');
    assertIncludes(result, 'Human:');
    assertIncludes(result, 'Solve the problem');
});
test("21. prompt-tokens 내장함수", () => {
    const result = run(`(prompt-tokens "Hello World this is a test string for token counting")`);
    assert(typeof result === 'number');
    assert(result > 0);
});
test("22. prompt-target 내장함수", () => {
    const result = run(`(prompt-target "gpt")`);
    assertEquals(result, 'gpt');
    // 복원
    prompt_compiler_1.globalCompiler.setTarget('claude');
});
test("23. prompt-from-code 내장함수", () => {
    prompt_compiler_1.globalCompiler.setTarget('claude');
    const src = `(prompt-from-code "[COT :steps []] analyze step" "Explain AI")`;
    const result = run(src);
    assert(typeof result === 'string');
    assertIncludes(result, 'Explain AI');
});
// ─── 5. 엣지 케이스 ──────────────────────────────────────────────────────
console.log("\n[5] 엣지 케이스");
test("24. 빈 sections 처리 — target generic", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('generic');
    const result = compiler.compile([], 'My instruction');
    assert(typeof result.prompt === 'string');
    assertIncludes(result.prompt, 'My instruction');
    assertEquals(result.target, 'generic');
});
test("25. instruction이 프롬프트에 포함 (claude)", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const unique = 'UNIQUE_INSTRUCTION_XYZ_12345';
    const sections = [
        { name: 's', content: 'some content', priority: 1 }
    ];
    const result = compiler.compile(sections, unique);
    assertIncludes(result.prompt, unique);
});
test("26. COT 기본값 steps=[] → 빈 목록 처리", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('COT', { steps: [] });
    assert(section !== null);
    assertIncludes(section.content, 'Think step by step');
    assertIncludes(section.content, 'Then provide your conclusion');
});
test("27. REFLECT threshold 커스텀 설정", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const section = compiler.compileBlock('REFLECT', { criteria: ['quality'], threshold: 0.9 });
    assert(section !== null);
    assertIncludes(section.content, '9'); // 0.9 * 10 = 9
});
test("28. compile() CompileResult 구조 검증", () => {
    const compiler = new prompt_compiler_1.PromptCompiler('claude');
    const sections = [
        { name: 'cot', content: 'Think.', priority: 1 }
    ];
    const result = compiler.compile(sections, 'instruction');
    assert('prompt' in result);
    assert('target' in result);
    assert('tokens' in result);
    assert('sections' in result);
    assertEquals(result.target, 'claude');
});
test("29. prompt-compile AGENT 블록", () => {
    prompt_compiler_1.globalCompiler.setTarget('claude');
    const result = run(`(prompt-compile "AGENT" "Run the agent task")`);
    assert(typeof result === 'string');
    assertIncludes(result, 'Run the agent task');
});
test("30. prompt-from-code SELF-IMPROVE 블록 감지", () => {
    prompt_compiler_1.globalCompiler.setTarget('claude');
    const src = `(prompt-from-code "[SELF-IMPROVE :iterations 5]" "Improve quality")`;
    const result = run(src);
    assert(typeof result === 'string');
    assertIncludes(result, 'Improve quality');
});
// ─── 결과 출력 ────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 109 결과: ${passed} PASS / ${failed} FAIL / 총 ${passed + failed}개`);
if (failed === 0) {
    console.log("✅ 모든 테스트 PASS!");
}
else {
    console.log(`❌ ${failed}개 실패`);
    process.exit(1);
}
//# sourceMappingURL=test-phase109-prompt-compiler.js.map