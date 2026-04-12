import { ConsensusEngine, globalConsensus } from "./consensus";
import { DelegationManager, globalDelegation } from "./delegate";
import { VotingSystem, globalVoting } from "./vote";
import { Negotiator, globalNegotiator } from "./negotiate";
import { Swarm, globalSwarm } from "./swarm";
import { Orchestrator, globalOrchestrator } from "./orchestrate";
import { PeerReviewSystem, globalPeerReview } from "./peer-review";
import { AgentChain, globalChain as globalAgentChain } from "./chain-agents";
import { Competition, globalCompetition } from "./compete";
export { ConsensusEngine, globalConsensus, DelegationManager, globalDelegation, VotingSystem, globalVoting, Negotiator, globalNegotiator, Swarm, globalSwarm, Orchestrator, globalOrchestrator, PeerReviewSystem, globalPeerReview, AgentChain, globalAgentChain, Competition, globalCompetition, };
export type HubTaskType = 'consensus' | 'delegate' | 'vote' | 'negotiate' | 'swarm' | 'orchestrate' | 'peer-review' | 'chain' | 'compete';
export interface HubRouteResult {
    taskType: HubTaskType | string;
    result: any;
    system: string;
    timestamp: number;
}
export declare class MultiAgentHub {
    private consensus;
    private delegation;
    private voting;
    private negotiator;
    private swarm;
    private orchestrator;
    private peerReview;
    private chain;
    private competition;
    constructor();
    /**
     * taskType에 따라 적절한 협업 시스템으로 라우팅
     * problem: 문제 데이터, agents: 에이전트 목록(선택적)
     */
    route(taskType: string, problem: any, agents?: any[]): HubRouteResult;
    /** 허브 통계 */
    stats(): Record<string, number>;
    /** 사용 가능한 시스템 목록 */
    systems(): string[];
    /** 태스크 타입 목록 */
    taskTypes(): HubTaskType[];
}
/** 글로벌 싱글톤 */
export declare const globalHub: MultiAgentHub;
//# sourceMappingURL=multi-agent-hub.d.ts.map