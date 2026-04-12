"use strict";
// FreeLang v9 Critique — 자기 출력 비판 에이전트
// Phase 118: [CRITIQUE :output $x :find-weaknesses fn :find-counterexamples fn :severity fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCritique = exports.defaultFinders = exports.CritiqueAgent = void 0;
exports.severityWeight = severityWeight;
function severityWeight(s) {
    return { critical: 1.0, major: 0.7, minor: 0.3, suggestion: 0.1 }[s];
}
class CritiqueAgent {
    run(output, config) {
        const { finders, riskThreshold = 0.5 } = config;
        const points = finders.flatMap(f => {
            try {
                return f(output);
            }
            catch {
                return [];
            }
        });
        const totalRisk = points.length === 0 ? 0
            : points.reduce((s, p) => s + severityWeight(p.severity), 0) / (points.length * 1.0);
        const overallRisk = Math.min(1, totalRisk);
        const approved = overallRisk < riskThreshold && !points.some(p => p.severity === 'critical');
        const criticals = points.filter(p => p.severity === 'critical').length;
        const majors = points.filter(p => p.severity === 'major').length;
        const summary = points.length === 0
            ? '비판할 점 없음 — 통과'
            : `${points.length}개 문제 발견 (critical: ${criticals}, major: ${majors}), 위험도: ${(overallRisk * 100).toFixed(0)}%`;
        return { output, points, overallRisk, approved, summary };
    }
}
exports.CritiqueAgent = CritiqueAgent;
// 기본 비판 파인더들
exports.defaultFinders = [
    // 빈 출력
    (output) => {
        if (output === null || output === undefined || output === '') {
            return [{ type: 'missing', description: '출력이 비어있음', severity: 'critical' }];
        }
        return [];
    },
    // 너무 짧은 출력
    (output) => {
        if (typeof output === 'string' && output.length > 0 && output.length < 5) {
            return [{ type: 'weakness', description: '출력이 너무 짧음', severity: 'minor', suggestion: '더 구체적으로 서술' }];
        }
        return [];
    },
    // 에러 객체
    (output) => {
        if (output instanceof Error || (typeof output === 'object' && output !== null && output?._tag === 'Err')) {
            return [{ type: 'weakness', description: '에러 값이 출력됨', severity: 'major' }];
        }
        return [];
    },
];
exports.globalCritique = new CritiqueAgent();
//# sourceMappingURL=critique.js.map