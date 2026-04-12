"use strict";
// SelfImprove: AI 자기 수정 시스템
// [SELF-IMPROVE :target $code :evaluate fn :improve fn :iterations 3 :stop-when fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfImprover = void 0;
exports.createSelfImprover = createSelfImprover;
class SelfImprover {
    constructor(config) {
        this.config = { maxIterations: 5, minImprovement: 0.01, ...config };
        const initialScore = config.evaluate(config.target);
        this.state = {
            iteration: 0,
            current: config.target,
            score: initialScore,
            history: [{ iteration: 0, value: config.target, score: initialScore, improvement: 'initial' }],
            done: false,
            reason: 'not started'
        };
    }
    step() {
        if (this.state.done)
            return this.state;
        this.state.iteration++;
        const { value: newValue, improvement } = this.config.improve(this.state.current, this.state.score, this.state.history);
        const newScore = this.config.evaluate(newValue);
        const delta = newScore - this.state.score;
        this.state.history.push({
            iteration: this.state.iteration,
            value: newValue,
            score: newScore,
            improvement
        });
        // 점수가 올랐으면 채택
        if (newScore >= this.state.score) {
            this.state.current = newValue;
            this.state.score = newScore;
        }
        // 종료 조건 체크
        if (this.config.stopWhen?.(this.state.score, this.state.iteration)) {
            this.state.done = true;
            this.state.reason = 'stop-when condition met';
        }
        else if (this.state.iteration >= (this.config.maxIterations ?? 5)) {
            this.state.done = true;
            this.state.reason = 'max iterations reached';
        }
        else {
            const minImp = this.config.minImprovement ?? 0.01;
            // delta가 minImprovement 미만이면 종료
            // minImprovement=0: delta < 0은 하락(채택 안됨, 이미 위에서 처리), delta === 0이면 종료
            // 즉 delta >= 0이고 minImp보다 엄격히 작으면 종료
            // 단, minImp=0이면 delta >= 0 && delta === 0이면 종료 → delta >= 0 && delta <= 0
            if (minImp === 0 ? delta <= 0 : (delta >= 0 && delta < minImp)) {
                this.state.done = true;
                this.state.reason = 'improvement below threshold';
            }
        }
        return this.state;
    }
    run() {
        while (!this.state.done) {
            this.step();
        }
        return this.state;
    }
    getState() { return this.state; }
    toMarkdown() {
        const lines = [`## SELF-IMPROVE (${this.state.reason})`, ''];
        this.state.history.forEach(h => {
            lines.push(`### Iteration ${h.iteration} (score=${h.score.toFixed(3)})`);
            lines.push(`- improvement: ${h.improvement}`);
        });
        lines.push('', `**Final score**: ${this.state.score.toFixed(3)}`);
        return lines.join('\n');
    }
}
exports.SelfImprover = SelfImprover;
// FL 내장 함수로 등록할 헬퍼
function createSelfImprover(config) {
    return new SelfImprover(config);
}
//# sourceMappingURL=self-improve.js.map