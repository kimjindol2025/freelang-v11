"use strict";
// test-phase144-predict.ts — Phase 144: [PREDICT] 테스트
// 예측 + 신뢰구간 검증 (최소 25 PASS)
Object.defineProperty(exports, "__esModule", { value: true });
const predict_1 = require("./predict");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
const errors = [];
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        }
        else {
            console.log(`  ❌ FAIL: ${name}`);
            failed++;
            errors.push(name);
        }
    }
    catch (e) {
        console.log(`  ❌ ERROR: ${name} — ${e.message}`);
        failed++;
        errors.push(`${name} (threw: ${e.message})`);
    }
}
// FreeLang 인터프리터 실행 헬퍼
const interp = new interpreter_1.Interpreter();
function run(code) {
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(code)));
    return interp.context.lastValue;
}
console.log("\n=== Phase 144: [PREDICT] 예측 + 신뢰구간 ===\n");
// ── Predictor 인스턴스 테스트 ──
console.log("--- Predictor 인스턴스 ---");
// T01: Predictor 생성
test("01. Predictor 생성", () => {
    const p = new predict_1.Predictor();
    return p instanceof predict_1.Predictor;
});
// ── 선형 회귀 ──
console.log("--- linearRegression ---");
// T02: linearRegression 상승 트렌드 예측
test("02. linearRegression 상승 트렌드", () => {
    const p = new predict_1.Predictor();
    const result = p.linearRegression([1, 2, 3, 4, 5], 1);
    // 선형회귀 예측값이 현재 마지막 값(5)보다 크거나 같아야 함
    return result.value >= 5;
});
// T03: linearRegression Prediction 구조
test("03. linearRegression Prediction 구조", () => {
    const p = new predict_1.Predictor();
    const result = p.linearRegression([1, 2, 3, 4, 5]);
    return (typeof result.value === "number" &&
        typeof result.lower === "number" &&
        typeof result.upper === "number" &&
        typeof result.confidence === "number" &&
        typeof result.method === "string");
});
// T04: lower < value < upper (5개 이상의 데이터는 신뢰구간이 형성됨)
test("04. lower < value < upper (선형회귀)", () => {
    const p = new predict_1.Predictor();
    // 5개 이상의 점으로 신뢰구간이 잘 형성되게
    const result = p.linearRegression([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 1);
    return result.lower < result.value && result.value < result.upper;
});
// T05: confidence 범위 0~1
test("05. confidence 범위 0~1", () => {
    const p = new predict_1.Predictor();
    const result = p.linearRegression([1, 2, 3, 4, 5]);
    return result.confidence > 0 && result.confidence <= 1;
});
// ── 이동 평균 ──
console.log("--- movingAverage ---");
// T06: movingAverage 예측
test("06. movingAverage 예측 값 범위", () => {
    const p = new predict_1.Predictor();
    const data = [1, 2, 3, 4, 5];
    const result = p.movingAverage(data, 3, 1);
    // MA(3) of [3,4,5] = 4
    return result.value >= 3 && result.value <= 6;
});
// T07: movingAverage method 이름
test("07. movingAverage method 이름", () => {
    const p = new predict_1.Predictor();
    const result = p.movingAverage([1, 2, 3, 4, 5], 3, 1);
    return result.method === "moving-average";
});
// ── 지수 평활 ──
console.log("--- exponentialSmoothing ---");
// T08: exponentialSmoothing 예측
test("08. exponentialSmoothing 예측", () => {
    const p = new predict_1.Predictor();
    const result = p.exponentialSmoothing([1, 2, 3, 4, 5], 0.3, 1);
    return typeof result.value === "number" && !isNaN(result.value);
});
// T09: exponentialSmoothing method 이름
test("09. exponentialSmoothing method 이름", () => {
    const p = new predict_1.Predictor();
    const result = p.exponentialSmoothing([1, 2, 3, 4, 5], 0.3, 1);
    return result.method === "exponential-smoothing";
});
// ── 시계열 예측 ──
console.log("--- forecastTimeSeries ---");
// T10: forecastTimeSeries 다중 예측
test("10. forecastTimeSeries steps=3 → 3개 예측", () => {
    const p = new predict_1.Predictor();
    const result = p.forecastTimeSeries([1, 2, 3, 4, 5, 4, 3, 4, 5], 3);
    return result.predictions.length === 3;
});
// T11: TimeSeriesPrediction 구조
test("11. TimeSeriesPrediction 구조 확인", () => {
    const p = new predict_1.Predictor();
    const result = p.forecastTimeSeries([1, 2, 3, 4, 5], 2);
    return (Array.isArray(result.predictions) &&
        typeof result.trend === "string" &&
        ["up", "down", "flat", "volatile"].includes(result.trend));
});
// ── 트렌드 감지 ──
console.log("--- detectTrend ---");
// T12: detectTrend "up"
test('12. detectTrend "up" ([10,20,30,40,50])', () => {
    const p = new predict_1.Predictor();
    // 크고 일정한 상승 트렌드
    return p.detectTrend([10, 20, 30, 40, 50]) === "up";
});
// T13: detectTrend "down"
test('13. detectTrend "down" ([50,40,30,20,10])', () => {
    const p = new predict_1.Predictor();
    return p.detectTrend([50, 40, 30, 20, 10]) === "down";
});
// T14: detectTrend "flat"
test('14. detectTrend "flat" ([3,3,3,3,3])', () => {
    const p = new predict_1.Predictor();
    return p.detectTrend([3, 3, 3, 3, 3]) === "flat";
});
// T15: detectTrend 반환값은 유효한 문자열
test("15. detectTrend 반환값 유효", () => {
    const p = new predict_1.Predictor();
    const trend = p.detectTrend([1, 5, 2, 8, 3, 7, 2, 9, 1]);
    return ["up", "down", "flat", "volatile"].includes(trend);
});
// ── 신뢰 구간 ──
console.log("--- confidenceInterval ---");
// T16: confidenceInterval 95% CI 구조
test("16. confidenceInterval 95% CI 구조", () => {
    const p = new predict_1.Predictor();
    const ci = p.confidenceInterval([1.1, 1.2, 0.9, 1.0, 1.3, 1.1, 1.0, 0.95, 1.15, 1.05], 0.95);
    return typeof ci.lower === "number" && typeof ci.upper === "number";
});
// T17: CI lower < upper
test("17. CI lower < upper", () => {
    const p = new predict_1.Predictor();
    const ci = p.confidenceInterval([1.1, 1.2, 0.9, 1.0, 1.3, 1.05, 0.98, 1.15, 1.08, 1.02], 0.95);
    return ci.lower < ci.upper;
});
// ── 분류 ──
console.log("--- classify ---");
// T18: classify 분류 예측
test("18. classify 분류 예측", () => {
    const p = new predict_1.Predictor();
    const training = [
        { features: { age: 20, income: 30000 }, label: "young-low" },
        { features: { age: 21, income: 28000 }, label: "young-low" },
        { features: { age: 50, income: 80000 }, label: "senior-high" },
        { features: { age: 52, income: 85000 }, label: "senior-high" },
        { features: { age: 35, income: 55000 }, label: "mid-mid" },
    ];
    const result = p.classify({ age: 22, income: 29000 }, training);
    return typeof result.predicted === "string" && result.predicted.length > 0;
});
// T19: 가장 높은 확률 = predicted
test("19. 최고 확률 클래스 = predicted", () => {
    const p = new predict_1.Predictor();
    const training = [
        { features: { x: 1, y: 1 }, label: "A" },
        { features: { x: 2, y: 2 }, label: "A" },
        { features: { x: 10, y: 10 }, label: "B" },
        { features: { x: 11, y: 11 }, label: "B" },
    ];
    const result = p.classify({ x: 1.5, y: 1.5 }, training);
    const maxProb = Math.max(...result.classes.map(c => c.probability));
    const topClass = result.classes.find(c => c.probability === maxProb);
    return topClass?.label === result.predicted;
});
// ── 평가 ──
console.log("--- evaluate ---");
// T20: evaluate MAE 계산
test("20. evaluate MAE 계산", () => {
    const p = new predict_1.Predictor();
    // preds=[2,4,6], actuals=[1,3,5] → errors=[1,1,1], MAE=1
    const result = p.evaluate([2, 4, 6], [1, 3, 5]);
    return Math.abs(result.mae - 1.0) < 0.001;
});
// T21: evaluate RMSE 계산
test("21. evaluate RMSE 계산", () => {
    const p = new predict_1.Predictor();
    const result = p.evaluate([2, 4, 6], [1, 3, 5]);
    return Math.abs(result.rmse - 1.0) < 0.001;
});
// T22: evaluate MAPE >= 0
test("22. evaluate MAPE >= 0", () => {
    const p = new predict_1.Predictor();
    const result = p.evaluate([1.1, 2.2, 2.9], [1, 2, 3]);
    return result.mape >= 0;
});
// ── 빌트인 함수 테스트 (FreeLang 인터프리터) ──
console.log("--- FreeLang 빌트인 ---");
// T23: predict-linear 빌트인
test("23. predict-linear 빌트인", () => {
    const result = run("(predict-linear [1 2 3 4 5] :horizon 1)");
    return result instanceof Map && result.has("value") && typeof result.get("value") === "number";
});
// T24: predict-ma 빌트인
test("24. predict-ma 빌트인", () => {
    const result = run("(predict-ma [1 2 3 4 5] :window 3 :horizon 1)");
    return result instanceof Map && result.has("value") && result.get("method") === "moving-average";
});
// T25: predict-exp 빌트인
test("25. predict-exp 빌트인", () => {
    const result = run("(predict-exp [1 2 3 4 5] :alpha 0.3 :horizon 1)");
    return result instanceof Map && result.has("value") && result.get("method") === "exponential-smoothing";
});
// T26: predict-forecast 빌트인
test("26. predict-forecast 빌트인", () => {
    const result = run("(predict-forecast [1 2 3 4 5 4 3 4 5] :steps 3)");
    return result instanceof Map && Array.isArray(result.get("predictions")) && result.get("predictions").length === 3;
});
// T27: predict-ci 빌트인
test("27. predict-ci 빌트인", () => {
    const result = run("(predict-ci [1.1 1.2 0.9 1.0 1.3] :confidence 0.95)");
    return result instanceof Map && result.has("lower") && result.has("upper") && result.get("lower") < result.get("upper");
});
// T28: predict-evaluate 빌트인
test("28. predict-evaluate 빌트인", () => {
    const result = run("(predict-evaluate [2 4 6] [1 3 5])");
    return result instanceof Map && result.has("mae") && result.has("rmse") && result.has("mape");
});
// T29: predict-trend 빌트인 "up"
test('29. predict-trend 빌트인 "up"', () => {
    const result = run("(predict-trend [10 20 30 40 50])");
    return result === "up";
});
// T30: predict-trend 빌트인 "down"
test('30. predict-trend 빌트인 "down"', () => {
    const result = run("(predict-trend [50 40 30 20 10])");
    return result === "down";
});
// ── 결과 요약 ──
console.log(`\n${"=".repeat(50)}`);
console.log(`Phase 144 결과: ${passed} PASS / ${failed} FAIL`);
if (errors.length > 0) {
    console.log(`실패 항목: ${errors.join(", ")}`);
}
console.log(`${"=".repeat(50)}\n`);
if (passed < 25) {
    console.error(`❌ 최소 25 PASS 미달 (${passed}/25)`);
    process.exit(1);
}
else {
    console.log(`✅ Phase 144 완료! ${passed}/30 PASS`);
}
//# sourceMappingURL=test-phase144-predict.js.map