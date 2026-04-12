"use strict";
// FreeLang v9 AI Standard Library — Phase 100
// Integrates: maybe-type, cot, tot, reflect, context-window, result-type, error-system, tool-registry, agent, self-improve
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIStdLib = exports.AIWorkflow = exports.AISession = exports.defaultCriteria = void 0;
exports.quickReason = quickReason;
exports.quickReflect = quickReflect;
exports.quickMaybe = quickMaybe;
const maybe_type_1 = require("./maybe-type");
const cot_1 = require("./cot");
const tot_1 = require("./tot");
const reflect_1 = require("./reflect");
const context_window_1 = require("./context-window");
const result_type_1 = require("./result-type");
const error_system_1 = require("./error-system");
const tool_registry_1 = require("./tool-registry");
const agent_1 = require("./agent");
const self_improve_1 = require("./self-improve");
// ── defaultCriteria: CRITERIA 기반 기본 반영 기준 ─────────────────────────
exports.defaultCriteria = Object.values(reflect_1.CRITERIA);
// ── AISession ─────────────────────────────────────────────────────────────
// AI 추론 세션: 하나의 세션에서 COT/TOT/REFLECT/CONTEXT를 함께 관리
class AISession {
    constructor(options = {}) {
        this.results = new Map();
        this.cot = new cot_1.ChainOfThought();
        this.tot = new tot_1.TreeOfThought();
        this.reflector = new reflect_1.Reflector();
        // defaultCriteria 추가
        exports.defaultCriteria.forEach(c => this.reflector.addCriteria(c));
        this.context = new context_window_1.ContextManager(options.maxTokens ?? 4096, 'sliding');
        this.tools = new tool_registry_1.ToolRegistry();
    }
    // 결과 저장/조회
    store(key, value) { this.results.set(key, value); }
    recall(key) { return this.results.get(key); }
    // 세션 요약 마크다운
    summary() {
        const stats = this.context.stats();
        return [
            '# AI Session Summary',
            '',
            this.cot.toMarkdown(),
            '',
            `**Context stats**: ${JSON.stringify(stats)}`,
            '',
            `**Stored results**: ${[...this.results.keys()].join(', ') || '(없음)'}`,
        ].join('\n');
    }
}
exports.AISession = AISession;
// ── AIWorkflow ────────────────────────────────────────────────────────────
// AI 워크플로우 빌더 (체이닝 API)
class AIWorkflow {
    constructor() {
        this.steps = [];
        this.results = [];
    }
    step(fn) {
        this.steps.push(fn);
        return this;
    }
    async run() {
        this.results = [];
        for (const step of this.steps) {
            const result = await Promise.resolve(step());
            this.results.push(result);
        }
        return this.results;
    }
    last() { return this.results[this.results.length - 1]; }
}
exports.AIWorkflow = AIWorkflow;
// ── 빠른 유틸리티 함수들 ──────────────────────────────────────────────────
function quickReason(goal, steps) {
    const cot = new cot_1.ChainOfThought();
    steps.forEach((s, i) => cot.step(`Step ${i + 1}`, () => s));
    return cot.toMarkdown();
}
function quickReflect(output, threshold = 0.7) {
    const reflector = new reflect_1.Reflector();
    exports.defaultCriteria.forEach(c => reflector.addCriteria(c));
    const result = reflector.reflect(output, threshold);
    return {
        passed: result.passed,
        score: result.totalScore,
        feedback: result.feedback,
    };
}
function quickMaybe(value, confidence) {
    return (0, maybe_type_1.maybe)(confidence, value);
}
// ── AIStdLib — FL 내장 함수로 노출할 API ──────────────────────────────────
exports.AIStdLib = {
    // 세션
    session: (opts) => new AISession(opts),
    workflow: () => new AIWorkflow(),
    // 개별 AI 블록
    cot: (_goal) => new cot_1.ChainOfThought(),
    tot: (_goal) => new tot_1.TreeOfThought(),
    reflect: () => {
        const r = new reflect_1.Reflector();
        exports.defaultCriteria.forEach(c => r.addCriteria(c));
        return r;
    },
    context: (maxTokens) => new context_window_1.ContextManager(maxTokens, 'sliding'),
    tools: () => new tool_registry_1.ToolRegistry(),
    agent: (goal, maxSteps) => new agent_1.FLAgent({ goal, maxSteps }),
    improve: (config) => new self_improve_1.SelfImprover(config),
    // Result 타입
    ok: result_type_1.ok,
    err: result_type_1.err,
    isOk: result_type_1.isOk,
    isErr: result_type_1.isErr,
    unwrapOr: result_type_1.unwrapOr,
    // Maybe 타입
    maybe: maybe_type_1.maybe,
    none: maybe_type_1.none,
    confident: maybe_type_1.confident,
    mostLikely: maybe_type_1.mostLikely,
    // 에러 처리
    errorSystem: () => new error_system_1.AIErrorSystem(),
    // 빠른 유틸
    quickReason,
    quickReflect,
    quickMaybe,
};
exports.default = exports.AIStdLib;
//# sourceMappingURL=stdlib-ai.js.map