"use strict";
// FreeLang v9 Hypothesis — 가설 검증 시스템
// Phase 111: [HYPOTHESIS] 가설 설정 + 검증 + 채택/기각 블록
// [HYPOTHESIS :claim "..." :test fn :evidence fn :conclude fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalTester = exports.HypothesisTester = void 0;
class HypothesisTester {
    test(config) {
        const { claim, test, evaluate, maxAttempts = 3, threshold = 0.7, conclude = (c) => c >= threshold ? 'accepted' : c <= (1 - threshold) ? 'rejected' : 'inconclusive' } = config;
        const evidence = [];
        let confidence = 0;
        let iterations = 0;
        for (let i = 0; i < maxAttempts; i++) {
            iterations++;
            const result = test(i);
            evidence.push(result);
            confidence = evaluate(evidence);
            // 조기 종료: 이미 명확하면
            if (confidence >= threshold || confidence <= 1 - threshold)
                break;
        }
        const verdict = conclude(confidence);
        const reasoning = `${iterations}회 테스트, 신뢰도 ${(confidence * 100).toFixed(0)}% → ${verdict}`;
        return { claim, verdict, confidence, evidence, reasoning, iterations };
    }
    // 여러 가설 중 가장 신뢰도 높은 것 선택
    compete(hypotheses) {
        const results = hypotheses.map(h => this.test(h));
        return results.reduce((best, curr) => curr.confidence > best.confidence ? curr : best);
    }
}
exports.HypothesisTester = HypothesisTester;
exports.globalTester = new HypothesisTester();
//# sourceMappingURL=hypothesis.js.map