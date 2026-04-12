"use strict";
// FreeLang v9 Prune — 쓸모없는 것 자동 제거
// Phase 136: [PRUNE] AI가 저품질/불필요한 항목을 자동 제거한다
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalPruner = exports.Pruner = void 0;
exports.keepBest = keepBest;
exports.removeWeak = removeWeak;
function average(nums) {
    if (nums.length === 0)
        return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function buildResult(kept, removed, scorer, strategy, originalCount) {
    const keptFitness = scorer ? kept.map(scorer).filter((n) => n !== null) : [];
    const removedFitness = scorer ? removed.map(scorer).filter((n) => n !== null) : [];
    const total = kept.length + removed.length;
    return {
        kept,
        removed,
        keptRatio: total === 0 ? 1 : kept.length / total,
        strategy,
        stats: {
            originalCount,
            keptCount: kept.length,
            removedCount: removed.length,
            avgFitnessKept: average(keptFitness),
            avgFitnessRemoved: average(removedFitness),
        },
    };
}
class Pruner {
    constructor(config) {
        this.config = config ?? {};
    }
    // 임계값 기반 제거: score < threshold 이면 제거
    pruneByThreshold(items, scorer, threshold) {
        const original = [...items];
        const kept = [];
        const removed = [];
        for (const item of original) {
            if (scorer(item) >= threshold)
                kept.push(item);
            else
                removed.push(item);
        }
        return buildResult(kept, removed, scorer, 'threshold', original.length);
    }
    // 상위 K개만 유지
    pruneToTopK(items, scorer, k) {
        const original = [...items];
        const sorted = [...original].sort((a, b) => scorer(b) - scorer(a));
        const effectiveK = Math.min(k, original.length);
        const kept = sorted.slice(0, effectiveK);
        const keptSet = new Set(kept);
        const removed = original.filter(item => !keptSet.has(item));
        return buildResult(kept, removed, scorer, 'top-k', original.length);
    }
    // 상위 N% 유지 (최소 1개)
    pruneToTopPercent(items, scorer, percent) {
        const original = [...items];
        const k = Math.max(1, Math.ceil(original.length * percent));
        return this.pruneToTopK(original, scorer, k);
    }
    // 다양성 기반 제거 (너무 유사한 것 제거)
    pruneForDiversity(items, scorer, similarity, minDiversity) {
        const original = [...items];
        if (original.length === 0) {
            return buildResult([], [], scorer, 'diversity', 0);
        }
        // 점수 내림차순 정렬
        const sorted = [...original].sort((a, b) => scorer(b) - scorer(a));
        const kept = [];
        for (const candidate of sorted) {
            // 이미 kept에 있는 항목들과 너무 유사하면 제거
            const tooSimilar = kept.some(existing => similarity(candidate, existing) > (1 - minDiversity));
            if (!tooSimilar) {
                kept.push(candidate);
            }
        }
        const keptSet = new Set(kept);
        const removed = original.filter(item => !keptSet.has(item));
        return buildResult(kept, removed, scorer, 'diversity', original.length);
    }
    // 중복 제거 (정확히 같은 것)
    dedup(items, key) {
        const original = [...items];
        const seen = new Set();
        const kept = [];
        const removed = [];
        for (const item of original) {
            const k = key ? key(item) : JSON.stringify(item);
            if (!seen.has(k)) {
                seen.add(k);
                kept.push(item);
            }
            else {
                removed.push(item);
            }
        }
        // dedup은 scorer가 없으므로 null scorer 사용
        return buildResult(kept, removed, () => 0, 'threshold', original.length);
    }
    // 약한 개체 제거 (평균 이하)
    pruneWeak(items, scorer) {
        const original = [...items];
        if (original.length === 0) {
            return buildResult([], [], scorer, 'threshold', 0);
        }
        const scores = original.map(scorer);
        const avg = average(scores);
        const kept = [];
        const removed = [];
        for (let i = 0; i < original.length; i++) {
            if (scores[i] >= avg)
                kept.push(original[i]);
            else
                removed.push(original[i]);
        }
        return buildResult(kept, removed, scorer, 'threshold', original.length);
    }
    // 자동 전략 적용 (설정된 전략 사용, 기본값 top-k with k=10)
    prune(items, scorer) {
        const strategy = this.config.strategy ?? 'top-k';
        switch (strategy) {
            case 'threshold':
                return this.pruneByThreshold(items, scorer, this.config.threshold ?? 0.5);
            case 'top-k':
                return this.pruneToTopK(items, scorer, this.config.k ?? 10);
            case 'top-percent':
                return this.pruneToTopPercent(items, scorer, this.config.percent ?? 0.5);
            case 'diversity':
                return this.pruneForDiversity(items, scorer, (a, b) => (a === b ? 1 : 0), this.config.minDiversity ?? 0.2);
            default:
                return this.pruneWeak(items, scorer);
        }
    }
}
exports.Pruner = Pruner;
exports.globalPruner = new Pruner();
function keepBest(items, scorer, k) {
    const sorted = [...items].sort((a, b) => scorer(b) - scorer(a));
    return sorted.slice(0, Math.min(k, items.length));
}
function removeWeak(items, scorer) {
    const scores = items.map(scorer);
    const avg = average(scores);
    return items.filter((_, i) => scores[i] >= avg);
}
//# sourceMappingURL=prune.js.map