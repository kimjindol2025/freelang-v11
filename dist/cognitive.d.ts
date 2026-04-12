import { HypothesisTester } from './hypothesis';
import { MetaReasoner } from './meta-reason';
import { BeliefSystem } from './belief';
import { AnalogyStore } from './analogy';
import { CritiqueAgent } from './critique';
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
    critique?: {
        approved: boolean;
        risk: number;
    };
    iterations: number;
}
export declare class CognitiveArchitecture {
    readonly meta: MetaReasoner;
    readonly beliefs: BeliefSystem;
    readonly analogies: AnalogyStore;
    readonly hypothesis: HypothesisTester;
    readonly critique: CritiqueAgent;
    readonly composer: ReasonComposer;
    readonly debater: Debater;
    readonly checkpoints: CheckpointManager;
    constructor();
    solve(problem: string, solver: (strategy: string, problem: string) => any): {
        strategy: string;
        output: any;
        approved: boolean;
        risk: number;
        state: CognitiveState;
    };
    stats(): {
        beliefs: number;
        analogies: number;
        checkpoints: number;
    };
}
export declare const globalCognition: CognitiveArchitecture;
//# sourceMappingURL=cognitive.d.ts.map