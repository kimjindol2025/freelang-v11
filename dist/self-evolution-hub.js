"use strict";
// self-evolution-hub.ts — FreeLang v9 Phase 140: 자기 진화 통합 허브
// Phase 131-139의 모든 자기 진화 기능을 통합하는 마스터 허브
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSelfEvolution = exports.SelfEvolutionHub = exports.DEFAULT_CYCLE_CONFIG = void 0;
const mutate_1 = require("./mutate");
const crossover_1 = require("./crossover");
const fitness_1 = require("./fitness");
const generation_1 = require("./generation");
const prune_1 = require("./prune");
const refactor_self_1 = require("./refactor-self");
const benchmark_self_1 = require("./benchmark-self");
const version_self_1 = require("./version-self");
const crypto_1 = require("crypto");
exports.DEFAULT_CYCLE_CONFIG = {
    target: null,
    populationSize: 20,
    generations: 30,
    mutationRate: 0.1,
    eliteRatio: 0.1,
    pruneThreshold: 0.2,
    enableVersioning: false,
    enableBenchmark: false,
    enableRefactor: false,
};
// ── SelfEvolutionHub ──────────────────────────────────────────────────────────
class SelfEvolutionHub {
    constructor() {
        // 내부 통계
        this._cycleCount = 0;
        this._totalGenerations = 0;
        this._refactorSuggestions = 0;
        this._versionCount = 0;
        this._fitnessHistory = [];
        this.fitnessEval = new fitness_1.FitnessEvaluator({ normalize: true, maximize: true });
        this.pruner = new prune_1.Pruner();
        this.refactorer = new refactor_self_1.SelfRefactorer();
        this.benchmark = new benchmark_self_1.SelfBenchmark("self-evolution-hub");
        this.versioning = new version_self_1.SelfVersioning(200);
    }
    // ── 완전한 진화 사이클 실행 ────────────────────────────────────────────────
    runCycle(population, fitnessFunc, mutateFunc, crossoverFunc, config) {
        const cfg = { ...exports.DEFAULT_CYCLE_CONFIG, ...config };
        const startMs = Date.now();
        // 빈 population 처리
        if (!population || population.length === 0) {
            return this._emptyResult(cfg);
        }
        const pop = [...population];
        let bestFitness = -Infinity;
        let best = pop[0];
        let improvements = 0;
        let prunedCount = 0;
        const fitnessProgress = [];
        let gens = 0;
        const mutator = new mutate_1.Mutator({ rate: cfg.mutationRate });
        const crossover = new crossover_1.Crossover();
        const genLoop = new generation_1.GenerationLoop({ maxGenerations: cfg.generations });
        // 세대별 진화 루프
        for (let g = 0; g < cfg.generations; g++) {
            gens++;
            // 각 개체의 적합도 계산
            const scored = pop.map(item => ({
                item,
                fitness: fitnessFunc(item),
            }));
            scored.sort((a, b) => b.fitness - a.fitness);
            const genBest = scored[0].fitness;
            fitnessProgress.push(genBest);
            if (genBest > bestFitness) {
                bestFitness = genBest;
                best = scored[0].item;
                improvements++;
            }
            // 가지치기
            const pruneCount = Math.floor(pop.length * cfg.pruneThreshold);
            if (pruneCount > 0) {
                prunedCount += pruneCount;
                // 하위 pruneCount개 제거 후 채우기
                const kept = scored.slice(0, pop.length - pruneCount).map(s => s.item);
                pop.length = 0;
                pop.push(...kept);
            }
            // 새 개체 생성 (교배 + 변이)
            while (pop.length < cfg.populationSize) {
                const a = pop[Math.floor(Math.random() * pop.length)];
                const b = pop[Math.floor(Math.random() * pop.length)];
                const child = crossoverFunc(a, b);
                const mutated = mutateFunc(child);
                pop.push(mutated);
            }
        }
        this._cycleCount++;
        this._totalGenerations += gens;
        this._fitnessHistory.push(...fitnessProgress);
        // 벤치마크
        let benchmarkMs;
        if (cfg.enableBenchmark) {
            benchmarkMs = Date.now() - startMs;
        }
        // 버전 관리
        let versionId;
        if (cfg.enableVersioning) {
            try {
                const snap = this.versioning.snapshot(best, `evolution-cycle-${this._cycleCount}`, ["auto-evolved"], bestFitness);
                versionId = snap.id;
                this._versionCount++;
            }
            catch {
                versionId = (0, crypto_1.randomUUID)();
                this._versionCount++;
            }
        }
        // 리팩토링 제안
        let refactorCount = 0;
        if (cfg.enableRefactor) {
            try {
                const suggestions = this.refactorer.suggest(String(best));
                refactorCount = suggestions.length;
                this._refactorSuggestions += refactorCount;
            }
            catch {
                refactorCount = 0;
            }
        }
        const report = this._buildReport({
            bestFitness,
            generations: gens,
            improvements,
            prunedCount,
            benchmarkMs,
            versionId,
            refactorCount,
        });
        return {
            best,
            bestFitness,
            generations: gens,
            improvements,
            prunedCount,
            benchmarkMs,
            versionId,
            report,
        };
    }
    // ── 숫자 배열 자동 진화 (올인원) ────────────────────────────────────────────
    evolveNumbers(target, config) {
        const cfg = { ...exports.DEFAULT_CYCLE_CONFIG, target, ...config };
        const popSize = cfg.populationSize;
        const len = target.length;
        // 초기 population 생성 (랜덤 배열)
        const initPop = Array.from({ length: popSize }, () => Array.from({ length: len }, () => Math.random() * 10));
        // 적합도: 목표 배열에 가까울수록 높음
        const fitnessFunc = (item) => {
            const arr = item;
            if (!Array.isArray(arr))
                return 0;
            const dist = target.reduce((sum, t, i) => sum + Math.abs(t - (arr[i] ?? 0)), 0);
            return 1 / (1 + dist);
        };
        // 변이: 랜덤 인덱스 값 조정
        const mutateFunc = (item) => {
            const arr = [...item];
            const idx = Math.floor(Math.random() * arr.length);
            arr[idx] += (Math.random() - 0.5) * cfg.mutationRate * 2;
            return arr;
        };
        // 교배: 단순 단일점 교배
        const crossoverFunc = (a, b) => {
            const arrA = a;
            const arrB = b;
            const point = Math.floor(Math.random() * arrA.length);
            return [...arrA.slice(0, point), ...arrB.slice(point)];
        };
        return this.runCycle(initPop, fitnessFunc, mutateFunc, crossoverFunc, cfg);
    }
    // ── 문자열 자동 진화 ────────────────────────────────────────────────────────
    evolveString(target, config) {
        const cfg = { ...exports.DEFAULT_CYCLE_CONFIG, target, ...config };
        const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
        const len = target.length;
        const popSize = cfg.populationSize;
        // 초기 population
        const initPop = Array.from({ length: popSize }, () => Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(""));
        // 적합도: 목표 문자열과 같은 문자 비율
        const fitnessFunc = (item) => {
            const s = String(item);
            if (s.length !== target.length)
                return 0;
            let matches = 0;
            for (let i = 0; i < target.length; i++) {
                if (s[i] === target[i])
                    matches++;
            }
            return matches / target.length;
        };
        // 변이: 랜덤 문자 교체
        const mutateFunc = (item) => {
            const chars = String(item).split("");
            for (let i = 0; i < chars.length; i++) {
                if (Math.random() < cfg.mutationRate) {
                    chars[i] = CHARS[Math.floor(Math.random() * CHARS.length)];
                }
            }
            return chars.join("");
        };
        // 교배: 단일점
        const crossoverFunc = (a, b) => {
            const sa = String(a);
            const sb = String(b);
            const point = Math.floor(Math.random() * sa.length);
            return sa.slice(0, point) + sb.slice(point);
        };
        return this.runCycle(initPop, fitnessFunc, mutateFunc, crossoverFunc, cfg);
    }
    // ── 리포트 생성 ────────────────────────────────────────────────────────────
    generateReport(results) {
        const cycles = results.length;
        const totalGenerations = results.reduce((sum, r) => sum + r.generations, 0);
        const fitnessProgress = results.map(r => r.bestFitness);
        const refactorSuggestions = this._refactorSuggestions;
        const versions = this._versionCount;
        const avgFitness = fitnessProgress.length > 0
            ? fitnessProgress.reduce((a, b) => a + b, 0) / fitnessProgress.length
            : 0;
        const maxFitness = fitnessProgress.length > 0 ? Math.max(...fitnessProgress) : 0;
        const summary = [
            `[SelfEvolutionHub] ${cycles}개 사이클, ${totalGenerations}세대 실행`,
            `최고 적합도: ${maxFitness.toFixed(4)}, 평균: ${avgFitness.toFixed(4)}`,
            `리팩토링 제안: ${refactorSuggestions}개, 버전: ${versions}개`,
        ].join(" | ");
        return {
            timestamp: new Date(),
            cycles,
            totalGenerations,
            fitnessProgress,
            refactorSuggestions,
            versions,
            summary,
        };
    }
    // ── 자기 개선 ──────────────────────────────────────────────────────────────
    selfImprove(baseConfig) {
        const base = { ...exports.DEFAULT_CYCLE_CONFIG, ...baseConfig };
        // 여러 설정 후보로 테스트
        const candidates = [
            { ...base },
            { ...base, mutationRate: Math.min(0.5, base.mutationRate * 1.5) },
            { ...base, mutationRate: Math.max(0.01, base.mutationRate * 0.7) },
            { ...base, populationSize: Math.min(100, base.populationSize * 2) },
            { ...base, eliteRatio: Math.min(0.5, base.eliteRatio * 1.5) },
            { ...base, pruneThreshold: Math.max(0.05, base.pruneThreshold * 0.8) },
        ];
        let bestConfig = base;
        let baseScore = 0;
        let bestScore = 0;
        // 간단한 테스트: 고정 타겟으로 적합도 비교
        const testTarget = [1, 2, 3, 4, 5];
        candidates.forEach((cfg, idx) => {
            const result = this.evolveNumbers(testTarget, { ...cfg, generations: 10 });
            if (idx === 0) {
                baseScore = result.bestFitness;
                bestScore = baseScore;
                bestConfig = cfg;
            }
            else if (result.bestFitness > bestScore) {
                bestScore = result.bestFitness;
                bestConfig = cfg;
            }
        });
        const improvement = baseScore > 0 ? (bestScore - baseScore) / baseScore : 0;
        return {
            optimized: bestConfig,
            improvement: Math.max(0, improvement),
        };
    }
    // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────
    _emptyResult(cfg) {
        return {
            best: null,
            bestFitness: 0,
            generations: 0,
            improvements: 0,
            prunedCount: 0,
            report: "[SelfEvolutionHub] 빈 population — 진화 없음",
        };
    }
    _buildReport(info) {
        const parts = [
            `[SelfEvolutionHub] 최고 적합도=${info.bestFitness.toFixed(4)}`,
            `세대=${info.generations}`,
            `개선=${info.improvements}`,
            `가지치기=${info.prunedCount}`,
        ];
        if (info.benchmarkMs !== undefined)
            parts.push(`실행시간=${info.benchmarkMs}ms`);
        if (info.versionId)
            parts.push(`버전ID=${info.versionId.slice(0, 8)}...`);
        if (info.refactorCount !== undefined && info.refactorCount > 0) {
            parts.push(`리팩토링제안=${info.refactorCount}개`);
        }
        return parts.join(", ");
    }
    // ── 통계 접근자 ────────────────────────────────────────────────────────────
    get cycleCount() { return this._cycleCount; }
    get totalGenerations() { return this._totalGenerations; }
    get refactorSuggestions() { return this._refactorSuggestions; }
    get versionCount() { return this._versionCount; }
    get fitnessHistory() { return [...this._fitnessHistory]; }
}
exports.SelfEvolutionHub = SelfEvolutionHub;
// ── 싱글톤 ────────────────────────────────────────────────────────────────────
exports.globalSelfEvolution = new SelfEvolutionHub();
//# sourceMappingURL=self-evolution-hub.js.map