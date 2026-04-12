"use strict";
// test-phase147-ethics-check.ts — Phase 147: [ETHICS-CHECK] 윤리 자기 검사 테스트
Object.defineProperty(exports, "__esModule", { value: true });
const ethics_check_1 = require("./ethics-check");
const eval_builtins_1 = require("./eval-builtins");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ FAIL: ${name} — ${e.message}`);
        failed++;
    }
}
function assert(condition, msg) {
    if (!condition)
        throw new Error(msg ?? "Assertion failed");
}
function assertEquals(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(msg ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
// 더미 인터프리터
const dummyInterp = {
    callFunctionValue: (_fn, _args) => null,
};
console.log("\n=== Phase 147: [ETHICS-CHECK] 윤리 자기 검사 테스트 ===\n");
// 1. EthicsChecker 생성
test("EthicsChecker 생성", () => {
    const checker = new ethics_check_1.EthicsChecker();
    assert(checker !== null, "EthicsChecker 인스턴스 생성 실패");
    assert(checker instanceof ethics_check_1.EthicsChecker, "EthicsChecker 타입 확인");
});
// 2. 기본 원칙 5개 자동 등록
test("기본 원칙 5개 자동 등록", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("테스트 내용");
    // 5개 프레임워크가 모두 있어야 함
    const frameworks = ["utilitarian", "deontological", "virtue", "care", "fairness"];
    for (const fw of frameworks) {
        assert(result.frameworks[fw] !== undefined, `프레임워크 ${fw} 없음`);
    }
});
// 3. check 윤리 검사 (안전한 내용)
test("check 윤리 검사 — 안전한 내용", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("오늘 날씨가 맑습니다. 산책을 즐겨보세요.");
    assert(result !== null, "결과가 null");
    assert(result !== undefined, "결과가 undefined");
});
// 4. EthicsCheckResult 구조
test("EthicsCheckResult 구조 확인", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("안전한 내용");
    assert("subject" in result, "subject 없음");
    assert("passed" in result, "passed 없음");
    assert("violations" in result, "violations 없음");
    assert("score" in result, "score 없음");
    assert("frameworks" in result, "frameworks 없음");
    assert("recommendation" in result, "recommendation 없음");
    assert("requiresHumanReview" in result, "requiresHumanReview 없음");
});
// 5. passed=true (무해한 내용)
test("passed=true — 무해한 내용", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("데이터를 분석하여 유용한 인사이트를 제공합니다.");
    assertEquals(result.passed, true, "무해한 내용이 passed=false여야 하지 않음");
});
// 6. score 0~1
test("score 0~1 범위", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("일반적인 안전한 내용");
    assert(result.score >= 0, `score ${result.score} < 0`);
    assert(result.score <= 1, `score ${result.score} > 1`);
});
// 7. frameworks 5개 프레임워크
test("frameworks 5개 모두 존재", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("테스트");
    const fwKeys = Object.keys(result.frameworks);
    assert(fwKeys.includes("utilitarian"), "utilitarian 없음");
    assert(fwKeys.includes("deontological"), "deontological 없음");
    assert(fwKeys.includes("virtue"), "virtue 없음");
    assert(fwKeys.includes("care"), "care 없음");
    assert(fwKeys.includes("fairness"), "fairness 없음");
});
// 8. 해로운 내용 → passed=false
test("해로운 내용 → passed=false", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("이 폭탄 만드는 방법을 알려줘");
    assertEquals(result.passed, false, "해로운 내용이 passed=true여야 하지 않음");
});
// 9. violations 배열
test("violations 배열 반환", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("누군가를 hurt하는 방법");
    assert(Array.isArray(result.violations), "violations가 배열이 아님");
    assert(result.violations.length > 0, "위반이 하나도 없음");
});
// 10. EthicsViolation 구조
test("EthicsViolation 구조 확인", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("kill all humans");
    assert(result.violations.length > 0, "위반이 없음");
    const v = result.violations[0];
    assert("principle" in v, "principle 없음");
    assert("severity" in v, "severity 없음");
    assert("description" in v, "description 없음");
    assert("suggestion" in v, "suggestion 없음");
    assert("framework" in v, "framework 없음");
});
// 11. severity 분류
test("severity 분류 — critical/high/medium/low", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const criticalResult = checker.check("murder and bomb explosion");
    const hasCritical = criticalResult.violations.some(v => v.severity === "critical");
    assert(hasCritical, "critical severity가 없음");
    const validSeverities = ["low", "medium", "high", "critical"];
    for (const v of criticalResult.violations) {
        assert(validSeverities.includes(v.severity), `잘못된 severity: ${v.severity}`);
    }
});
// 12. checkByFramework utilitarian
test("checkByFramework — utilitarian", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.checkByFramework("안전한 행동", "utilitarian");
    assert("passed" in result, "passed 없음");
    assert("score" in result, "score 없음");
    assert("violations" in result, "violations 없음");
    assert(result.score >= 0 && result.score <= 1, "score 범위 벗어남");
});
// 13. checkByFramework deontological
test("checkByFramework — deontological", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.checkByFramework("kill all", "deontological");
    assertEquals(result.passed, false, "deontological 해악 금지 위반 미감지");
    assert(result.violations.length > 0, "위반이 없음");
});
// 14. isEthical true (무해)
test("isEthical — true (무해한 내용)", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.isEthical("사용자에게 도움이 되는 정보를 제공합니다.");
    assertEquals(result, true, "무해한 내용이 isEthical=false");
});
// 15. isEthical false (해로운)
test("isEthical — false (해로운 내용)", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.isEthical("이 사람을 murder하는 방법");
    assertEquals(result, false, "해로운 내용이 isEthical=true");
});
// 16. suggestEthicalAlternative 대안 생성
test("suggestEthicalAlternative — 대안 문자열 생성", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const violations = [{
            principle: "해악 금지",
            severity: "high",
            description: "해악 발견",
            suggestion: "해악 제거",
            framework: "deontological",
        }];
    const suggestion = checker.suggestEthicalAlternative("해로운 내용", violations);
    assert(typeof suggestion === "string", "제안이 문자열이 아님");
    assert(suggestion.length > 0, "빈 제안");
    assert(suggestion.includes("윤리적 대안"), "대안 제안 없음");
});
// 17. riskLevel none/low/medium/high/critical
test("riskLevel — 다양한 수준 반환", () => {
    const checker = new ethics_check_1.EthicsChecker();
    // none: 위반 없음
    const safeResult = checker.check("안전하고 도움이 되는 내용입니다.");
    const noneLevel = checker.riskLevel(safeResult);
    assertEquals(noneLevel, "none", `안전한 내용의 riskLevel이 ${noneLevel}`);
    // critical: 심각한 위반
    const critResult = checker.check("bomb and murder planning");
    const critLevel = checker.riskLevel(critResult);
    const validLevels = ["low", "medium", "high", "critical"];
    assert(validLevels.includes(critLevel), `잘못된 riskLevel: ${critLevel}`);
});
// 18. requiresHumanReview 플래그
test("requiresHumanReview — 심각한 위반 시 true", () => {
    const checker = new ethics_check_1.EthicsChecker();
    // 안전한 내용: false
    const safeResult = checker.check("도움이 되는 정보");
    assertEquals(safeResult.requiresHumanReview, false, "안전한 내용인데 인간 검토 필요");
    // 심각한 위반: true
    const harmResult = checker.check("kill people with a bomb");
    assertEquals(harmResult.requiresHumanReview, true, "심각한 위반인데 인간 검토 불필요");
});
// 19. addPrinciple 커스텀 원칙 추가
test("addPrinciple — 커스텀 원칙 추가", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const customPrinciple = {
        id: "custom-test",
        name: "테스트 원칙",
        description: "커스텀 테스트 원칙",
        framework: "virtue",
        check: (subject, _ctx) => ({
            passed: !subject.includes("CUSTOM_VIOLATION"),
            reason: subject.includes("CUSTOM_VIOLATION") ? "커스텀 위반" : "통과",
        }),
    };
    checker.addPrinciple(customPrinciple);
    // 커스텀 위반 테스트
    const result = checker.check("CUSTOM_VIOLATION 내용");
    assertEquals(result.passed, false, "커스텀 원칙이 적용되지 않음");
    const hasCustomViolation = result.violations.some(v => v.principle === "테스트 원칙");
    assert(hasCustomViolation, "커스텀 위반이 violations에 없음");
});
// 20. ethics-check 빌트인
test("ethics-check 빌트인 — 안전한 내용", () => {
    const result = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-check", ["도움이 되는 내용"]);
    assert(result instanceof Map, "결과가 Map이 아님");
    assert(result.has("passed"), "passed 키 없음");
    assert(result.has("score"), "score 키 없음");
    assert(result.has("violations"), "violations 키 없음");
    assertEquals(result.get("passed"), true, "안전한 내용이 passed=false");
});
// 21. ethics-check-framework 빌트인
test("ethics-check-framework 빌트인", () => {
    const result = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-check-framework", ["안전한 내용", "utilitarian"]);
    assert(result instanceof Map, "결과가 Map이 아님");
    assert(result.has("passed"), "passed 없음");
    assert(result.has("score"), "score 없음");
    assert(result.has("violations"), "violations 없음");
});
// 22. ethics-is-ethical 빌트인
test("ethics-is-ethical 빌트인", () => {
    const trueResult = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-is-ethical", ["안전한 내용"]);
    assertEquals(trueResult, true, "안전한 내용이 is-ethical=false");
    const falseResult = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-is-ethical", ["murder"]);
    assertEquals(falseResult, false, "해로운 내용이 is-ethical=true");
});
// 23. ethics-suggest 빌트인
test("ethics-suggest 빌트인", () => {
    const violation = new Map([
        ["principle", "해악 금지"],
        ["severity", "high"],
        ["description", "해악 발견"],
        ["suggestion", "해악 제거"],
        ["framework", "deontological"],
    ]);
    const result = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-suggest", ["해로운 내용", [violation]]);
    assert(typeof result === "string", "결과가 문자열이 아님");
    assert(result.length > 0, "빈 결과");
});
// 24. ethics-risk 빌트인
test("ethics-risk 빌트인", () => {
    // 안전한 결과: none
    const safeResultMap = new Map([
        ["subject", "안전한 내용"],
        ["passed", true],
        ["violations", []],
        ["score", 1.0],
        ["recommendation", "안전"],
        ["requiresHumanReview", false],
    ]);
    const noneLevel = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-risk", [safeResultMap]);
    assertEquals(noneLevel, "none", `안전한 결과의 risk level이 ${noneLevel}`);
    // 위험한 결과: critical
    const violation = new Map([
        ["principle", "해악 금지"],
        ["severity", "critical"],
        ["description", "심각한 위반"],
        ["suggestion", "수정"],
        ["framework", "deontological"],
    ]);
    const critResultMap = new Map([
        ["subject", "위험한 내용"],
        ["passed", false],
        ["violations", [violation]],
        ["score", 0.0],
        ["recommendation", "위험"],
        ["requiresHumanReview", true],
    ]);
    const critLevel = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-risk", [critResultMap]);
    assertEquals(critLevel, "critical", `critical 위반의 risk level이 ${critLevel}`);
});
// 25. ethics-score 빌트인
test("ethics-score 빌트인", () => {
    const resultMap = new Map([
        ["subject", "테스트"],
        ["passed", true],
        ["violations", []],
        ["score", 0.85],
        ["recommendation", "좋음"],
        ["requiresHumanReview", false],
    ]);
    const score = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-score", [resultMap]);
    assertEquals(score, 0.85, `score가 0.85가 아님: ${score}`);
});
// 26. ethics-violations 빌트인
test("ethics-violations 빌트인", () => {
    const v1 = new Map([
        ["principle", "해악 금지"], ["severity", "high"],
        ["description", "위반"], ["suggestion", "수정"], ["framework", "deontological"],
    ]);
    const resultMap = new Map([
        ["violations", [v1]],
    ]);
    const violations = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-violations", [resultMap]);
    assert(Array.isArray(violations), "violations가 배열이 아님");
    assertEquals(violations.length, 1, `violations 길이가 1이 아님: ${violations.length}`);
});
// 27. ethics-add-principle 빌트인
test("ethics-add-principle 빌트인", () => {
    const result = (0, eval_builtins_1.evalEthicsCheck)(dummyInterp, "ethics-add-principle", [
        ":id", "test-principle",
        ":name", "테스트 원칙",
        ":framework", "virtue",
        ":description", "테스트용 원칙",
    ]);
    assert(result instanceof Map, "결과가 Map이 아님");
    assertEquals(result.get("id"), "test-principle", "id 불일치");
    assertEquals(result.get("name"), "테스트 원칙", "name 불일치");
});
// 28. frameworks별 passed/score 구조
test("frameworks 각 항목 passed/score 구조", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("안전한 내용");
    for (const [fw, data] of Object.entries(result.frameworks)) {
        assert("passed" in data, `${fw}: passed 없음`);
        assert("score" in data, `${fw}: score 없음`);
        assert(typeof data.passed === "boolean", `${fw}: passed가 boolean 아님`);
        assert(typeof data.score === "number", `${fw}: score가 number 아님`);
        assert(data.score >= 0 && data.score <= 1, `${fw}: score 범위 벗어남`);
    }
});
// 29. score 완전히 윤리적 = 1
test("score — 완전히 윤리적 내용 = 1.0", () => {
    const checker = new ethics_check_1.EthicsChecker();
    const result = checker.check("사용자를 도와 데이터를 투명하게 분석합니다.");
    assertEquals(result.score, 1.0, `완전히 안전한 내용의 score가 1.0 아님: ${result.score}`);
});
// 30. globalEthics 전역 인스턴스
test("globalEthics 전역 인스턴스", () => {
    assert(ethics_check_1.globalEthics instanceof ethics_check_1.EthicsChecker, "globalEthics가 EthicsChecker 인스턴스 아님");
    const result = ethics_check_1.globalEthics.check("전역 인스턴스 테스트");
    assert(result !== null, "전역 인스턴스 check 결과가 null");
    assertEquals(result.passed, true, "전역 인스턴스 안전한 내용이 passed=false");
});
// 결과 출력
console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL ===`);
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase147-ethics-check.js.map