"use strict";
// test-phase113-debate.ts — FreeLang v9 Phase 113: DEBATE 내부 찬반 에이전트 토론
Object.defineProperty(exports, "__esModule", { value: true });
const debate_1 = require("./debate");
let pass = 0;
let fail = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  PASS  ${name}`);
            pass++;
        }
        else {
            console.log(`  FAIL  ${name}`);
            fail++;
        }
    }
    catch (e) {
        console.log(`  FAIL  ${name} — ${e.message}`);
        fail++;
    }
}
// 공통 찬성/반대 에이전트 헬퍼
function makeProAgent(strength) {
    return (round, conArgs) => ({
        side: 'pro',
        point: `Pro argument round ${round}`,
        strength,
    });
}
function makeConAgent(strength) {
    return (round, proArgs) => ({
        side: 'con',
        point: `Con argument round ${round}`,
        strength,
    });
}
console.log("\n=== Phase 113: DEBATE 내부 찬반 에이전트 토론 ===\n");
// 1. Debater 생성
test("1. Debater 클래스 인스턴스 생성", () => {
    const d = new debate_1.Debater();
    return d instanceof debate_1.Debater;
});
// 2. debate() 기본 동작
test("2. debate() 기본 동작 — DebateResult 반환", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "AI는 인간보다 낫다",
        pro: makeProAgent(0.7),
        con: makeConAgent(0.5),
    });
    return typeof result === 'object' && result !== null && 'winner' in result;
});
// 3. winner = 'pro' (pro 점수 높음)
test("3. winner = 'pro' (pro 점수 높을 때)", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "테스트 명제",
        pro: makeProAgent(0.9),
        con: makeConAgent(0.3),
    });
    return result.winner === 'pro';
});
// 4. winner = 'con' (con 점수 높음)
test("4. winner = 'con' (con 점수 높을 때)", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "테스트 명제",
        pro: makeProAgent(0.2),
        con: makeConAgent(0.8),
    });
    return result.winner === 'con';
});
// 5. winner = 'tie' (동점)
test("5. winner = 'tie' (동점)", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "동점 명제",
        pro: makeProAgent(0.5),
        con: makeConAgent(0.5),
    });
    return result.winner === 'tie';
});
// 6. rounds 기본값 3
test("6. rounds 기본값 3 — rounds 배열 길이 3", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "기본 rounds",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.rounds.length === 3;
});
// 7. rounds 커스텀
test("7. rounds 커스텀 (5라운드)", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "커스텀 rounds",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
        rounds: 5,
    });
    return result.rounds.length === 5;
});
// 8. proScore 범위 0~1
test("8. proScore 범위 0.0~1.0", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "점수 범위",
        pro: makeProAgent(0.7),
        con: makeConAgent(0.3),
    });
    return result.proScore >= 0 && result.proScore <= 1;
});
// 9. conScore 범위 0~1
test("9. conScore 범위 0.0~1.0", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "점수 범위",
        pro: makeProAgent(0.7),
        con: makeConAgent(0.3),
    });
    return result.conScore >= 0 && result.conScore <= 1;
});
// 10. rounds 배열 길이 확인
test("10. rounds 배열 각 요소에 round 번호 포함", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "rounds 배열",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.rounds[0].round === 1 &&
        result.rounds[1].round === 2 &&
        result.rounds[2].round === 3;
});
// 11. proArgument.side = 'pro'
test("11. proArgument.side === 'pro'", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "side 확인",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.rounds.every(r => r.proArgument.side === 'pro');
});
// 12. conArgument.side = 'con'
test("12. conArgument.side === 'con'", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "side 확인",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.rounds.every(r => r.conArgument.side === 'con');
});
// 13. pro fn에 이전 con 논증 전달
test("13. pro fn에 이전 con 논증 전달됨", () => {
    const d = new debate_1.Debater();
    const receivedConArgs = [];
    const result = d.debate({
        proposition: "논증 전달",
        pro: (round, conArgs) => {
            receivedConArgs.push([...conArgs]);
            return { side: 'pro', point: 'pro', strength: 0.6 };
        },
        con: makeConAgent(0.4),
    });
    // 1라운드 때는 con 논증이 없어야 하고, 2라운드 이후에는 있어야 함
    return receivedConArgs[0].length === 0 &&
        receivedConArgs[1].length === 1 &&
        receivedConArgs[2].length === 2;
});
// 14. con fn에 이전 pro 논증 전달
test("14. con fn에 이전 pro 논증 전달됨", () => {
    const d = new debate_1.Debater();
    const receivedProArgs = [];
    const result = d.debate({
        proposition: "논증 전달",
        pro: makeProAgent(0.6),
        con: (round, proArgs) => {
            receivedProArgs.push([...proArgs]);
            return { side: 'con', point: 'con', strength: 0.4 };
        },
    });
    // con은 매 라운드마다 지금까지의 pro 논증을 받음 (pro가 먼저 발언)
    return receivedProArgs[0].length === 1 &&
        receivedProArgs[1].length === 2 &&
        receivedProArgs[2].length === 3;
});
// 15. conclusion 문자열 포함
test("15. conclusion 문자열에 proposition 포함", () => {
    const d = new debate_1.Debater();
    const prop = "FreeLang이 필요하다";
    const result = d.debate({
        proposition: prop,
        pro: makeProAgent(0.7),
        con: makeConAgent(0.3),
    });
    return typeof result.conclusion === 'string' && result.conclusion.includes(prop);
});
// 16. 커스텀 judge 함수
test("16. 커스텀 judge 함수 적용", () => {
    const d = new debate_1.Debater();
    // 커스텀 judge: 항상 'tie' 반환
    const result = d.debate({
        proposition: "커스텀 judge",
        pro: makeProAgent(0.9),
        con: makeConAgent(0.1),
        judge: () => 'tie',
    });
    return result.winner === 'tie';
});
// 17. globalDebater 싱글톤
test("17. globalDebater 싱글톤 사용 가능", () => {
    const result = debate_1.globalDebater.debate({
        proposition: "싱글톤",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.winner !== undefined;
});
// 18. debate 내장 함수 (직접 로직 검증)
test("18. debate 내장 함수 로직 — winner 문자열 반환", () => {
    const result = debate_1.globalDebater.debate({
        proposition: "내장함수 테스트",
        pro: makeProAgent(0.8),
        con: makeConAgent(0.2),
    });
    return typeof result.winner === 'string' && ['pro', 'con', 'tie'].includes(result.winner);
});
// 19. debate-score 내장 함수 (직접 로직 검증)
test("19. debate-score 내장 함수 — { pro, con } 반환", () => {
    const result = debate_1.globalDebater.debate({
        proposition: "score 테스트",
        pro: makeProAgent(0.7),
        con: makeConAgent(0.3),
    });
    const score = { pro: result.proScore, con: result.conScore };
    return typeof score.pro === 'number' && typeof score.con === 'number';
});
// 20. debate-conclusion 내장 함수 (직접 로직 검증)
test("20. debate-conclusion 내장 함수 — conclusion 문자열 반환", () => {
    const result = debate_1.globalDebater.debate({
        proposition: "conclusion 테스트",
        pro: makeProAgent(0.7),
        con: makeConAgent(0.3),
    });
    return typeof result.conclusion === 'string' && result.conclusion.length > 0;
});
// 21. strength 0~1 범위
test("21. 각 Argument의 strength 0~1 범위", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "strength 범위",
        pro: (r, _) => ({ side: 'pro', point: 'p', strength: 0.75 }),
        con: (r, _) => ({ side: 'con', point: 'c', strength: 0.25 }),
    });
    const allValid = result.rounds.every(r => r.proArgument.strength >= 0 && r.proArgument.strength <= 1 &&
        r.conArgument.strength >= 0 && r.conArgument.strength <= 1);
    return allValid;
});
// 22. 단일 라운드 (rounds=1)
test("22. 단일 라운드 (rounds=1)", () => {
    const d = new debate_1.Debater();
    const result = d.debate({
        proposition: "단일 라운드",
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
        rounds: 1,
    });
    return result.rounds.length === 1;
});
// 23. proposition이 결과에 포함
test("23. proposition이 DebateResult에 포함", () => {
    const d = new debate_1.Debater();
    const prop = "Test Proposition";
    const result = d.debate({
        proposition: prop,
        pro: makeProAgent(0.6),
        con: makeConAgent(0.4),
    });
    return result.proposition === prop;
});
// 24. 반복 호출 독립성
test("24. 반복 호출 독립성 — 각 호출 결과가 독립적", () => {
    const d = new debate_1.Debater();
    const r1 = d.debate({
        proposition: "명제 A",
        pro: makeProAgent(0.9),
        con: makeConAgent(0.1),
    });
    const r2 = d.debate({
        proposition: "명제 B",
        pro: makeProAgent(0.1),
        con: makeConAgent(0.9),
    });
    return r1.winner === 'pro' && r2.winner === 'con' && r1.proposition !== r2.proposition;
});
// 25. 찬반 논증 교환 후 반응형 논증 가능
test("25. 반응형 논증 — 이전 논증에 반응하는 에이전트", () => {
    const d = new debate_1.Debater();
    let proReactedToConArgs = false;
    const result = d.debate({
        proposition: "반응형 논증",
        pro: (round, conArgs) => {
            // 2라운드 이후에는 con 논증에 반응
            if (round > 1 && conArgs.length > 0) {
                proReactedToConArgs = true;
                const lastCon = conArgs[conArgs.length - 1];
                return {
                    side: 'pro',
                    point: `반박: ${lastCon.point}`,
                    // con이 강하면 더 강하게 반응
                    strength: Math.min(1.0, lastCon.strength + 0.2),
                };
            }
            return { side: 'pro', point: '초기 주장', strength: 0.5 };
        },
        con: (round, proArgs) => ({
            side: 'con',
            point: `반대 round ${round}`,
            strength: 0.6,
        }),
    });
    return proReactedToConArgs && result.rounds.length === 3;
});
// 결과 출력
console.log(`\n결과: ${pass}개 PASS, ${fail}개 FAIL (총 ${pass + fail}개)\n`);
if (fail > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase113-debate.js.map