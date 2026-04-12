"use strict";
// consensus.ts — FreeLang v9 Phase 121: CONSENSUS 여러 에이전트 합의
// 다수결/가중평균/임계값/만장일치 방식으로 에이전트 합의 도달
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalConsensus = exports.ConsensusEngine = void 0;
class ConsensusEngine {
    // 다수결 (가장 많이 나온 답)
    majority(votes) {
        if (!votes || votes.length === 0) {
            throw new Error("votes가 비어있음");
        }
        const counts = new Map();
        for (const v of votes) {
            const key = JSON.stringify(v.answer);
            const existing = counts.get(key) ?? { answer: v.answer, count: 0, totalConf: 0 };
            existing.count++;
            existing.totalConf += v.confidence;
            counts.set(key, existing);
        }
        const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
        const winner = sorted[0];
        const agreement = winner.count / votes.length;
        const winnerKey = JSON.stringify(winner.answer);
        return {
            answer: winner.answer,
            strategy: 'majority',
            agreement,
            votes,
            dissent: votes.filter(v => JSON.stringify(v.answer) !== winnerKey),
        };
    }
    // 가중 평균 (숫자형 답에 적합)
    weighted(votes) {
        if (!votes || votes.length === 0) {
            throw new Error("votes가 비어있음");
        }
        const totalWeight = votes.reduce((s, v) => s + v.confidence, 0);
        const answer = votes.reduce((s, v) => s + v.answer * v.confidence, 0) / totalWeight;
        const vals = votes.map(v => v.answer);
        const range = Math.max(...vals) - Math.min(...vals);
        const variance = votes.reduce((s, v) => s + Math.abs(v.answer - answer) * v.confidence, 0) / totalWeight;
        const agreement = Math.max(0, 1 - variance / (range + 1));
        return { answer, strategy: 'weighted', agreement, votes, dissent: [] };
    }
    // 임계값 (confidence 평균이 threshold 이상인 답)
    threshold(votes, threshold = 0.7) {
        if (!votes || votes.length === 0)
            return null;
        const groups = new Map();
        for (const v of votes) {
            const key = JSON.stringify(v.answer);
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(v);
        }
        for (const [key, group] of groups) {
            const avgConf = group.reduce((s, v) => s + v.confidence, 0) / group.length;
            if (avgConf >= threshold) {
                return {
                    answer: group[0].answer,
                    strategy: 'threshold',
                    agreement: avgConf,
                    votes,
                    dissent: votes.filter(v => JSON.stringify(v.answer) !== key),
                };
            }
        }
        return null;
    }
    // 만장일치
    unanimous(votes) {
        if (!votes || votes.length === 0)
            return null;
        const first = JSON.stringify(votes[0].answer);
        if (votes.every(v => JSON.stringify(v.answer) === first)) {
            return {
                answer: votes[0].answer,
                strategy: 'unanimous',
                agreement: 1.0,
                votes,
                dissent: [],
            };
        }
        return null;
    }
    // agreement 계산 (majority 기준)
    agreement(votes) {
        if (!votes || votes.length === 0)
            return 0;
        const result = this.majority(votes);
        return result.agreement;
    }
}
exports.ConsensusEngine = ConsensusEngine;
exports.globalConsensus = new ConsensusEngine();
//# sourceMappingURL=consensus.js.map