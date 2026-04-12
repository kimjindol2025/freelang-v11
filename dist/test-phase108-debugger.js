"use strict";
// FreeLang v9: Phase 108 — AI 추론 시각화 디버거 테스트
// ReasoningTrace + trace-create/add/enter/exit/markdown/tree/node-count
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const reasoning_debugger_1 = require("./reasoning-debugger");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg ?? "assertion failed");
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
console.log("\n=== Phase 108: AI 추론 시각화 디버거 ===\n");
// --- 직접 API 테스트 ---
test("1. ReasoningTrace 생성", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("test-root");
    assert(trace !== null);
    assert(trace.getRoot() !== null);
});
test("2. add() 노드 추가", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    const node = trace.add("thought", "첫 번째 생각");
    assert(node !== null);
    assert(node.label === "첫 번째 생각");
    assert(node.type === "thought");
});
test("3. add() children 증가", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.add("thought", "생각1");
    trace.add("action", "행동1");
    assert(trace.getRoot().children.length === 2);
});
test("4. enter() 진입", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("action", "서브 작업");
    assert(trace.depth() === 1);
});
test("5. exit() 복귀", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("action", "서브 작업");
    trace.exit();
    assert(trace.depth() === 0);
});
test("6. depth() 트래킹", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    assert(trace.depth() === 0);
    trace.enter("thought", "level1");
    assert(trace.depth() === 1);
    trace.enter("action", "level2");
    assert(trace.depth() === 2);
    trace.exit();
    assert(trace.depth() === 1);
    trace.exit();
    assert(trace.depth() === 0);
});
test("7. toMarkdown() 출력", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("분석 시작");
    trace.add("thought", "문제 파악");
    trace.add("action", "검색 실행");
    const md = trace.toMarkdown();
    assert(md.includes("## Reasoning Trace"), "제목 포함");
    assert(md.includes("분석 시작"), "루트 레이블 포함");
    assert(md.includes("문제 파악"), "자식 레이블 포함");
    assert(md.includes("💭") || md.includes("⚡"), "아이콘 포함");
});
test("8. toTree() 출력", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("분석 시작");
    trace.add("thought", "문제 파악");
    trace.add("action", "검색 실행");
    const tree = trace.toTree();
    assert(tree.includes("[root] 분석 시작"), "루트 표시");
    assert(tree.includes("[thought] 문제 파악"), "자식 표시");
    assert(tree.includes("└──") || tree.includes("├──"), "트리 커넥터");
});
test("9. nodeCount() 증가", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    assert(trace.nodeCount() === 1); // root 자체
    trace.add("thought", "t1");
    assert(trace.nodeCount() === 2);
    trace.add("action", "a1");
    assert(trace.nodeCount() === 3);
});
test("10. 노드 타입 6종 (thought/action/observation/decision/error/result)", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    const types = ["thought", "action", "observation", "decision", "error", "result"];
    for (const t of types) {
        const node = trace.add(t, `${t}-label`);
        assert(node.type === t, `type mismatch: ${t}`);
    }
    assert(trace.getRoot().children.length === 6);
});
test("11. value 포함 노드", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    const node = trace.add("result", "최종 답", 42);
    assert(node.value === 42, "value 저장");
});
test("12. duration 기록 (exit 후)", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("action", "서브 작업");
    trace.exit("done");
    const child = trace.getRoot().children[0];
    assert(child !== undefined, "자식 노드 존재");
    assert(typeof child.duration === "number", "duration은 숫자");
    assert(child.duration >= 0, "duration >= 0");
});
test("13. timestamp 포함", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    const node = trace.add("thought", "생각");
    assert(typeof node.timestamp === "number", "timestamp는 숫자");
    assert(node.timestamp > 0, "timestamp > 0");
});
test("14. 중첩 enter/exit", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("thought", "level1");
    trace.enter("action", "level2");
    trace.add("observation", "관찰");
    trace.exit("level2-result");
    trace.exit("level1-result");
    const root = trace.getRoot();
    assert(root.children.length === 1, "루트 자식 1개");
    const l1 = root.children[0];
    assert(l1.label === "level1", "level1 레이블");
    assert(l1.children.length === 1, "level1 자식 1개");
    const l2 = l1.children[0];
    assert(l2.label === "level2", "level2 레이블");
    assert(l2.children.length === 1, "level2 자식 1개");
    assert(l2.children[0].label === "관찰", "관찰 노드");
});
test("15. root 노드 확인", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("my-root");
    const root = trace.getRoot();
    assert(root.label === "my-root", "root label 일치");
    assert(root.type === "thought", "root type = thought");
    assert(root.depth === 0, "root depth = 0");
    assert(root.id.startsWith("node-"), "root id 형식");
});
test("16. createTrace() id 반환", () => {
    const { id, trace } = (0, reasoning_debugger_1.createTrace)("외부 생성");
    assert(typeof id === "string", "id는 문자열");
    assert(id.startsWith("trace-"), "id 형식");
    assert(trace instanceof reasoning_debugger_1.ReasoningTrace, "trace 인스턴스");
});
test("17. getTrace() 조회", () => {
    const { id } = (0, reasoning_debugger_1.createTrace)("조회 테스트");
    const found = (0, reasoning_debugger_1.getTrace)(id);
    assert(found !== null, "found가 null이 아님");
    assert(found instanceof reasoning_debugger_1.ReasoningTrace, "ReasoningTrace 인스턴스");
});
test("18. getTrace() 없는 id → null", () => {
    const result = (0, reasoning_debugger_1.getTrace)("trace-nonexistent-99999");
    assert(result === null, "null 반환");
});
// --- 내장함수 (FL 인터프리터) 테스트 ---
test("19. trace-create 내장함수", () => {
    const id = run(`(trace-create "FL 추론 시작")`);
    assert(typeof id === "string", "id는 문자열");
    assert(id.startsWith("trace-"), "trace- 접두사");
});
test("20. trace-add 내장함수", () => {
    const id = run(`(trace-create "root")`);
    const result = run(`
    (define $id "${id}")
    (trace-add $id "thought" "첫 생각")
  `);
    // trace-add returns null
    assert(result === null || result === undefined || result === false, "null 반환 확인");
});
test("21. trace-enter 내장함수", () => {
    const id = run(`(trace-create "enter-test")`);
    run(`(trace-enter "${id}" "action" "서브 작업 시작")`);
    const trace = (0, reasoning_debugger_1.getTrace)(id);
    assert(trace !== null, "trace 존재");
    assert(trace.depth() === 1, "depth = 1");
});
test("22. trace-exit 내장함수", () => {
    const id = run(`(trace-create "exit-test")`);
    run(`(trace-enter "${id}" "action" "서브 작업")`);
    run(`(trace-exit "${id}")`);
    const trace = (0, reasoning_debugger_1.getTrace)(id);
    assert(trace !== null);
    assert(trace.depth() === 0, "depth 복귀 = 0");
});
test("23. trace-markdown 내장함수", () => {
    const id = run(`(trace-create "md-test")`);
    run(`(trace-add "${id}" "thought" "생각 노드")`);
    run(`(trace-add "${id}" "result" "결과 노드")`);
    const md = run(`(trace-markdown "${id}")`);
    assert(typeof md === "string", "문자열 반환");
    assert(md.includes("## Reasoning Trace"), "제목 포함");
    assert(md.includes("md-test"), "루트 레이블 포함");
    assert(md.includes("생각 노드"), "자식 레이블 포함");
});
test("24. trace-tree 내장함수", () => {
    const id = run(`(trace-create "tree-test")`);
    run(`(trace-add "${id}" "action" "행동 노드")`);
    const tree = run(`(trace-tree "${id}")`);
    assert(typeof tree === "string", "문자열 반환");
    assert(tree.includes("[root] tree-test"), "루트 표시");
    assert(tree.includes("[action] 행동 노드"), "자식 표시");
});
test("25. trace-node-count 내장함수", () => {
    const id = run(`(trace-create "count-test")`);
    const c0 = run(`(trace-node-count "${id}")`);
    assert(c0 === 1, `초기 노드 수 1 (root): got ${c0}`);
    run(`(trace-add "${id}" "thought" "n1")`);
    run(`(trace-add "${id}" "action" "n2")`);
    const c2 = run(`(trace-node-count "${id}")`);
    assert(c2 === 3, `노드 추가 후 3: got ${c2}`);
});
// 보너스 테스트
test("26. toMarkdown() value 포함", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.add("result", "답변", { score: 0.95 });
    const md = trace.toMarkdown();
    assert(md.includes("0.95"), "value JSON 포함");
});
test("27. toTree() 중첩 구조", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("루트");
    trace.enter("thought", "생각");
    trace.add("action", "행동");
    trace.exit();
    const tree = trace.toTree();
    assert(tree.includes("│") || tree.includes("└") || tree.includes("├"), "트리 구조 문자 포함");
    assert(tree.includes("[thought] 생각"), "중간 노드");
    assert(tree.includes("[action] 행동"), "리프 노드");
});
test("28. exit() result 저장", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("decision", "판단");
    trace.exit("YES");
    const child = trace.getRoot().children[0];
    assert(child.value === "YES", "exit result 저장됨");
});
test("29. depth 포함 확인", () => {
    const trace = new reasoning_debugger_1.ReasoningTrace("root");
    trace.enter("thought", "level1");
    const l2 = trace.add("action", "level2-leaf");
    // depth는 현재 stack.length 기준으로 생성 시점에 설정
    assert(typeof l2.depth === "number", "depth 숫자 타입");
    trace.exit();
});
test("30. deleteTrace / listTraces 기능", () => {
    const { id } = (0, reasoning_debugger_1.createTrace)("삭제 테스트");
    assert((0, reasoning_debugger_1.getTrace)(id) !== null, "생성 확인");
    const deleted = (0, reasoning_debugger_1.deleteTrace)(id);
    assert(deleted === true, "삭제 성공");
    assert((0, reasoning_debugger_1.getTrace)(id) === null, "삭제 후 null");
});
// 최종 결과
console.log(`\n=== 결과: ${passed}/${passed + failed} PASS ===\n`);
if (failed > 0) {
    console.log(`실패: ${failed}개`);
    process.exit(1);
}
else {
    console.log("모든 테스트 통과!");
}
//# sourceMappingURL=test-phase108-debugger.js.map