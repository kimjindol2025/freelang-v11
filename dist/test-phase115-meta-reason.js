"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Phase 115: META-REASON 추론 방법 자동 선택 테스트
const meta_reason_1 = require("./meta-reason");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  PASS  ${name}`);
            passed++;
        }
        else {
            console.log(`  FAIL  ${name}`);
            failed++;
        }
    }
    catch (e) {
        console.log(`  FAIL  ${name} — ${e.message}`);
        failed++;
    }
}
const ALL_STRATEGIES = ['COT', 'TOT', 'HYPOTHESIS', 'DEBATE', 'REFLECT', 'DIRECT'];
console.log("\n=== Phase 115: META-REASON 테스트 ===\n");
// 1. MetaReasoner 생성
test("1. MetaReasoner 생성", () => {
    const mr = new meta_reason_1.MetaReasoner();
    return mr instanceof meta_reason_1.MetaReasoner;
});
// 2. analyze() 결과 반환
test("2. analyze() 결과 반환", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("how to solve this step by step");
    return result !== null && result !== undefined;
});
// 3. selected가 전략 중 하나
test("3. selected가 전략 중 하나", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("step by step explanation");
    return ALL_STRATEGIES.includes(result.selected);
});
// 4. scores 배열 포함
test("4. scores 배열 포함", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("compare options for this");
    return Array.isArray(result.scores) && result.scores.length > 0;
});
// 5. scores 내림차순 정렬
test("5. scores 내림차순 정렬", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("step by step solution");
    for (let i = 0; i < result.scores.length - 1; i++) {
        if (result.scores[i].score < result.scores[i + 1].score)
            return false;
    }
    return true;
});
// 6. rationale 문자열
test("6. rationale 문자열", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("how to do this step by step");
    return typeof result.rationale === "string" && result.rationale.length > 0;
});
// 7. "step by step" → COT 선택
test("7. 'step by step' → COT 선택", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("how to solve this step by step");
    return result.selected === "COT";
});
// 8. "compare options" → TOT 선택
test("8. 'compare options' → TOT 선택", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("compare options for the best approach");
    return result.selected === "TOT";
});
// 9. "is this correct" → HYPOTHESIS 선택
test("9. 'is this correct' → HYPOTHESIS 선택", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("verify if this is correct");
    return result.selected === "HYPOTHESIS";
});
// 10. "should we" → DEBATE 선택
test("10. 'should we' → DEBATE 선택", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("should we use this approach vs that one");
    return result.selected === "DEBATE";
});
// 11. "review quality" → REFLECT 선택
test("11. 'review quality' → REFLECT 선택", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("review the quality of this output");
    return result.selected === "REFLECT";
});
// 12. 짧은 문제 → DIRECT 선택 경향 (길이 < 30)
test("12. 짧은 문제 → DIRECT 선택 경향", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("hi");
    // DIRECT의 점수가 0.8 이상이어야 함
    const directScore = result.scores.find(s => s.strategy === "DIRECT");
    return directScore !== undefined && directScore.score >= 0.8;
});
// 13. addStrategy() 추가
test("13. addStrategy() 추가", () => {
    const mr = new meta_reason_1.MetaReasoner(['COT', 'TOT']);
    mr.addStrategy('DEBATE');
    return mr.getStrategies().includes('DEBATE');
});
// 14. 커스텀 strategies 생성자
test("14. 커스텀 strategies 생성자", () => {
    const mr = new meta_reason_1.MetaReasoner(['COT', 'REFLECT']);
    const result = mr.analyze("step by step solution");
    return result.scores.length === 2;
});
// 15. globalMetaReasoner 싱글톤
test("15. globalMetaReasoner 싱글톤", () => {
    return meta_reason_1.globalMetaReasoner instanceof meta_reason_1.MetaReasoner;
});
// 16. meta-reason 내장함수 (Interpreter 통해)
test("16. meta-reason 내장함수", () => {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)('(meta-reason "step by step how to solve")')));
    const result = interp.context.lastValue;
    return typeof result === "string" && ALL_STRATEGIES.includes(result);
});
// 17. meta-reason-scores 내장함수
test("17. meta-reason-scores 내장함수", () => {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)('(meta-reason-scores "compare options for this")')));
    const result = interp.context.lastValue;
    return result !== null && typeof result === "object" && !Array.isArray(result);
});
// 18. meta-reason-rationale 내장함수
test("18. meta-reason-rationale 내장함수", () => {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)('(meta-reason-rationale "should we do this or that")')));
    const result = interp.context.lastValue;
    return typeof result === "string" && result.length > 0;
});
// 19. 점수 범위 0~1
test("19. 점수 범위 0~1", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("any arbitrary problem here to test bounds");
    return result.scores.every(s => s.score >= 0 && s.score <= 1);
});
// 20. 동일 문제 반복 호출 일관성
test("20. 동일 문제 반복 호출 일관성", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const p = "how to do this step by step";
    const r1 = mr.analyze(p);
    const r2 = mr.analyze(p);
    return r1.selected === r2.selected;
});
// 21. 빈 문자열 처리
test("21. 빈 문자열 처리", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("");
    return ALL_STRATEGIES.includes(result.selected) && result.scores.length > 0;
});
// 22. 한국어 문제 인식 ('단계', '방법', '결정')
test("22. 한국어 문제 인식 - 단계", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("이 문제를 단계별로 설명해 주세요");
    const cotScore = result.scores.find(s => s.strategy === "COT");
    return cotScore !== undefined && cotScore.score >= 0.9;
});
test("22b. 한국어 문제 인식 - 방법", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("최선의 방법을 비교해 주세요");
    const totScore = result.scores.find(s => s.strategy === "TOT");
    return totScore !== undefined && totScore.score >= 0.9;
});
test("22c. 한국어 문제 인식 - 결정", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("이 결정을 내려야 할까요");
    const debateScore = result.scores.find(s => s.strategy === "DEBATE");
    return debateScore !== undefined && debateScore.score >= 0.85;
});
// 23. 문제 길이가 점수에 영향
test("23. 문제 길이가 점수에 영향 (짧을수록 DIRECT 유리)", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const short = mr.analyze("hi");
    const long = mr.analyze("This is a very long problem statement that goes on and on about many different things");
    const shortDirect = short.scores.find(s => s.strategy === "DIRECT");
    const longDirect = long.scores.find(s => s.strategy === "DIRECT");
    return shortDirect.score > longDirect.score;
});
// 24. 최고 점수 전략이 selected
test("24. 최고 점수 전략이 selected", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("step by step how to do it");
    const maxScore = Math.max(...result.scores.map(s => s.score));
    const topStrategy = result.scores.find(s => s.score === maxScore);
    return topStrategy.strategy === result.selected;
});
// 25. 모든 전략이 scores에 포함 (기본 생성자)
test("25. 모든 전략이 scores에 포함", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("any problem");
    const strategyNames = result.scores.map(s => s.strategy);
    return ALL_STRATEGIES.every(s => strategyNames.includes(s));
});
// 추가: scores에 reason 필드 존재
test("26. scores에 reason 필드 존재", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("step by step");
    return result.scores.every(s => typeof s.reason === "string" && s.reason.length > 0);
});
// 추가: problem 필드 보존
test("27. problem 필드 보존", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const p = "unique problem string 12345";
    const result = mr.analyze(p);
    return result.problem === p;
});
// 추가: addStrategy 중복 추가 방지
test("28. addStrategy 중복 추가 방지", () => {
    const mr = new meta_reason_1.MetaReasoner(['COT', 'TOT']);
    mr.addStrategy('COT');
    return mr.getStrategies().length === 2;
});
// 추가: rationale에 selected 전략 이름 포함
test("29. rationale에 selected 전략 이름 포함", () => {
    const mr = new meta_reason_1.MetaReasoner();
    const result = mr.analyze("how to do this step by step");
    return result.rationale.includes(result.selected);
});
// 추가: meta-reason-scores 결과가 점수를 담은 객체
test("30. meta-reason-scores 결과 구조 검증", () => {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)('(meta-reason-scores "step by step how")')));
    const result = interp.context.lastValue;
    return typeof result["COT"] === "number" && result["COT"] >= 0 && result["COT"] <= 1;
});
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL (총 ${passed + failed}개) ===\n`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-phase115-meta-reason.js.map