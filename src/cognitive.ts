// FreeLang v9 Cognitive Architecture — AI 인지 아키텍처 통합
// Phase 120: Phase 111~119 전체 통합

import { HypothesisTester } from './hypothesis';
import { MetaReasoner } from './meta-reason';
import { BeliefSystem } from './belief';
import { AnalogyStore } from './analogy';
import { CritiqueAgent, defaultFinders } from './critique';
import { ReasonComposer } from './compose-reason';
import { Debater } from './debate';
import { CheckpointManager } from './checkpoint';

export interface CognitiveState {
  problem: string;
  strategy: string;
  beliefs: Map<string, number>;
  analogies: string[];
  hypothesis?: string;
  output?: any;
  critique?: { approved: boolean; risk: number };
  iterations: number;
}

export class CognitiveArchitecture {
  readonly meta: MetaReasoner;
  readonly beliefs: BeliefSystem;
  readonly analogies: AnalogyStore;
  readonly hypothesis: HypothesisTester;
  readonly critique: CritiqueAgent;
  readonly composer: ReasonComposer;
  readonly debater: Debater;
  readonly checkpoints: CheckpointManager;

  constructor() {
    this.meta = new MetaReasoner();
    this.beliefs = new BeliefSystem();
    this.analogies = new AnalogyStore();
    this.hypothesis = new HypothesisTester();
    this.critique = new CritiqueAgent();
    this.composer = new ReasonComposer();
    this.debater = new Debater();
    this.checkpoints = new CheckpointManager();
  }

  // 문제 → 전략 선택 → 실행 → 비판 → 결과
  solve(problem: string, solver: (strategy: string, problem: string) => any): {
    strategy: string;
    output: any;
    approved: boolean;
    risk: number;
    state: CognitiveState;
  } {
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
    const critiqueResult = this.critique.run(output, { finders: defaultFinders });

    // 6. 신념 업데이트
    this.beliefs.set(`solved:${problem.slice(0, 20)}`, critiqueResult.approved ? 0.8 : 0.4);

    const state: CognitiveState = {
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
  stats(): { beliefs: number; analogies: number; checkpoints: number } {
    return {
      beliefs: this.beliefs.size(),
      analogies: this.analogies.size(),
      checkpoints: this.checkpoints.list().length
    };
  }
}

export const globalCognition = new CognitiveArchitecture();
