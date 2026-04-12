"use strict";
// FreeLang v9 Compose-Reason — 추론 블록 조합기
// Phase 119: (compose-reason steps input) → 최종 결과
// COT, TOT, REFLECT, HYPOTHESIS 등 개별 추론 블록들을 파이프라인처럼 조합 실행
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalComposer = exports.PipelineBuilder = exports.ReasonComposer = void 0;
class ReasonComposer {
    compose(steps, input) {
        const startTime = Date.now();
        const context = { step: 0, history: [], store: new Map() };
        let current = input;
        let success = true;
        for (const step of steps) {
            // 조건 체크
            if (step.condition && !step.condition(current, context)) {
                context.history.push({
                    name: `${step.name}(skipped)`,
                    input: current,
                    output: current,
                    duration: 0
                });
                context.step++;
                continue;
            }
            const stepStart = Date.now();
            try {
                const output = step.fn(current, context);
                context.history.push({
                    name: step.name,
                    input: current,
                    output,
                    duration: Date.now() - stepStart
                });
                current = output;
            }
            catch (e) {
                if (step.onError) {
                    const fallback = step.onError(e, current);
                    context.history.push({
                        name: `${step.name}(error→fallback)`,
                        input: current,
                        output: fallback,
                        duration: Date.now() - stepStart
                    });
                    current = fallback;
                }
                else {
                    success = false;
                    context.history.push({
                        name: `${step.name}(failed)`,
                        input: current,
                        output: null,
                        duration: Date.now() - stepStart
                    });
                    break;
                }
            }
            context.step++;
        }
        return {
            output: current,
            steps: context.step,
            history: context.history,
            success,
            duration: Date.now() - startTime
        };
    }
    // 단계 빌더 (체이닝)
    pipeline() { return new PipelineBuilder(this); }
}
exports.ReasonComposer = ReasonComposer;
class PipelineBuilder {
    constructor(composer) {
        this.steps = [];
        this.composer = composer;
    }
    step(name, fn, options = {}) {
        this.steps.push({ name, fn, ...options });
        return this;
    }
    run(input) {
        return this.composer.compose(this.steps, input);
    }
    stepCount() { return this.steps.length; }
}
exports.PipelineBuilder = PipelineBuilder;
exports.globalComposer = new ReasonComposer();
//# sourceMappingURL=compose-reason.js.map