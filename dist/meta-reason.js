"use strict";
// FreeLang v9 Meta-Reason — 추론 방법 자동 선택
// Phase 115: [META-REASON :problem "..." :strategies [...] :select fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalMetaReasoner = exports.MetaReasoner = void 0;
const ALL_STRATEGIES = ['COT', 'TOT', 'HYPOTHESIS', 'DEBATE', 'REFLECT', 'DIRECT'];
// 문제 특성 분석 → 전략 점수
function scoreStrategy(problem, strategy) {
    const p = problem.toLowerCase();
    let score = 0.5;
    let reason = '';
    switch (strategy) {
        case 'COT':
            // 단계가 명확한 문제에 적합
            score = (p.includes('step') || p.includes('단계') || p.includes('순서') || p.includes('how')) ? 0.9 : 0.5;
            reason = '순차적 단계 추론';
            break;
        case 'TOT':
            // 여러 경우의 수가 있는 문제
            score = (p.includes('option') || p.includes('방법') || p.includes('compare') || p.includes('which')) ? 0.9 : 0.4;
            reason = '분기 탐색 필요';
            break;
        case 'HYPOTHESIS':
            // 검증이 필요한 주장
            score = (p.includes('verify') || p.includes('맞') || p.includes('correct') || p.includes('true')) ? 0.85 : 0.4;
            reason = '가설 검증 필요';
            break;
        case 'DEBATE':
            // 찬반이 있는 결정
            score = (p.includes('should') || p.includes('better') || p.includes('vs') || p.includes('결정')) ? 0.85 : 0.35;
            reason = '찬반 구조 분석';
            break;
        case 'REFLECT':
            // 품질 평가가 필요한 경우
            score = (p.includes('quality') || p.includes('improve') || p.includes('review') || p.includes('평가')) ? 0.8 : 0.4;
            reason = '자기 평가 필요';
            break;
        case 'DIRECT':
            // 단순한 경우
            score = p.length < 30 ? 0.8 : 0.3;
            reason = '단순 직접 응답';
            break;
    }
    // 점수 범위 0~1 보장
    score = Math.max(0, Math.min(1, score));
    return { strategy, score, reason };
}
class MetaReasoner {
    constructor(strategies = [...ALL_STRATEGIES]) {
        this.strategies = strategies;
    }
    analyze(problem) {
        const scores = this.strategies.map(s => scoreStrategy(problem, s));
        scores.sort((a, b) => b.score - a.score);
        const selected = scores[0].strategy;
        const rationale = `"${problem.slice(0, 50)}" → ${selected} 선택 (점수: ${scores[0].score.toFixed(2)}, 이유: ${scores[0].reason})`;
        return { problem, selected, scores, rationale };
    }
    // 커스텀 전략 추가
    addStrategy(strategy) {
        if (!this.strategies.includes(strategy))
            this.strategies.push(strategy);
    }
    getStrategies() {
        return [...this.strategies];
    }
}
exports.MetaReasoner = MetaReasoner;
exports.globalMetaReasoner = new MetaReasoner();
//# sourceMappingURL=meta-reason.js.map