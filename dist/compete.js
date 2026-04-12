"use strict";
// FreeLang v9 Compete — 에이전트 경쟁으로 최선 선택
// Phase 129: [COMPETE] 여러 경쟁자(에이전트)가 같은 문제를 풀고 점수로 최선 선택
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCompetition = exports.Competition = void 0;
class Competition {
    constructor() {
        this.competitors = new Map();
    }
    register(competitor) {
        this.competitors.set(competitor.id, competitor);
    }
    run(problem, evaluate) {
        const results = [];
        for (const competitor of this.competitors.values()) {
            try {
                const output = competitor.solve(problem);
                results.push({ agentId: competitor.id, output, score: evaluate(output) });
            }
            catch {
                results.push({ agentId: competitor.id, output: null, score: -Infinity });
            }
        }
        results.sort((a, b) => b.score - a.score);
        const ranked = results.map((r, i) => ({ ...r, rank: i + 1 }));
        const margin = ranked.length >= 2
            ? ranked[0].score - ranked[1].score
            : ranked[0]?.score ?? 0;
        return { winner: ranked[0], allResults: ranked, margin };
    }
    // 토너먼트: 1:1 매치로 최종 우승자 (단순화: 전체 점수 기반)
    tournament(problem, evaluate) {
        return this.run(problem, evaluate);
    }
    list() { return [...this.competitors.keys()]; }
    size() { return this.competitors.size; }
}
exports.Competition = Competition;
exports.globalCompetition = new Competition();
//# sourceMappingURL=compete.js.map