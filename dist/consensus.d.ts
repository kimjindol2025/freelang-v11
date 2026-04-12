export type ConsensusStrategy = 'majority' | 'weighted' | 'unanimous' | 'threshold';
export interface AgentVote<T> {
    agentId: string;
    answer: T;
    confidence: number;
}
export interface ConsensusResult<T> {
    answer: T;
    strategy: ConsensusStrategy;
    agreement: number;
    votes: AgentVote<T>[];
    dissent: AgentVote<T>[];
}
export declare class ConsensusEngine {
    majority<T>(votes: AgentVote<T>[]): ConsensusResult<T>;
    weighted(votes: AgentVote<number>[]): ConsensusResult<number>;
    threshold<T>(votes: AgentVote<T>[], threshold?: number): ConsensusResult<T> | null;
    unanimous<T>(votes: AgentVote<T>[]): ConsensusResult<T> | null;
    agreement<T>(votes: AgentVote<T>[]): number;
}
export declare const globalConsensus: ConsensusEngine;
//# sourceMappingURL=consensus.d.ts.map