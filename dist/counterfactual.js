"use strict";
// counterfactual.ts — FreeLang v9 Phase 143: [COUNTERFACTUAL]
// "만약 X가 달랐다면 Y는 어떻게 됐을까?" 반사실 추론 시스템
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCounterfactual = exports.CounterfactualReasoner = void 0;
let _cfIdCounter = 0;
function genCfId() {
    return `cf-${++_cfIdCounter}-${Date.now()}`;
}
/**
 * 두 값의 변화량 계산
 */
function computeDelta(before, after) {
    if (typeof before === 'number' && typeof after === 'number') {
        return after - before;
    }
    if (typeof before === 'boolean' && typeof after === 'boolean') {
        return before !== after ? `${before} → ${after}` : 'unchanged';
    }
    if (before === after)
        return 'unchanged';
    return `${String(before)} → ${String(after)}`;
}
/**
 * 두 결과 간 차이로 probability 추정
 * 개입 변수 수가 적을수록, 결과 차이가 적을수록 확률 높음
 */
function estimateProbability(interventionCount, outcomeChanged, totalVarCount) {
    const interventionRatio = interventionCount / Math.max(totalVarCount, 1);
    const base = 1 - interventionRatio * 0.5;
    const outcomeBonus = outcomeChanged ? 0 : 0.1;
    return Math.max(0, Math.min(1, base + outcomeBonus));
}
/**
 * 반사실 설명 생성
 */
function generateExplanation(baseScenario, intervention, originalOutcome, counterfactualOutcome) {
    const changes = Object.entries(intervention)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(', ');
    const changed = originalOutcome !== counterfactualOutcome;
    if (changed) {
        return `만약 ${changes}이었다면, 결과는 "${String(originalOutcome)}" 대신 "${String(counterfactualOutcome)}"이 됐을 것입니다.`;
    }
    return `${changes}으로 변경해도 결과 "${String(originalOutcome)}"는 동일합니다.`;
}
class CounterfactualReasoner {
    constructor() {
        this.scenarios = new Map();
    }
    // 시나리오 등록
    registerScenario(scenario) {
        this.scenarios.set(scenario.id, scenario);
    }
    // 단일 반사실 생성
    createCounterfactual(scenarioId, intervention, outcomeFunc) {
        const base = this.scenarios.get(scenarioId);
        if (!base)
            throw new Error(`Scenario "${scenarioId}" not found`);
        const modifiedVars = { ...base.variables, ...intervention };
        const cfOutcome = outcomeFunc(modifiedVars);
        const delta = {};
        for (const [k, v] of Object.entries(intervention)) {
            delta[k] = computeDelta(base.variables[k], v);
        }
        const prob = estimateProbability(Object.keys(intervention).length, cfOutcome !== base.outcome, Object.keys(base.variables).length);
        return {
            id: genCfId(),
            baseScenario: base,
            intervention,
            counterfactualOutcome: cfOutcome,
            delta,
            probability: prob,
            explanation: generateExplanation(base, intervention, base.outcome, cfOutcome),
        };
    }
    // 여러 반사실 분석
    analyze(scenarioId, interventions, outcomeFunc) {
        const base = this.scenarios.get(scenarioId);
        if (!base)
            throw new Error(`Scenario "${scenarioId}" not found`);
        const counterfactuals = interventions.map(iv => this.createCounterfactual(scenarioId, iv, outcomeFunc));
        // mostLikelyAlternative: 가장 높은 probability
        const mostLikelyAlternative = counterfactuals.reduce((best, cf) => cf.probability > best.probability ? cf : best, counterfactuals[0]);
        // sensitivity: 각 변수가 결과를 얼마나 바꾸는지
        const sensitivity = this.sensitivityAnalysis(base.variables, outcomeFunc);
        // keyFactors: sensitivity 상위 변수들
        const keyFactors = Object.entries(sensitivity)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);
        return {
            original: base,
            counterfactuals,
            mostLikelyAlternative,
            keyFactors,
            sensitivity,
        };
    }
    // "만약 X가 N이었다면?" 단순 질문
    whatIf(variables, change, outcomeFunc) {
        const tempId = `__temp_${Date.now()}`;
        const originalOutcome = outcomeFunc(variables);
        const tempScenario = {
            id: tempId,
            name: 'temporary',
            variables,
            outcome: originalOutcome,
        };
        this.scenarios.set(tempId, tempScenario);
        const cf = this.createCounterfactual(tempId, change, outcomeFunc);
        this.scenarios.delete(tempId);
        return cf;
    }
    // 최소 변경으로 원하는 결과 달성
    findMinimalIntervention(scenarioId, targetOutcome, outcomeFunc) {
        const base = this.scenarios.get(scenarioId);
        if (!base)
            throw new Error(`Scenario "${scenarioId}" not found`);
        const vars = base.variables;
        const keys = Object.keys(vars);
        // 단일 변수 변경 시도 (boolean flip, number ±10~50%)
        for (const key of keys) {
            const val = vars[key];
            const candidates = [];
            if (typeof val === 'boolean') {
                candidates.push(!val);
            }
            else if (typeof val === 'number') {
                candidates.push(val * 0.5, val * 1.5, val * 0, val * 2);
            }
            else if (typeof val === 'string') {
                candidates.push('');
            }
            for (const candidate of candidates) {
                const modified = { ...vars, [key]: candidate };
                const result = outcomeFunc(modified);
                if (result === targetOutcome) {
                    return { [key]: candidate };
                }
            }
        }
        // 두 변수 조합 시도
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const ki = keys[i];
                const kj = keys[j];
                const vi = vars[ki];
                const vj = vars[kj];
                const ci = typeof vi === 'boolean' ? [!vi] : typeof vi === 'number' ? [vi * 0.5] : [''];
                const cj = typeof vj === 'boolean' ? [!vj] : typeof vj === 'number' ? [vj * 0.5] : [''];
                for (const candidateI of ci) {
                    for (const candidateJ of cj) {
                        const modified = { ...vars, [ki]: candidateI, [kj]: candidateJ };
                        const result = outcomeFunc(modified);
                        if (result === targetOutcome) {
                            return { [ki]: candidateI, [kj]: candidateJ };
                        }
                    }
                }
            }
        }
        return null;
    }
    // 민감도 분석: 각 수치 변수를 ±10% 변경했을 때 결과 변화
    sensitivityAnalysis(variables, outcomeFunc) {
        const baseOutcome = outcomeFunc(variables);
        const sensitivity = {};
        for (const [key, val] of Object.entries(variables)) {
            if (typeof val === 'number') {
                const delta = val * 0.1 || 1; // 0이면 1 사용
                const plusOutcome = outcomeFunc({ ...variables, [key]: val + delta });
                const minusOutcome = outcomeFunc({ ...variables, [key]: val - delta });
                const avgChange = (Math.abs(plusOutcome - baseOutcome) + Math.abs(minusOutcome - baseOutcome)) / 2;
                sensitivity[key] = avgChange;
            }
            else if (typeof val === 'boolean') {
                const flipped = outcomeFunc({ ...variables, [key]: !val });
                sensitivity[key] = Math.abs(flipped - baseOutcome);
            }
            else {
                sensitivity[key] = 0;
            }
        }
        return sensitivity;
    }
}
exports.CounterfactualReasoner = CounterfactualReasoner;
exports.globalCounterfactual = new CounterfactualReasoner();
//# sourceMappingURL=counterfactual.js.map