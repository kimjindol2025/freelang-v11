// multi-agent-hub.ts — FreeLang v9 Phase 130: 멀티에이전트 협업 통합
// Phase 121~129의 모든 협업 모듈을 통합하는 허브 (Tier 8 완성)

import { ConsensusEngine, globalConsensus, AgentVote } from "./consensus";       // Phase 121
import { DelegationManager, globalDelegation, DelegateAgent } from "./delegate"; // Phase 122
import { VotingSystem, globalVoting, Ballot } from "./vote";                     // Phase 123
import { Negotiator, globalNegotiator, NegotiationPosition } from "./negotiate"; // Phase 124
import { Swarm, globalSwarm } from "./swarm";                                    // Phase 125
import { Orchestrator, globalOrchestrator } from "./orchestrate";                // Phase 126
import { PeerReviewSystem, globalPeerReview, Reviewer } from "./peer-review";    // Phase 127
import { AgentChain, globalChain as globalAgentChain, ChainAgent } from "./chain-agents";  // Phase 128
import { Competition, globalCompetition, Competitor } from "./compete";          // Phase 129

export {
  ConsensusEngine, globalConsensus,
  DelegationManager, globalDelegation,
  VotingSystem, globalVoting,
  Negotiator, globalNegotiator,
  Swarm, globalSwarm,
  Orchestrator, globalOrchestrator,
  PeerReviewSystem, globalPeerReview,
  AgentChain, globalAgentChain,
  Competition, globalCompetition,
};

export type HubTaskType =
  | 'consensus'    // 여러 답 → 합의
  | 'delegate'     // 전문화 위임
  | 'vote'         // 투표 결정
  | 'negotiate'    // 협상
  | 'swarm'        // 군집 최적화
  | 'orchestrate'  // 의존성 기반 오케스트레이션
  | 'peer-review'  // 피어 리뷰
  | 'chain'        // 순차 체인
  | 'compete';     // 경쟁으로 최선 선택

export interface HubRouteResult {
  taskType: HubTaskType | string;
  result: any;
  system: string;
  timestamp: number;
}

export class MultiAgentHub {
  private consensus: ConsensusEngine;
  private delegation: DelegationManager;
  private voting: VotingSystem;
  private negotiator: Negotiator;
  private swarm: Swarm;
  private orchestrator: Orchestrator;
  private peerReview: PeerReviewSystem;
  private chain: AgentChain;
  private competition: Competition;

  constructor() {
    this.consensus = new ConsensusEngine();
    this.delegation = new DelegationManager();
    this.voting = new VotingSystem();
    this.negotiator = new Negotiator();
    this.swarm = new Swarm();
    this.orchestrator = new Orchestrator();
    this.peerReview = new PeerReviewSystem();
    this.chain = new AgentChain();
    this.competition = new Competition();
  }

  /**
   * taskType에 따라 적절한 협업 시스템으로 라우팅
   * problem: 문제 데이터, agents: 에이전트 목록(선택적)
   */
  route(taskType: string, problem: any, agents: any[] = []): HubRouteResult {
    const timestamp = Date.now();

    switch (taskType) {
      case 'consensus': {
        // 여러 에이전트 투표를 다수결로 합의
        const votes: AgentVote<any>[] = Array.isArray(agents)
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
        const dm = new DelegationManager();
        agents.forEach((a: any) => {
          if (a.id && a.execute) dm.register(a as DelegateAgent);
          else dm.register({
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
        const result = this.negotiator.negotiate(problem as NegotiationPosition[]);
        return { taskType, result: result.agreed ? result.value : null, system: 'Negotiator', timestamp };
      }

      case 'swarm': {
        // 군집 지능 최적화
        const objective = typeof problem === 'function' ? problem : (x: number) => -Math.abs(x - (problem ?? 0));
        const result = this.swarm.optimize({ objective });
        return { taskType, result: result.bestPosition, system: 'Swarm', timestamp };
      }

      case 'orchestrate': {
        // 의존성 기반 오케스트레이션
        const orch = new Orchestrator();
        agents.forEach((a: any) => {
          if (a.id && a.run) orch.register(a);
          else if (a.id) orch.register({ id: a.id, run: typeof a.solve === 'function' ? a.solve : (x: any) => x });
        });
        const tasks = Array.isArray(problem) ? problem : [{ id: 'task', input: problem }];
        const result = orch.run(tasks);
        return { taskType, result: result.outputs, system: 'Orchestrator', timestamp };
      }

      case 'peer-review': {
        // 피어 리뷰
        const prs = new PeerReviewSystem();
        agents.forEach((a: any, i: number) => {
          prs.addReviewer({
            id: a.id ?? `reviewer-${i}`,
            review: (output: any) => ({
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
            review: (_output: any) => ({ reviewerId: 'default-reviewer', aspect: 'quality', score: 0.8, comment: 'OK' }),
          });
        }
        const result = prs.review('target', problem);
        return { taskType, result: result.approved, system: 'PeerReviewSystem', timestamp };
      }

      case 'chain': {
        // 순차 에이전트 체인
        const ch = new AgentChain();
        agents.forEach((a: any, i: number) => {
          ch.add({
            id: a.id ?? `chain-${i}`,
            transform: typeof a.transform === 'function' ? a.transform
              : typeof a.process === 'function' ? a.process
              : typeof a.solve === 'function' ? a.solve
              : (x: any) => x,
          } as ChainAgent);
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
        const comp = new Competition();
        agents.forEach((a: any, i: number) => {
          comp.register({
            id: a.id ?? `competitor-${i}`,
            solve: typeof a.solve === 'function' ? a.solve : () => problem,
          } as Competitor);
        });
        const evaluate = typeof problem?.evaluate === 'function'
          ? problem.evaluate
          : (x: any) => typeof x === 'number' ? x : 1;
        const prob = problem?.task ?? problem;
        const result = comp.run(prob, evaluate);
        return { taskType, result: result.winner.output, system: 'Competition', timestamp };
      }

      default:
        return { taskType, result: problem, system: 'passthrough', timestamp };
    }
  }

  /** 허브 통계 */
  stats(): Record<string, number> {
    return {
      systems: 9,
      ready: 9,
      phases: 9,   // Phase 121~129
      tier: 8,
    };
  }

  /** 사용 가능한 시스템 목록 */
  systems(): string[] {
    return [
      'ConsensusEngine',    // Phase 121
      'DelegationManager',  // Phase 122
      'VotingSystem',       // Phase 123
      'Negotiator',         // Phase 124
      'Swarm',              // Phase 125
      'Orchestrator',       // Phase 126
      'PeerReviewSystem',   // Phase 127
      'AgentChain',         // Phase 128
      'Competition',        // Phase 129
    ];
  }

  /** 태스크 타입 목록 */
  taskTypes(): HubTaskType[] {
    return ['consensus', 'delegate', 'vote', 'negotiate', 'swarm', 'orchestrate', 'peer-review', 'chain', 'compete'];
  }
}

/** 글로벌 싱글톤 */
export const globalHub = new MultiAgentHub();
