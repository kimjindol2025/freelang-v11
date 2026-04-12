"use strict";
// FreeLang v9: Phase 78 — Source Map + Debugger 테스트
// 목표: 18개 이상 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const source_map_1 = require("./source-map");
const debugger_1 = require("./debugger");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result.then(() => {
                console.log(`  ✅ ${name}`);
                passed++;
            }).catch((e) => {
                console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
                failed++;
            });
        }
        else {
            console.log(`  ✅ ${name}`);
            passed++;
        }
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
console.log("[Phase 78] Source Map + Debugger 검증\n");
// ── TC-1: SourceMap.record/get 기본 ──────────────────────────────────
console.log("[TC-1] SourceMap record/get 기본");
test("record 후 get으로 동일한 SourceLocation 반환", () => {
    const sm = new source_map_1.SourceMap();
    const loc = { file: "test.fl", line: 5, col: 3 };
    sm.record("node:1", loc);
    const got = sm.get("node:1");
    assert(got !== undefined, "get 결과가 undefined");
    assert(got.file === "test.fl", `file 불일치: ${got.file}`);
    assert(got.line === 5, `line 불일치: ${got.line}`);
    assert(got.col === 3, `col 불일치: ${got.col}`);
});
test("존재하지 않는 nodeId → undefined 반환", () => {
    const sm = new source_map_1.SourceMap();
    const got = sm.get("nonexistent");
    assert(got === undefined, "undefined가 아님");
});
// ── TC-2: formatLocation ─────────────────────────────────────────────
console.log("\n[TC-2] formatLocation");
test("formatLocation → 'file.fl:10:5' 형태", () => {
    const sm = new source_map_1.SourceMap();
    const loc = { file: "main.fl", line: 10, col: 5 };
    const str = sm.formatLocation(loc);
    assert(str === "main.fl:10:5", `formatLocation 결과: '${str}'`);
});
test("formatLocation — 줄 1, 열 1 (경계값)", () => {
    const sm = new source_map_1.SourceMap();
    const loc = { file: "a.fl", line: 1, col: 1 };
    const str = sm.formatLocation(loc);
    assert(str === "a.fl:1:1", `결과: '${str}'`);
});
// ── TC-3: DebugSession addBreakpoint/isBreakpoint ────────────────────
console.log("\n[TC-3] addBreakpoint / isBreakpoint");
test("addBreakpoint 후 isBreakpoint true", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 10);
    assert(session.isBreakpoint("main.fl", 10), "중단점이 등록되지 않음");
});
test("등록되지 않은 줄은 isBreakpoint false", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 10);
    assert(!session.isBreakpoint("main.fl", 11), "11번 줄이 중단점으로 나옴");
});
test("다른 파일은 isBreakpoint false", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 10);
    assert(!session.isBreakpoint("other.fl", 10), "other.fl이 중단점으로 나옴");
});
// ── TC-4: removeBreakpoint ───────────────────────────────────────────
console.log("\n[TC-4] removeBreakpoint");
test("removeBreakpoint 후 isBreakpoint false", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 5);
    session.removeBreakpoint("main.fl", 5);
    assert(!session.isBreakpoint("main.fl", 5), "중단점이 제거되지 않음");
});
test("없는 중단점 remove → 에러 없음", () => {
    const session = new debugger_1.DebugSession();
    session.removeBreakpoint("main.fl", 999); // 에러 없어야 함
    assert(true, "에러가 발생하지 않아야 함");
});
// ── TC-5: (break!) 호출 시 onBreak 콜백 실행 ────────────────────────
console.log("\n[TC-5] (break!) onBreak 콜백");
test("enabled=true 시 (break!) → onBreak 콜백 실행", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    let called = false;
    session.onBreakCallback = (_ev) => { called = true; };
    const loc = { file: "test.fl", line: 1, col: 1 };
    (0, debugger_1.handleBreak)(session, loc, {});
    assert(called, "onBreak 콜백이 호출되지 않음");
});
test("(break!) 실행 시 breakLog에 이벤트 기록", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    const loc = { file: "test.fl", line: 3, col: 1 };
    (0, debugger_1.handleBreak)(session, loc, { "$x": 42 });
    assert(session.breakLog.length === 1, `breakLog 길이: ${session.breakLog.length}`);
    assert(session.breakLog[0].loc.line === 3, "line 불일치");
});
// ── TC-6: 디버그 모드 OFF → no-op ───────────────────────────────────
console.log("\n[TC-6] 디버그 모드 OFF no-op");
test("enabled=false 시 handleBreak → 콜백 호출 안 함", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = false;
    let called = false;
    session.onBreakCallback = () => { called = true; };
    (0, debugger_1.handleBreak)(session, { file: "x.fl", line: 1, col: 1 }, {});
    assert(!called, "비활성화 상태에서 콜백이 호출됨");
});
test("enabled=false 시 breakLog 비어있음", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = false;
    (0, debugger_1.handleBreak)(session, { file: "x.fl", line: 1, col: 1 }, { "$val": 100 });
    assert(session.breakLog.length === 0, "breakLog에 항목이 추가됨");
});
// ── TC-7: 중단점에서 환경 스냅샷 기록 ──────────────────────────────
console.log("\n[TC-7] 환경 스냅샷 기록");
test("onBreak 시 env 스냅샷이 BreakEvent에 포함", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    const env = { "$x": 10, "$y": "hello" };
    (0, debugger_1.handleBreak)(session, { file: "f.fl", line: 5, col: 2 }, env);
    const ev = session.breakLog[0];
    assert(ev.env["$x"] === 10, `$x = ${ev.env["$x"]}`);
    assert(ev.env["$y"] === "hello", `$y = ${ev.env["$y"]}`);
});
test("환경 스냅샷은 원본과 독립적 (깊은 복사)", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    const env = { "$n": 1 };
    (0, debugger_1.handleBreak)(session, { file: "f.fl", line: 1, col: 1 }, env);
    env["$n"] = 999; // 원본 변경
    const ev = session.breakLog[0];
    assert(ev.env["$n"] === 1, `스냅샷 오염: ${ev.env["$n"]}`);
});
// ── TC-8: stepMode ───────────────────────────────────────────────────
console.log("\n[TC-8] stepMode");
test("stepMode=true 설정 가능", () => {
    const session = new debugger_1.DebugSession();
    session.stepMode = true;
    assert(session.stepMode === true, "stepMode 설정 실패");
});
test("stepMode 기본값은 false", () => {
    const session = new debugger_1.DebugSession();
    assert(session.stepMode === false, "stepMode 기본값이 false가 아님");
});
// ── TC-9: buildSourceMap ─────────────────────────────────────────────
console.log("\n[TC-9] buildSourceMap");
test("buildSourceMap — 토큰 위치 기록됨", () => {
    const src = `(+ 1 2)`;
    const sm = (0, source_map_1.buildSourceMap)(src, "test.fl");
    assert(sm.size() > 0, "소스맵이 비어있음");
});
test("buildSourceMap — 파일명 올바르게 기록", () => {
    const src = `(println "hello")`;
    const sm = (0, source_map_1.buildSourceMap)(src, "hello.fl");
    const entries = [...sm.entries()];
    assert(entries.length > 0, "항목 없음");
    assert(entries[0][1].file === "hello.fl", `파일명: ${entries[0][1].file}`);
});
test("buildSourceMap — 줄 번호 추적 (멀티라인)", () => {
    const src = `(define x 1)\n(define y 2)\n(+ x y)`;
    const sm = (0, source_map_1.buildSourceMap)(src, "multi.fl");
    const entries = [...sm.entries()];
    // 첫 번째 토큰은 line 1
    assert(entries[0][1].line === 1, `첫 토큰 line: ${entries[0][1].line}`);
    // 어딘가에 line 2 이상인 토큰이 있어야 함
    const hasLine2Plus = entries.some(([, loc]) => loc.line >= 2);
    assert(hasLine2Plus, "line 2 이상인 토큰 없음");
});
// ── TC-10: 중복 중단점 ────────────────────────────────────────────
console.log("\n[TC-10] 중복 중단점");
test("같은 위치 중단점 중복 추가 → 하나로 처리", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 10);
    session.addBreakpoint("main.fl", 10);
    session.addBreakpoint("main.fl", 10);
    assert(session.breakpointCount() === 1, `중단점 개수: ${session.breakpointCount()}`);
});
// ── TC-11: 다중 중단점 ───────────────────────────────────────────
console.log("\n[TC-11] 다중 중단점");
test("여러 줄에 중단점 등록 후 각각 isBreakpoint true", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 1);
    session.addBreakpoint("main.fl", 5);
    session.addBreakpoint("main.fl", 10);
    assert(session.isBreakpoint("main.fl", 1), "line 1 없음");
    assert(session.isBreakpoint("main.fl", 5), "line 5 없음");
    assert(session.isBreakpoint("main.fl", 10), "line 10 없음");
    assert(!session.isBreakpoint("main.fl", 3), "line 3가 있으면 안 됨");
});
// ── TC-12: clearBreakpoints ───────────────────────────────────────
console.log("\n[TC-12] clearBreakpoints");
test("clearBreakpoints 후 모든 중단점 사라짐", () => {
    const session = new debugger_1.DebugSession();
    session.addBreakpoint("main.fl", 1);
    session.addBreakpoint("main.fl", 5);
    session.clearBreakpoints();
    assert(session.breakpointCount() === 0, `중단점 남아있음: ${session.breakpointCount()}`);
    assert(!session.isBreakpoint("main.fl", 1), "line 1이 남아있음");
});
// ── TC-13: 인터프리터에서 (break!) no-op (디버그 꺼짐) ──────────
console.log("\n[TC-13] 인터프리터 (break!) 디버그 꺼짐 no-op");
test("디버그 꺼진 상태에서 (break!) → 프로그램 계속 실행", () => {
    // 기본 세션은 enabled=false
    const result = run(`
    (define x 10)
    (break!)
    (+ x 5)
  `);
    assert(result === 15, `결과: ${result}`);
});
// ── TC-14: 인터프리터에서 (break!) 활성화 ──────────────────────
console.log("\n[TC-14] 인터프리터 (break!) 활성화");
test("디버그 활성화 시 (break!) → onBreak 콜백 호출", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    let breakCalled = false;
    session.onBreakCallback = () => { breakCalled = true; };
    (0, debugger_1.setGlobalDebugSession)(session);
    const interp = new interpreter_1.Interpreter();
    interp.debugSession = session;
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`
    (define y 99)
    (break!)
    (+ y 0)
  `)));
    (0, debugger_1.setGlobalDebugSession)(new debugger_1.DebugSession()); // 원래대로 복원
    assert(breakCalled, "(break!) 콜백이 호출되지 않음");
});
// ── TC-15: SourceMap getByFile ────────────────────────────────────
console.log("\n[TC-15] SourceMap.getByFile");
test("getByFile — 특정 파일 항목만 필터", () => {
    const sm = new source_map_1.SourceMap();
    sm.record("a:1", { file: "a.fl", line: 1, col: 1 });
    sm.record("b:1", { file: "b.fl", line: 1, col: 1 });
    sm.record("a:2", { file: "a.fl", line: 2, col: 1 });
    const aEntries = sm.getByFile("a.fl");
    assert(aEntries.length === 2, `a.fl 항목 수: ${aEntries.length}`);
    assert(aEntries.every(([, loc]) => loc.file === "a.fl"), "다른 파일이 포함됨");
});
// ── TC-16: 다중 break 이벤트 ──────────────────────────────────────
console.log("\n[TC-16] 다중 break 이벤트 로그");
test("여러 번 handleBreak → breakLog에 모두 기록", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    (0, debugger_1.handleBreak)(session, { file: "f.fl", line: 1, col: 1 }, { "$a": 1 });
    (0, debugger_1.handleBreak)(session, { file: "f.fl", line: 5, col: 1 }, { "$b": 2 });
    (0, debugger_1.handleBreak)(session, { file: "f.fl", line: 9, col: 1 }, { "$c": 3 });
    assert(session.breakLog.length === 3, `breakLog 길이: ${session.breakLog.length}`);
    assert(session.breakLog[0].env["$a"] === 1, "첫 번째 env 오류");
    assert(session.breakLog[2].env["$c"] === 3, "세 번째 env 오류");
});
// ── TC-17: SourceMap size ─────────────────────────────────────────
console.log("\n[TC-17] SourceMap.size()");
test("record 호출 수 == size()", () => {
    const sm = new source_map_1.SourceMap();
    sm.record("n1", { file: "f.fl", line: 1, col: 1 });
    sm.record("n2", { file: "f.fl", line: 2, col: 1 });
    sm.record("n3", { file: "f.fl", line: 3, col: 1 });
    assert(sm.size() === 3, `size: ${sm.size()}`);
});
// ── TC-18: (break!) 반환값은 null ─────────────────────────────────
console.log("\n[TC-18] (break!) 반환값");
test("(break!) 표현식 반환값은 null (다음 실행 계속)", () => {
    // 디버그 꺼진 상태 — (break!) no-op, null 반환
    const result = run(`(break!)`);
    assert(result === null, `반환값: ${result}`);
});
// ── TC-19: buildSourceMap default filename ────────────────────────
console.log("\n[TC-19] buildSourceMap 기본 파일명");
test("buildSourceMap 파일명 생략 → '<stdin>'", () => {
    const sm = (0, source_map_1.buildSourceMap)(`(+ 1 2)`);
    const entries = [...sm.entries()];
    assert(entries.length > 0, "항목 없음");
    assert(entries[0][1].file === "<stdin>", `파일명: ${entries[0][1].file}`);
});
// ── TC-20: DebugSession enabled toggle ───────────────────────────
console.log("\n[TC-20] DebugSession enabled toggle");
test("enabled true→false 전환 → 이후 handleBreak no-op", () => {
    const session = new debugger_1.DebugSession();
    session.enabled = true;
    (0, debugger_1.handleBreak)(session, { file: "x.fl", line: 1, col: 1 }, {});
    assert(session.breakLog.length === 1, "첫 break 기록 안 됨");
    session.enabled = false;
    (0, debugger_1.handleBreak)(session, { file: "x.fl", line: 2, col: 1 }, {});
    assert(session.breakLog.length === 1, "비활성화 후에도 break 기록됨");
});
// ── 결과 출력 ────────────────────────────────────────────────────
setTimeout(() => {
    console.log(`\n═══════════════════════════════════════`);
    console.log(`[Phase 78] 결과: ${passed} PASS / ${failed} FAIL`);
    if (failed === 0) {
        console.log(`✅ 모든 테스트 통과!`);
    }
    else {
        console.log(`❌ ${failed}개 실패`);
        process.exit(1);
    }
}, 100);
//# sourceMappingURL=test-phase78-debugger.js.map