"use strict";
// FreeLang v9 Cognitive Architecture — AI 인지 아키텍처 통합
// Phase 120: Phase 111~119 전체 통합
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCognition = exports.CognitiveArchitecture = void 0;
const hypothesis_1 = require("./hypothesis");
const meta_reason_1 = require("./meta-reason");
const belief_1 = require("./belief");
const analogy_1 = require("./analogy");
const critique_1 = require("./critique");
const compose_reason_1 = require("./compose-reason");
const debate_1 = require("./debate");
const checkpoint_1 = require("./checkpoint");
class CognitiveArchitecture {
    constructor() {
        this.meta = new meta_reason_1.MetaReasoner();
        this.beliefs = new belief_1.BeliefSystem();
        this.analogies = new analogy_1.AnalogyStore();
        this.hypothesis = new hypothesis_1.HypothesisTester();
        this.critique = new critique_1.CritiqueAgent();
        this.composer = new compose_reason_1.ReasonComposer();
        this.debater = new debate_1.Debater();
        this.checkpoints = new checkpoint_1.CheckpointManager();
    }
    // 문제 → 전략 선택 → 실행 → 비판 → 결과
    solve(problem, solver) {
        // 1. 메타 추론으로 전략 선택
        const meta = this.meta.analyze(problem);
        const strategy = meta.selected;
        // 2. 체크포인트 저장
        this.checkpoints.save('pre-solve', { problem, strategy });
        // 3. 유추: 비슷한 패턴 찾기
        const analogyResult = this.analogies.best(problem);
        // 4. 풀기
        const output = solver(strategy, problem);
        // 5. 비판
        const critiqueResult = this.critique.run(output, { finders: critique_1.defaultFinders });
        // 6. 신념 업데이트
        this.beliefs.set(`solved:${problem.slice(0, 20)}`, critiqueResult.approved ? 0.8 : 0.4);
        const state = {
            problem,
            strategy,
            beliefs: new Map([[`solved`, critiqueResult.approved ? 0.8 : 0.4]]),
            analogies: analogyResult ? [analogyResult.description] : [],
            output,
            critique: { approved: critiqueResult.approved, risk: critiqueResult.overallRisk },
            iterations: 1
        };
        return { strategy, output, approved: critiqueResult.approved, risk: critiqueResult.overallRisk, state };
    }
    // 간단한 통계
    stats() {
        return {
            beliefs: this.beliefs.size(),
            analogies: this.analogies.size(),
            checkpoints: this.checkpoints.list().length
        };
    }
}
exports.CognitiveArchitecture = CognitiveArchitecture;
exports.globalCognition = new CognitiveArchitecture();
//# sourceMappingURL=cognitive.js.map