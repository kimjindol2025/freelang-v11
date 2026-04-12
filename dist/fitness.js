"use strict";
// FreeLang v9 Fitness — 적합도 함수 모음
// Phase 134: [FITNESS] AI가 솔루션의 품질을 평가하는 적합도 함수
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalFitness = exports.FitnessEvaluator = void 0;
exports.fitnessScore = fitnessScore;
exports.rankItems = rankItems;
// 레벤슈타인 거리 계산
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[m][n];
}
class FitnessEvaluator {
    constructor(config = {}) {
        this.config = {
            normalize: config.normalize !== false,
            maximize: config.maximize !== false,
            weights: config.weights ?? {},
        };
    }
    // 숫자 근접도 (목표값에 얼마나 가까운가)
    proximity(value, target, tolerance) {
        const diff = Math.abs(value - target);
        const tol = tolerance !== undefined ? tolerance : Math.abs(target) || 1;
        let rawScore;
        let score;
        if (tol === 0) {
            rawScore = diff === 0 ? 1 : 0;
            score = rawScore;
        }
        else {
            rawScore = Math.max(0, 1 - diff / tol);
            score = this.config.normalize !== false ? rawScore : rawScore;
        }
        if (this.config.maximize === false) {
            score = 1 - score;
        }
        return {
            score,
            rawScore,
            details: {
                diff,
                tolerance: tol,
                proximity: rawScore,
            },
        };
    }
    // 문자열 유사도 (레벤슈타인 거리 기반)
    stringSimilarity(a, b) {
        if (a.length === 0 && b.length === 0) {
            return { score: 1, rawScore: 1, details: { distance: 0, maxLen: 0 } };
        }
        const maxLen = Math.max(a.length, b.length);
        const dist = levenshtein(a, b);
        const rawScore = maxLen === 0 ? 1 : 1 - dist / maxLen;
        const score = this.config.maximize === false ? 1 - rawScore : rawScore;
        return {
            score,
            rawScore,
            details: {
                distance: dist,
                maxLen,
                similarity: rawScore,
            },
        };
    }
    // 배열 일치도
    arrayMatch(arr, target) {
        if (target.length === 0 && arr.length === 0) {
            return { score: 1, rawScore: 1, details: { matched: 0, total: 0 } };
        }
        const maxLen = Math.max(arr.length, target.length);
        let matched = 0;
        const minLen = Math.min(arr.length, target.length);
        for (let i = 0; i < minLen; i++) {
            if (JSON.stringify(arr[i]) === JSON.stringify(target[i]))
                matched++;
        }
        const rawScore = maxLen === 0 ? 1 : matched / maxLen;
        const score = this.config.maximize === false ? 1 - rawScore : rawScore;
        return {
            score,
            rawScore,
            details: {
                matched,
                total: maxLen,
                arrLen: arr.length,
                targetLen: target.length,
            },
        };
    }
    // 다목적 적합도 (여러 기준 가중합)
    multiObjective(values, targets, weights) {
        const keys = Object.keys(targets);
        if (keys.length === 0) {
            return { score: 1, rawScore: 1, details: {} };
        }
        const w = weights ?? this.config.weights ?? {};
        const details = {};
        let weightedSum = 0;
        let totalWeight = 0;
        for (const key of keys) {
            const val = values[key] ?? 0;
            const tgt = targets[key] ?? 0;
            const weight = w[key] ?? 1;
            const maxVal = Math.max(Math.abs(tgt), Math.abs(val), 1);
            const proximity = Math.max(0, 1 - Math.abs(val - tgt) / maxVal);
            details[key] = proximity;
            weightedSum += proximity * weight;
            totalWeight += weight;
        }
        const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const score = this.config.maximize === false ? 1 - rawScore : rawScore;
        return { score, rawScore, details };
    }
    // 제약 만족도 (모든 제약 충족 시 1.0)
    constraintSatisfaction(value, constraints) {
        if (constraints.length === 0) {
            return { score: 1, rawScore: 1, details: { satisfied: 0, total: 0 } };
        }
        let satisfied = 0;
        const details = {};
        for (let i = 0; i < constraints.length; i++) {
            const result = constraints[i](value) ? 1 : 0;
            details[`constraint_${i}`] = result;
            satisfied += result;
        }
        const rawScore = satisfied / constraints.length;
        const score = this.config.maximize === false ? 1 - rawScore : rawScore;
        return {
            score,
            rawScore,
            details: { ...details, satisfied, total: constraints.length },
        };
    }
    // 집합에서 랭킹
    rank(items, scorer) {
        const scored = items.map((item, idx) => ({ item, score: scorer(item), idx }));
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s, rankIdx) => ({
            ...s.item,
            rank: rankIdx + 1,
            score: s.score,
        }));
    }
    // 파레토 최적 (다목적 최적화)
    paretoFront(items, objectives) {
        if (items.length === 0)
            return [];
        const dominated = new Set();
        for (let i = 0; i < items.length; i++) {
            if (dominated.has(i))
                continue;
            for (let j = 0; j < items.length; j++) {
                if (i === j || dominated.has(j))
                    continue;
                // i가 j를 지배하는지 확인: 모든 목표에서 i >= j이고 적어도 하나에서 i > j
                const scores_i = objectives.map(f => f(items[i]));
                const scores_j = objectives.map(f => f(items[j]));
                const allGeq = scores_i.every((s, k) => s >= scores_j[k]);
                const someGt = scores_i.some((s, k) => s > scores_j[k]);
                if (allGeq && someGt) {
                    dominated.add(j);
                }
            }
        }
        return items.filter((_, i) => !dominated.has(i));
    }
}
exports.FitnessEvaluator = FitnessEvaluator;
exports.globalFitness = new FitnessEvaluator();
function fitnessScore(value, target) {
    return exports.globalFitness.proximity(value, target).score;
}
function rankItems(items, scores) {
    const paired = items.map((item, i) => ({ item, score: scores[i] ?? 0 }));
    paired.sort((a, b) => b.score - a.score);
    return paired.map((p, rankIdx) => ({ item: p.item, rank: rankIdx + 1, score: p.score }));
}
//# sourceMappingURL=fitness.js.map