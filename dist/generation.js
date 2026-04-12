"use strict";
// FreeLang v9 Generation — 세대별 진화 루프
// Phase 135: [GENERATION] 세대 단위로 진화를 관리하는 루프 시스템
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationLoop = void 0;
exports.runGeneration = runGeneration;
class GenerationLoop {
    constructor(config) {
        this.statsHistory = [];
        this.stagnationCount = 0;
        this.currentStats = null;
        this.config = {
            maxGenerations: config.maxGenerations,
            targetFitness: config.targetFitness,
            stagnationLimit: config.stagnationLimit ?? 10,
            logInterval: config.logInterval ?? 10,
            onGeneration: config.onGeneration,
        };
    }
    // 세대 루프 실행
    run(initialPopulation, fitnessFunc, nextGenFunc) {
        // 초기화
        this.statsHistory = [];
        this.stagnationCount = 0;
        this.currentStats = null;
        let population = [...initialPopulation];
        let fitnesses = population.map(fitnessFunc);
        let bestItem = population[0];
        let bestFitness = fitnesses[0] ?? -Infinity;
        // 초기 best 탐색
        for (let i = 0; i < population.length; i++) {
            if (fitnesses[i] > bestFitness) {
                bestFitness = fitnesses[i];
                bestItem = population[i];
            }
        }
        const initialBest = bestFitness;
        let previousBest = -Infinity;
        let terminationReason = 'max-generations';
        for (let gen = 0; gen < this.config.maxGenerations; gen++) {
            // 현재 세대 통계 계산
            const stats = this._computeStats(gen, fitnesses, previousBest);
            this.statsHistory.push(stats);
            this.currentStats = stats;
            // 현재 best 업데이트
            for (let i = 0; i < population.length; i++) {
                if (fitnesses[i] > bestFitness) {
                    bestFitness = fitnesses[i];
                    bestItem = population[i];
                }
            }
            // 콜백
            if (this.config.onGeneration) {
                this.config.onGeneration(stats);
            }
            // 조기 종료: 목표 달성
            if (this.config.targetFitness !== undefined && bestFitness >= this.config.targetFitness) {
                terminationReason = 'target-reached';
                break;
            }
            // 정체 카운트 업데이트
            if (stats.improved) {
                this.stagnationCount = 0;
            }
            else {
                this.stagnationCount++;
            }
            // 조기 종료: 정체
            const stagnationLimit = this.config.stagnationLimit ?? 10;
            if (this.stagnationCount >= stagnationLimit) {
                terminationReason = 'stagnation';
                break;
            }
            previousBest = stats.best;
            // 다음 세대 생성 (마지막 세대는 생략)
            if (gen < this.config.maxGenerations - 1) {
                population = nextGenFunc(population, fitnesses);
                fitnesses = population.map(fitnessFunc);
            }
        }
        // 개선률 계산
        const improvementRatio = initialBest === 0
            ? (bestFitness - initialBest)
            : Math.abs((bestFitness - initialBest) / Math.abs(initialBest === 0 ? 1 : initialBest));
        return {
            best: bestItem,
            bestFitness,
            totalGenerations: this.statsHistory.length,
            history: [...this.statsHistory],
            terminationReason,
            improvementRatio,
        };
    }
    // 현재 통계
    getCurrentStats() {
        return this.currentStats;
    }
    // 전체 히스토리
    getHistory() {
        return [...this.statsHistory];
    }
    // 다양성 계산 (숫자 배열 기준)
    calculateDiversity(fitnesses) {
        if (fitnesses.length <= 1)
            return 0;
        const min = Math.min(...fitnesses);
        const max = Math.max(...fitnesses);
        const range = max - min;
        if (range === 0)
            return 0;
        // 표준편차 기반 다양성 (0~1 정규화)
        const mean = fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length;
        const variance = fitnesses.reduce((s, v) => s + (v - mean) ** 2, 0) / fitnesses.length;
        const stdDev = Math.sqrt(variance);
        // range 대비 stdDev 비율 (0~1)
        const diversity = Math.min(1, stdDev / (range + 1e-9));
        return diversity;
    }
    // 진화 수렴 여부 (마지막 5세대 best가 변화 없으면 수렴)
    hasConverged() {
        if (this.statsHistory.length < 5)
            return false;
        const recent = this.statsHistory.slice(-5);
        const firstBest = recent[0].best;
        return recent.every(s => Math.abs(s.best - firstBest) < 1e-9);
    }
    // 내부: 세대 통계 계산
    _computeStats(gen, fitnesses, previousBest) {
        if (fitnesses.length === 0) {
            return { generation: gen, best: 0, worst: 0, average: 0, diversity: 0, elites: 0, improved: false };
        }
        const best = Math.max(...fitnesses);
        const worst = Math.min(...fitnesses);
        const average = fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length;
        const diversity = this.calculateDiversity(fitnesses);
        const elites = Math.max(1, Math.floor(fitnesses.length * 0.1));
        const improved = gen === 0 ? true : best > previousBest;
        return { generation: gen, best, worst, average, diversity, elites, improved };
    }
}
exports.GenerationLoop = GenerationLoop;
// 편의 함수: 간단한 세대 루프
function runGeneration(population, fitness, next, maxGen = 50) {
    const loop = new GenerationLoop({ maxGenerations: maxGen });
    return loop.run(population, fitness, next);
}
//# sourceMappingURL=generation.js.map