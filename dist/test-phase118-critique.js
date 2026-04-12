"use strict";
// test-phase118-critique.ts — FreeLang v9 Phase 118 CRITIQUE 테스트
// 자기 출력 비판 에이전트 — 최소 25개 PASS
Object.defineProperty(exports, "__esModule", { value: true });
const critique_1 = require("./critique");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result === false) {
            console.log(`  FAIL: ${name}`);
            failed++;
        }
        else {
            console.log(`  PASS: ${name}`);
            passed++;
        }
    }
    catch (e) {
        console.log(`  FAIL: ${name} — ${e.message}`);
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
console.log("\n=== Phase 118: CRITIQUE — AI 자기 출력 비판 에이전트 ===\n");
// ── CritiqueAgent 유닛 테스트 ──────────────────────────────────────────────────
let agent;
// 1. CritiqueAgent 생성
test("1. CritiqueAgent 생성", () => {
    agent = new critique_1.CritiqueAgent();
    assert(agent !== null && agent !== undefined);
});
// 2. run() 비판 없음 → approved=true
test("2. run() 비판 없음 → approved=true", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run("정상 출력 텍스트", { finders: [] });
    assert(result.approved === true, `approved=${result.approved}`);
    assert(result.points.length === 0);
});
// 3. run() critical → approved=false
test("3. run() critical → approved=false", () => {
    agent = new critique_1.CritiqueAgent();
    const criticalFinder = (output) => [
        { type: 'missing', description: '치명적 결함', severity: 'critical' }
    ];
    const result = agent.run("출력", { finders: [criticalFinder] });
    assert(result.approved === false, `approved should be false`);
});
// 4. points 배열 반환
test("4. points 배열 반환", () => {
    agent = new critique_1.CritiqueAgent();
    const finder = (output) => [
        { type: 'weakness', description: '약점 1', severity: 'minor' },
        { type: 'assumption', description: '가정 1', severity: 'suggestion' },
    ];
    const result = agent.run("출력", { finders: [finder] });
    assert(Array.isArray(result.points));
    assert(result.points.length === 2);
});
// 5. overallRisk 계산
test("5. overallRisk 계산 (0~1 범위)", () => {
    agent = new critique_1.CritiqueAgent();
    const finder = (output) => [
        { type: 'weakness', description: '주요 문제', severity: 'major' }
    ];
    const result = agent.run("출력", { finders: [finder] });
    assert(result.overallRisk >= 0 && result.overallRisk <= 1, `overallRisk=${result.overallRisk}`);
    // major weight = 0.7
    assert(Math.abs(result.overallRisk - 0.7) < 0.01, `expected ~0.7, got ${result.overallRisk}`);
});
// 6. riskThreshold 기본값 0.5
test("6. riskThreshold 기본값 0.5", () => {
    agent = new critique_1.CritiqueAgent();
    // minor (0.3) < 0.5 → approved=true
    const minorFinder = (output) => [
        { type: 'weakness', description: '사소한 문제', severity: 'minor' }
    ];
    const result = agent.run("출력", { finders: [minorFinder] });
    assert(result.approved === true, `minor point should approve (default threshold 0.5), got ${result.approved}`);
});
// 7. 커스텀 riskThreshold
test("7. 커스텀 riskThreshold=0.2 적용", () => {
    agent = new critique_1.CritiqueAgent();
    const minorFinder = (output) => [
        { type: 'weakness', description: '사소한 문제', severity: 'minor' }
    ];
    // minor (0.3) >= 0.2 → approved=false
    const result = agent.run("출력", { finders: [minorFinder], riskThreshold: 0.2 });
    assert(result.approved === false, `minor point should fail with threshold 0.2`);
});
// 8. summary 문자열
test("8. summary 문자열 생성", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run("정상 출력 텍스트입니다", { finders: [] });
    assert(typeof result.summary === 'string');
    assert(result.summary === '비판할 점 없음 — 통과');
});
// 9. defaultFinders 빈 출력 감지 (null)
test("9. defaultFinders 빈 출력 감지 (null)", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run(null, { finders: critique_1.defaultFinders });
    const criticals = result.points.filter(p => p.severity === 'critical');
    assert(criticals.length > 0, "null 출력이 critical로 감지되어야 함");
});
// 10. defaultFinders 짧은 출력 감지
test("10. defaultFinders 짧은 출력 감지 (3글자)", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run("abc", { finders: critique_1.defaultFinders });
    const minors = result.points.filter(p => p.severity === 'minor');
    assert(minors.length > 0, "짧은 출력이 minor로 감지되어야 함");
});
// 11. defaultFinders 에러 감지
test("11. defaultFinders 에러 객체 감지", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run(new Error("테스트 오류"), { finders: critique_1.defaultFinders });
    const majors = result.points.filter(p => p.severity === 'major');
    assert(majors.length > 0, "Error 객체가 major로 감지되어야 함");
});
// 12. severity 가중치 (critical > major > minor > suggestion)
test("12. severity 가중치 순서 확인", () => {
    assert((0, critique_1.severityWeight)('critical') > (0, critique_1.severityWeight)('major'));
    assert((0, critique_1.severityWeight)('major') > (0, critique_1.severityWeight)('minor'));
    assert((0, critique_1.severityWeight)('minor') > (0, critique_1.severityWeight)('suggestion'));
    assert((0, critique_1.severityWeight)('critical') === 1.0);
    assert((0, critique_1.severityWeight)('suggestion') === 0.1);
});
// 13. finder 예외 무시
test("13. finder 예외 무시 (에러 발생 시 빈 배열 반환)", () => {
    agent = new critique_1.CritiqueAgent();
    const errorFinder = (output) => {
        throw new Error("finder 오류!");
    };
    // 예외가 발생해도 crash 없이 진행
    const result = agent.run("출력", { finders: [errorFinder] });
    assert(result.points.length === 0, "예외 발생한 finder는 무시됨");
});
// 14. 여러 finder 합산
test("14. 여러 finder 합산", () => {
    agent = new critique_1.CritiqueAgent();
    const f1 = (output) => [
        { type: 'weakness', description: '문제 A', severity: 'minor' }
    ];
    const f2 = (output) => [
        { type: 'assumption', description: '가정 B', severity: 'suggestion' }
    ];
    const result = agent.run("출력", { finders: [f1, f2] });
    assert(result.points.length === 2);
});
// 15. 빈 finders → points=[]
test("15. 빈 finders → points=[]", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run("어떤 출력", { finders: [] });
    assert(result.points.length === 0);
    assert(result.overallRisk === 0);
});
// 16. globalCritique 싱글톤 확인
test("16. globalCritique 싱글톤 사용", () => {
    const result = critique_1.globalCritique.run("정상 출력 텍스트", { finders: critique_1.defaultFinders });
    assert(typeof result.approved === 'boolean');
    assert(result.approved === true);
});
// ── 내장함수 테스트 ────────────────────────────────────────────────────────────
// 17. critique 내장함수 (정상 출력 → true)
test("17. (critique ...) 내장함수 — 정상 출력 → true", () => {
    const result = run(`(critique "안녕하세요 정상적인 긴 출력")`);
    assert(result === true, `expected true, got ${result}`);
});
// 18. critique-points 내장함수
test("18. (critique-points ...) 내장함수 — 빈 문자열 → 문제 있음", () => {
    const result = run(`(critique-points "")`);
    assert(Array.isArray(result), "결과가 배열이어야 함");
    assert(result.length > 0, "빈 문자열에서 문제 감지되어야 함");
});
// 19. critique-risk 내장함수
test("19. (critique-risk ...) 내장함수 — 숫자 반환", () => {
    const result = run(`(critique-risk "정상 출력입니다")`);
    assert(typeof result === 'number', `expected number, got ${typeof result}`);
    assert(result >= 0 && result <= 1, `overallRisk=${result}`);
});
// 20. critique-summary 내장함수
test("20. (critique-summary ...) 내장함수 — 문자열 반환", () => {
    const result = run(`(critique-summary "정상 출력입니다")`);
    assert(typeof result === 'string', `expected string, got ${typeof result}`);
    assert(result.length > 0);
});
// 21. null 출력 → critical
test("21. null 출력 → critical 포함", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run(null, { finders: critique_1.defaultFinders });
    const hasCritical = result.points.some(p => p.severity === 'critical');
    assert(hasCritical, "null은 critical이어야 함");
    assert(result.approved === false);
});
// 22. 에러 출력 → major
test("22. Error 출력 → major 포함", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run(new Error("오류"), { finders: critique_1.defaultFinders });
    const hasMajor = result.points.some(p => p.severity === 'major');
    assert(hasMajor, "Error는 major이어야 함");
});
// 23. 정상 긴 출력 → approved=true
test("23. 정상 긴 출력 → approved=true", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run("이것은 충분히 길고 정상적인 출력 문자열입니다", { finders: critique_1.defaultFinders });
    assert(result.approved === true, `approved=${result.approved}`);
    assert(result.points.length === 0);
});
// 24. CritiquePoint 구조 확인
test("24. CritiquePoint 구조 확인", () => {
    agent = new critique_1.CritiqueAgent();
    const finder = (output) => [
        { type: 'counterexample', description: '반례 존재', severity: 'major', suggestion: '반례 처리 추가' }
    ];
    const result = agent.run("출력", { finders: [finder] });
    const point = result.points[0];
    assert(point.type === 'counterexample');
    assert(point.description === '반례 존재');
    assert(point.severity === 'major');
    assert(point.suggestion === '반례 처리 추가');
});
// 25. suggestion 포함 포인트
test("25. suggestion 포함 포인트 확인", () => {
    agent = new critique_1.CritiqueAgent();
    // 짧은 출력 → suggestion 포함
    const result = agent.run("ab", { finders: critique_1.defaultFinders });
    const withSuggestion = result.points.find(p => p.suggestion !== undefined);
    assert(withSuggestion !== undefined, "suggestion 포함 포인트가 있어야 함");
    assert(typeof withSuggestion.suggestion === 'string');
});
// 26. undefined 출력 → critical
test("26. undefined 출력 → critical", () => {
    agent = new critique_1.CritiqueAgent();
    const result = agent.run(undefined, { finders: critique_1.defaultFinders });
    const hasCritical = result.points.some(p => p.severity === 'critical');
    assert(hasCritical, "undefined는 critical이어야 함");
});
// 27. _tag=Err 객체 → major 감지
test("27. _tag=Err 객체 → major 감지", () => {
    agent = new critique_1.CritiqueAgent();
    const errVal = { _tag: 'Err', message: '에러 발생' };
    const result = agent.run(errVal, { finders: critique_1.defaultFinders });
    const hasMajor = result.points.some(p => p.severity === 'major');
    assert(hasMajor, "_tag=Err는 major이어야 함");
});
// 28. summary에 문제 개수 포함
test("28. summary에 문제 개수 포함", () => {
    agent = new critique_1.CritiqueAgent();
    const finder = (output) => [
        { type: 'weakness', description: '문제 1', severity: 'major' },
        { type: 'assumption', description: '문제 2', severity: 'minor' },
    ];
    const result = agent.run("출력", { finders: [finder] });
    assert(result.summary.includes('2'), `summary: ${result.summary}`);
    assert(result.summary.includes('%'), `위험도 % 포함`);
});
// ── 최종 결과 ──────────────────────────────────────────────────────────────────
console.log(`\n총 결과: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase118-critique.js.map