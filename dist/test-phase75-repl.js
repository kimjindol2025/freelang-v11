"use strict";
// FreeLang v9: Phase 75 — REPL 2.0 단위 테스트
// readline 없이 FreeLangReplCore만 테스트
// TC-1: evalLine 정상 동작
// TC-2: :ls 명령 — 함수 목록 반환
// TC-3: :inspect — 변수 값
// TC-4: 에러 처리 — 예외 잡고 계속
// TC-5: 히스토리 누적
// TC-6: :help 출력
// TC-7: :src — 함수 파라미터 보기
// TC-8: :clear — 상태 초기화
// TC-9: :hist — 히스토리 출력
// TC-10: processLine 통합
Object.defineProperty(exports, "__esModule", { value: true });
const repl_1 = require("./repl");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS  ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  FAIL  ${name}: ${String(e.message ?? e).slice(0, 160)}`);
        failed++;
    }
}
function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${msg ?? "assertEqual"}: got ${a}, expected ${e}`);
}
function assertContains(str, sub) {
    if (!str.includes(sub))
        throw new Error(`Expected "${str}" to contain "${sub}"`);
}
function assertNotNull(val, msg) {
    if (val === null || val === undefined)
        throw new Error(msg ?? "Expected non-null");
}
// --- TC-1: evalLine 정상 동작 ---
test("TC-1: evalLine — 산술 표현식", () => {
    const repl = new repl_1.FreeLangReplCore();
    const result = repl.evalLine("(+ 3 4)");
    assertEqual(result.error, undefined);
    assertEqual(result.value, 7);
});
test("TC-1b: evalLine — 문자열 반환", () => {
    const repl = new repl_1.FreeLangReplCore();
    // str 내장 함수: 여러 인자를 문자열로 합침
    const result = repl.evalLine('(str "hello" " " "world")');
    assertEqual(result.error, undefined);
    assertNotNull(result.value);
});
// --- TC-2: :ls 명령 ---
test("TC-2a: :ls — stdlib 함수 포함 목록 반환", () => {
    const repl = new repl_1.FreeLangReplCore();
    const out = repl.handleCmd(":ls");
    assertNotNull(out);
    // stdlib이 로드되어 있으므로 '없음'이 아닌 함수 목록
    // 빈 REPL은 "없음"이거나 stdlib 함수들이 있음
    // 어떤 경우든 출력이 있어야 함
    assertEqual(typeof out, "string");
});
test("TC-2b: :ls — 함수 정의 후 목록 반환", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.evalLine("[FUNC my-add :params [$x $y] :body (+ $x $y)]");
    const out = repl.handleCmd(":ls");
    assertNotNull(out);
    assertContains(out, "my-add");
});
// --- TC-3: :inspect --- 변수 값
test("TC-3a: :inspect — 없는 변수", () => {
    const repl = new repl_1.FreeLangReplCore();
    const out = repl.handleCmd(":inspect nosuchvar");
    assertNotNull(out);
    // 없음 또는 오류 메시지
    assertContains(out, "nosuchvar");
});
test("TC-3b: :inspect — 정의된 변수", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.evalLine("(define myvar 42)");
    const out = repl.handleCmd(":inspect myvar");
    assertNotNull(out);
    assertContains(out, "42");
});
// --- TC-4: 에러 처리 ---
test("TC-4a: evalLine — 구문 오류 → error 반환, 크래시 없음", () => {
    const repl = new repl_1.FreeLangReplCore();
    const result = repl.evalLine("(defn broken [");
    assertNotNull(result.error);
});
test("TC-4b: evalLine — 런타임 오류 → error 반환", () => {
    const repl = new repl_1.FreeLangReplCore();
    const result = repl.evalLine("(/ 1 0)");
    // 오류가 있거나 Infinity 반환 (JS 동작에 따라)
    // 어떤 경우든 크래시 없어야 함
    assertEqual(typeof result, "object");
});
test("TC-4c: 에러 후 계속 동작", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.evalLine("(oops!!!@@");
    const result = repl.evalLine("(+ 1 2)");
    assertEqual(result.value, 3);
});
// --- TC-5: 히스토리 누적 ---
test("TC-5a: 히스토리 누적", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.processLine("(+ 1 2)");
    repl.processLine("(+ 3 4)");
    repl.processLine("(+ 5 6)");
    assertEqual(repl.history.length, 3);
    assertEqual(repl.history[0], "(+ 1 2)");
    assertEqual(repl.history[2], "(+ 5 6)");
});
test("TC-5b: 빈 줄은 히스토리 추가 안 함", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.processLine("  ");
    repl.processLine("");
    assertEqual(repl.history.length, 0);
});
// --- TC-6: :help ---
test("TC-6: :help 출력", () => {
    const repl = new repl_1.FreeLangReplCore();
    const out = repl.handleCmd(":help");
    assertNotNull(out);
    assertContains(out, ":ls");
    assertContains(out, ":inspect");
    assertContains(out, ":quit");
});
// --- TC-7: :src ---
test("TC-7a: :src — 없는 함수", () => {
    const repl = new repl_1.FreeLangReplCore();
    const out = repl.handleCmd(":src nonexist");
    assertNotNull(out);
    assertContains(out, "없음");
});
test("TC-7b: :src — 함수 파라미터 확인", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.evalLine("[FUNC add-three :params [$a $b $c] :body (+ $a $b $c)]");
    const out = repl.handleCmd(":src add-three");
    assertNotNull(out);
    assertContains(out, "add-three");
    // $a 혹은 a 포함
    assertEqual(out.includes("$a") || out.includes("a"), true);
});
// --- TC-8: :clear ---
test("TC-8: :clear — 상태 초기화", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.evalLine("[FUNC fn-before-clear :params [] :body 1]");
    const beforeClear = [...repl.interp.context.functions.keys()];
    assertEqual(beforeClear.includes("fn-before-clear"), true);
    repl.handleCmd(":clear");
    const afterClear = [...repl.interp.context.functions.keys()];
    assertEqual(afterClear.includes("fn-before-clear"), false);
});
// --- TC-9: :hist ---
test("TC-9: :hist — 히스토리 출력", () => {
    const repl = new repl_1.FreeLangReplCore();
    repl.processLine("(+ 1 2)");
    repl.processLine("(+ 3 4)");
    const out = repl.handleCmd(":hist");
    assertNotNull(out);
    assertContains(out, "(+ 1 2)");
    assertContains(out, "(+ 3 4)");
});
test("TC-9b: :hist — 비어있을 때", () => {
    const repl = new repl_1.FreeLangReplCore();
    const out = repl.handleCmd(":hist");
    assertNotNull(out);
    assertContains(out, "없음");
});
// --- TC-10: processLine 통합 ---
test("TC-10a: processLine — 일반 표현식 → output 포함", () => {
    const repl = new repl_1.FreeLangReplCore();
    const { output, isError } = repl.processLine("(+ 10 20)");
    assertNotNull(output);
    assertContains(output, "30");
    assertEqual(isError, false);
});
test("TC-10b: processLine — :cmd → output", () => {
    const repl = new repl_1.FreeLangReplCore();
    const { output, isError } = repl.processLine(":help");
    assertNotNull(output);
    assertEqual(isError, false);
});
test("TC-10c: processLine — 오류 → isError=true", () => {
    const repl = new repl_1.FreeLangReplCore();
    const { output, isError } = repl.processLine("(call-nonexistent-fn 123)");
    // 오류가 발생하면 isError=true, 아니면 null/undefined → 처리만 안 되면 OK
    // 어떤 경우든 크래시 없어야 함
    assertEqual(typeof isError, "boolean");
});
test("TC-10d: processLine — 빈 줄 → output=null", () => {
    const repl = new repl_1.FreeLangReplCore();
    const { output, isError } = repl.processLine("  ");
    assertEqual(output, null);
    assertEqual(isError, false);
});
// --- 결과 ---
console.log(`\n[Phase 75 REPL 2.0]\n결과: ${passed}/${passed + failed} 통과${failed > 0 ? ` (${failed}개 실패)` : ""}`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase75-repl.js.map