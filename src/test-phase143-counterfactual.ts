// test-phase143-counterfactual.ts — FreeLang v9 Phase 143 테스트
// 반사실 추론: "만약 비가 안 왔다면 사고가 났을까?"

import { CounterfactualReasoner, Scenario, globalCounterfactual } from "./counterfactual";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    if (result !== false) {
      console.log(`  ✅ PASS: ${name}`);
      pass++;
    } else {
      console.log(`  ❌ FAIL: ${name}`);
      fail++;
    }
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    fail++;
  }
}

function assert(cond: boolean, msg?: string): void {
  if (!cond) throw new Error(msg ?? "Assertion failed");
}

// 공통 outcome 함수: 비 + 속도 → 사고
// rain=true && speed>50 → "accident", else "safe"
function accidentOutcome(vars: Record<string, unknown>): string {
  const rain = vars["rain"] as boolean;
  const speed = vars["speed"] as number;
  if (rain && speed > 50) return "accident";
  return "safe";
}

// 수치 outcome: 사고 확률 0~1
function riskScore(vars: Record<string, unknown>): number {
  const rain = (vars["rain"] as boolean) ? 1 : 0;
  const speed = (vars["speed"] as number) || 0;
  return rain * 0.5 + (speed / 200);
}

console.log("\n=== Phase 143: COUNTERFACTUAL 반사실 추론 ===\n");

// 1. CounterfactualReasoner 생성
const reasoner = new CounterfactualReasoner();
test("1. CounterfactualReasoner 생성", () => reasoner instanceof CounterfactualReasoner);

// 2. registerScenario 시나리오 등록
const scenario: Scenario = {
  id: "s1",
  name: "비오는날 사고",
  variables: { rain: true, speed: 60, road: "wet" },
  outcome: "accident",
};
reasoner.registerScenario(scenario);
test("2. registerScenario 시나리오 등록", () => {
  const cf = reasoner.createCounterfactual("s1", { rain: false }, accidentOutcome);
  return cf !== null;
});

// 3. whatIf 단순 반사실
const wf = reasoner.whatIf(
  { rain: true, speed: 60 },
  { rain: false },
  accidentOutcome
);
test("3. whatIf 반환값 존재", () => wf !== null && wf !== undefined);

// 4. Counterfactual 구조 검증
test("4. Counterfactual 구조: id, baseScenario, intervention, counterfactualOutcome", () => {
  return (
    typeof wf.id === "string" &&
    wf.baseScenario !== undefined &&
    wf.intervention !== undefined &&
    wf.counterfactualOutcome !== undefined
  );
});

// 5. intervention 적용 확인
test("5. intervention rain=false 적용", () => {
  return wf.intervention["rain"] === false;
});

// 6. counterfactualOutcome 계산 (rain=false, speed=60 → safe)
test("6. counterfactualOutcome = safe", () => {
  return wf.counterfactualOutcome === "safe";
});

// 7. probability 범위 0~1
test("7. probability 범위 0~1", () => {
  return wf.probability >= 0 && wf.probability <= 1;
});

// 8. explanation 생성
test("8. explanation 문자열 생성", () => {
  return typeof wf.explanation === "string" && wf.explanation.length > 0;
});

// 9. analyze 다중 분석
const analysis = reasoner.analyze(
  "s1",
  [
    { rain: false },
    { speed: 30 },
    { rain: false, speed: 30 },
  ],
  accidentOutcome
);
test("9. analyze 다중 반사실 분석", () => analysis !== null && analysis !== undefined);

// 10. CounterfactualAnalysis 구조
test("10. CounterfactualAnalysis: original, counterfactuals, mostLikelyAlternative", () => {
  return (
    analysis.original !== undefined &&
    Array.isArray(analysis.counterfactuals) &&
    analysis.mostLikelyAlternative !== undefined
  );
});

// 11. counterfactuals 개수 = 3
test("11. counterfactuals 개수 = 3", () => analysis.counterfactuals.length === 3);

// 12. mostLikelyAlternative 선택됨
test("12. mostLikelyAlternative 선택", () => {
  const best = analysis.mostLikelyAlternative;
  return typeof best.probability === "number" && best.probability >= 0;
});

// 13. keyFactors 식별
test("13. keyFactors 배열", () => Array.isArray(analysis.keyFactors));

// 14. sensitivityAnalysis 민감도
const sens = reasoner.sensitivityAnalysis(
  { rain: true, speed: 60 },
  riskScore
);
test("14. sensitivityAnalysis 반환값", () => sens !== null && typeof sens === "object");

// 15. sensitivity에 rain, speed 포함
test("15. sensitivity에 rain, speed 키 포함", () => {
  return "rain" in sens && "speed" in sens;
});

// 16. findMinimalIntervention 최소 변경
const minimal = reasoner.findMinimalIntervention("s1", "safe", accidentOutcome);
test("16. findMinimalIntervention 결과 반환", () => minimal !== null);

// 17. delta 계산 정확성
const cf1 = reasoner.createCounterfactual("s1", { speed: 30 }, accidentOutcome);
test("17. delta 계산: speed 변화 포함", () => {
  return cf1.delta !== null && "speed" in cf1.delta;
});

// 18. baseScenario.outcome과 counterfactualOutcome 비교
test("18. counterfactualOutcome ≠ baseScenario.outcome (speed=30 → safe)", () => {
  return cf1.counterfactualOutcome === "safe" && cf1.baseScenario.outcome === "accident";
});

// === 빌트인 테스트 ===
console.log("\n--- 빌트인 함수 테스트 ---\n");

const interp = new Interpreter();

function run(code: string): unknown {
  interp.interpret(parse(lex(code)));
  return (interp as any).context.lastValue;
}

// 19. cf-scenario 빌트인
test("19. cf-scenario 빌트인", () => {
  const result = run(`(cf-scenario :id "s2" :name "테스트시나리오" :vars {:x 10 :y 20} :outcome "result-A")`);
  return result instanceof Map && (result as Map<string,any>).get("id") === "s2";
});

// 20. cf-what-if 빌트인 (인라인 fn)
test("20. cf-what-if 빌트인", () => {
  const result = run(`
    (cf-what-if {:x 10 :y 5} {:x 3}
      (fn [$vars] (if (>= (imm-get $vars :x) 10) "high" "low")))
  `);
  return result instanceof Map && (result as Map<string,any>).has("counterfactualOutcome");
});

// 21. cf-analyze 빌트인
test("21. cf-analyze 빌트인", () => {
  run(`(cf-scenario :id "s3" :name "분석테스트" :vars {:a 1 :b 2} :outcome "X")`);
  const result = run(`
    (cf-analyze "s3" [{:a 0} {:b 10}]
      (fn [$vars] (if (> (imm-get $vars :a) 0) "X" "Y")))
  `);
  return result instanceof Map && (result as Map<string,any>).has("counterfactuals");
});

// 22. cf-minimal 빌트인
test("22. cf-minimal 빌트인", () => {
  run(`(cf-scenario :id "s4" :name "최소개입" :vars {:rain true :speed 60} :outcome "accident")`);
  const result = run(`
    (cf-minimal "s4" "safe"
      (fn [$vars] (if (and (imm-get $vars :rain) (> (imm-get $vars :speed) 50)) "accident" "safe")))
  `);
  return result instanceof Map || result === null;
});

// 23. cf-sensitivity 빌트인
test("23. cf-sensitivity 빌트인", () => {
  const result = run(`
    (cf-sensitivity {:rain true :speed 60}
      (fn [$vars] (+ (* (if (imm-get $vars :rain) 1 0) 50) (imm-get $vars :speed))))
  `);
  return result instanceof Map && (result as Map<string,any>).has("speed");
});

// 24. cf-key-factors 빌트인
test("24. cf-key-factors 빌트인", () => {
  run(`(cf-scenario :id "s5" :name "키팩터" :vars {:p 1 :q 2} :outcome "A")`);
  const result = run(`
    (cf-key-factors
      (cf-analyze "s5" [{:p 0} {:q 10}]
        (fn [$vars] (if (> (imm-get $vars :p) 0) "A" "B"))))
  `);
  return Array.isArray(result);
});

// 25. cf-best-alt 빌트인
test("25. cf-best-alt 빌트인", () => {
  run(`(cf-scenario :id "s6" :name "최선대안" :vars {:m 5 :n 3} :outcome "OK")`);
  const result = run(`
    (cf-best-alt
      (cf-analyze "s6" [{:m 0} {:n 10}]
        (fn [$vars] (if (> (imm-get $vars :m) 3) "OK" "NG"))))
  `);
  return result instanceof Map && (result as Map<string,any>).has("probability");
});

// 26. cf-explain 빌트인
test("26. cf-explain 빌트인", () => {
  const result = run(`
    (cf-explain
      (cf-what-if {:rain true :speed 60} {:rain false}
        (fn [$vars] (if (imm-get $vars :rain) "accident" "safe"))))
  `);
  return typeof result === "string" && (result as string).length > 0;
});

// 27. 빈 개입 → 동일 결과
test("27. 빈 개입 whatIf → 동일 결과", () => {
  const wfEmpty = reasoner.whatIf(
    { rain: true, speed: 60 },
    {},
    accidentOutcome
  );
  return wfEmpty.counterfactualOutcome === "accident";
});

// 28. 여러 변수 동시 변경
test("28. 여러 변수 동시 변경", () => {
  const wfMulti = reasoner.whatIf(
    { rain: true, speed: 60, road: "wet" },
    { rain: false, speed: 30 },
    accidentOutcome
  );
  return wfMulti.counterfactualOutcome === "safe" &&
    Object.keys(wfMulti.intervention).length === 2;
});

// 결과 출력
console.log(`\n=== 결과: ${pass}/${pass + fail} PASS ===`);
if (fail > 0) {
  console.log(`❌ FAIL: ${fail}개`);
  process.exit(1);
} else {
  console.log("✅ 모두 통과!");
  process.exit(0);
}
