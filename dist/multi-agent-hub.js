"use strict";
// multi-agent-hub.ts — FreeLang v9 Phase 130: 멀티에이전트 협업 통합
// Phase 121~129의 모든 협업 모듈을 통합하는 허브 (Tier 8 완성)
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalHub = exports.MultiAgentHub = exports.globalCompetition = exports.Competition = exports.globalAgentChain = exports.AgentChain = exports.globalPeerReview = exports.PeerReviewSystem = exports.globalOrchestrator = exports.Orchestrator = exports.globalSwarm = exports.Swarm = exports.globalNegotiator = exports.Negotiator = exports.globalVoting = exports.VotingSystem = exports.globalDelegation = exports.DelegationManager = exports.globalConsensus = exports.ConsensusEngine = void 0;
const consensus_1 = require("./consensus"); // Phase 121
Object.defineProperty(exports, "ConsensusEngine", { enumerable: true, get: function () { return consensus_1.ConsensusEngine; } });
Object.defineProperty(exports, "globalConsensus", { enumerable: true, get: function () { return consensus_1.globalConsensus; } });
const delegate_1 = require("./delegate"); // Phase 122
Object.defineProperty(exports, "DelegationManager", { enumerable: true, get: function () { return delegate_1.DelegationManager; } });
Object.defineProperty(exports, "globalDelegation", { enumerable: true, get: function () { return delegate_1.globalDelegation; } });
const vote_1 = require("./vote"); // Phase 123
Object.defineProperty(exports, "VotingSystem", { enumerable: true, get: function () { return vote_1.VotingSystem; } });
Object.defineProperty(exports, "globalVoting", { enumerable: true, get: function () { return vote_1.globalVoting; } });
const negotiate_1 = require("./negotiate"); // Phase 124
Object.defineProperty(exports, "Negotiator", { enumerable: true, get: function () { return negotiate_1.Negotiator; } });
Object.defineProperty(exports, "globalNegotiator", { enumerable: true, get: function () { return negotiate_1.globalNegotiator; } });
const swarm_1 = require("./swarm"); // Phase 125
Object.defineProperty(exports, "Swarm", { enumerable: true, get: function () { return swarm_1.Swarm; } });
Object.defineProperty(exports, "globalSwarm", { enumerable: true, get: function () { return swarm_1.globalSwarm; } });
const orchestrate_1 = require("./orchestrate"); // Phase 126
Object.defineProperty(exports, "Orchestrator", { enumerable: true, get: function () { return orchestrate_1.Orchestrator; } });
Object.defineProperty(exports, "globalOrchestrator", { enumerable: true, get: function () { return orchestrate_1.globalOrchestrator; } });
const peer_review_1 = require("./peer-review"); // Phase 127
Object.defineProperty(exports, "PeerReviewSystem", { enumerable: true, get: function () { return peer_review_1.PeerReviewSystem; } });
Object.defineProperty(exports, "globalPeerReview", { enumerable: true, get: function () { return peer_review_1.globalPeerReview; } });
const chain_agents_1 = require("./chain-agents"); // Phase 128
Object.defineProperty(exports, "AgentChain", { enumerable: true, get: function () { return chain_agents_1.AgentChain; } });
Object.defineProperty(exports, "globalAgentChain", { enumerable: true, get: function () { return chain_agents_1.globalChain; } });
const compete_1 = require("./compete"); // Phase 129
Object.defineProperty(exports, "Competition", { enumerable: true, get: function () { return compete_1.Competition; } });
Object.defineProperty(exports, "globalCompetition", { enumerable: true, get: function () { return compete_1.globalCompetition; } });
class MultiAgentHub {
    constructor() {
        this.consensus = new consensus_1.ConsensusEngine();
        this.delegation = new delegate_1.DelegationManager();
        this.voting = new vote_1.VotingSystem();
        this.negotiator = new negotiate_1.Negotiator();
        this.swarm = new swarm_1.Swarm();
        this.orchestrator = new orchestrate_1.Orchestrator();
        this.peerReview = new peer_review_1.PeerReviewSystem();
        this.chain = new chain_agents_1.AgentChain();
        this.competition = new compete_1.Competition();
    }
    /**
     * taskType에 따라 적절한 협업 시스템으로 라우팅
     * problem: 문제 데이터, agents: 에이전트 목록(선택적)
     */
    route(taskType, problem, agents = []) {
        const timestamp = Date.now();
        switch (taskType) {
            case 'consensus': {
                // 여러 에이전트 투표를 다수결로 합의
                const votes = Array.isArray(agents)
                    ? agents.map((a, i) => ({
                        agentId: a.id ?? `agent-${i}`,
                        answer: typeof a.solve === 'function' ? a.solve(problem) : a.answer ?? problem,
                        confidence: a.confidence ?? 0.8,
                    }))
                    : [{ agentId: 'default', answer: problem, confidence: 1.0 }];
                const result = this.consensus.majority(votes.length > 0 ? votes : [{ agentId: 'solo', answer: problem, confidence: 1.0 }]);
                return { taskType, result: result.answer, system: 'ConsensusEngine', timestamp };
            }
            case 'delegate': {
                // 에이전트 능력 기반 위임
                if (agents.length === 0) {
                    return { taskType, result: problem, system: 'DelegationManager', timestamp };
                }
                const dm = new delegate_1.DelegationManager();
                agents.forEach((a) => {
                    if (a.id && a.execute)
                        dm.register(a);
                    else
                        dm.register({
                            id: a.id ?? 'default',
                            capabilities: a.capabilities ?? ['general'],
                            execute: typeof a.solve === 'function' ? a.solve : () => problem,
                        });
                });
                const task = typeof problem === 'object' && problem.id
                    ? problem
                    : { id: 'task-0', description: String(problem), input: problem };
                const result = dm.delegate(task);
                return { taskType, result: result.output, system: 'DelegationManager', timestamp };
            }
            case 'vote': {
                // 에이전트 투표 (plurality)
                if (!Array.isArray(problem?.ballots) || !Array.isArray(problem?.candidates)) {
                    return { taskType, result: problem, system: 'VotingSystem', timestamp };
                }
                const voteResult = this.voting.plurality(problem.ballots, problem.candidates);
                return { taskType, result: voteResult.winner, system: 'VotingSystem', timestamp };
            }
            case 'negotiate': {
                // 에이전트 협상
                if (!Array.isArray(problem)) {
                    return { taskType, result: null, system: 'Negotiator', timestamp };
                }
                const result = this.negotiator.negotiate(problem);
                return { taskType, result: result.agreed ? result.value : null, system: 'Negotiator', timestamp };
            }
            case 'swarm': {
                // 군집 지능 최적화
                const objective = typeof problem === 'function' ? problem : (x) => -Math.abs(x - (problem ?? 0));
                const result = this.swarm.optimize({ objective });
                return { taskType, result: result.bestPosition, system: 'Swarm', timestamp };
            }
            case 'orchestrate': {
                // 의존성 기반 오케스트레이션
                const orch = new orchestrate_1.Orchestrator();
                agents.forEach((a) => {
                    if (a.id && a.run)
                        orch.register(a);
                    else if (a.id)
                        orch.register({ id: a.id, run: typeof a.solve === 'function' ? a.solve : (x) => x });
                });
                const tasks = Array.isArray(problem) ? problem : [{ id: 'task', input: problem }];
                const result = orch.run(tasks);
                return { taskType, result: result.outputs, system: 'Orchestrator', timestamp };
            }
            case 'peer-review': {
                // 피어 리뷰
                const prs = new peer_review_1.PeerReviewSystem();
                agents.forEach((a, i) => {
                    prs.addReviewer({
                        id: a.id ?? `reviewer-${i}`,
                        review: (output) => ({
                            reviewerId: a.id ?? `reviewer-${i}`,
                            aspect: 'quality',
                            score: typeof a.score === 'function' ? a.score(output) : (a.score ?? 0.8),
                            comment: a.comment ?? 'OK',
                        }),
                    });
                });
                if (prs.size() === 0) {
                    // 기본 리뷰어 추가
                    prs.addReviewer({
                        id: 'default-reviewer',
                        review: (_output) => ({ reviewerId: 'default-reviewer', aspect: 'quality', score: 0.8, comment: 'OK' }),
                    });
                }
                const result = prs.review('target', problem);
                return { taskType, result: result.approved, system: 'PeerReviewSystem', timestamp };
            }
            case 'chain': {
                // 순차 에이전트 체인
                const ch = new chain_agents_1.AgentChain();
                agents.forEach((a, i) => {
                    ch.add({
                        id: a.id ?? `chain-${i}`,
                        transform: typeof a.transform === 'function' ? a.transform
                            : typeof a.process === 'function' ? a.process
                                : typeof a.solve === 'function' ? a.solve
                                    : (x) => x,
                    });
                });
                if (ch.length() === 0) {
                    return { taskType, result: problem, system: 'AgentChain', timestamp };
                }
                const result = ch.run(problem);
                return { taskType, result: result.finalOutput, system: 'AgentChain', timestamp };
            }
            case 'compete': {
                // 경쟁으로 최선 선택
                if (agents.length === 0) {
                    return { taskType, result: problem, system: 'Competition', timestamp };
                }
                const comp = new compete_1.Competition();
                agents.forEach((a, i) => {
                    comp.register({
                        id: a.id ?? `competitor-${i}`,
                        solve: typeof a.solve === 'function' ? a.solve : () => problem,
                    });
                });
                const evaluate = typeof problem?.evaluate === 'function'
                    ? problem.evaluate
                    : (x) => typeof x === 'number' ? x : 1;
                const prob = problem?.task ?? problem;
                const result = comp.run(prob, evaluate);
                return { taskType, result: result.winner.output, system: 'Competition', timestamp };
            }
            default:
                return { taskType, result: problem, system: 'passthrough', timestamp };
        }
    }
    /** 허브 통계 */
    stats() {
        return {
            systems: 9,
            ready: 9,
            phases: 9, // Phase 121~129
            tier: 8,
        };
    }
    /** 사용 가능한 시스템 목록 */
    systems() {
        return [
            'ConsensusEngine', // Phase 121
            'DelegationManager', // Phase 122
            'VotingSystem', // Phase 123
            'Negotiator', // Phase 124
            'Swarm', // Phase 125
            'Orchestrator', // Phase 126
            'PeerReviewSystem', // Phase 127
            'AgentChain', // Phase 128
            'Competition', // Phase 129
        ];
    }
    /** 태스크 타입 목록 */
    taskTypes() {
        return ['consensus', 'delegate', 'vote', 'negotiate', 'swarm', 'orchestrate', 'peer-review', 'chain', 'compete'];
    }
}
exports.MultiAgentHub = MultiAgentHub;
/** 글로벌 싱글톤 */
exports.globalHub = new MultiAgentHub();
//# sourceMappingURL=multi-agent-hub.js.map