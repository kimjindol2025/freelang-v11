// agent-chain.ts — FreeLang v9 Phase 128: CHAIN-AGENTS 에이전트 체인 파이프라인
// 여러 에이전트를 순서대로 연결하여 출력이 다음 에이전트의 입력이 되는 파이프라인

export interface ChainAgent {
  id: string;
  process: (input: any) => any;
}

export interface ChainStep {
  agentId: string;
  input: any;
  output: any;
  duration: number;
}

export interface ChainResult {
  finalOutput: any;
  steps: ChainStep[];
  success: boolean;
  totalDuration: number;
}

export class AgentChain {
  private agents: ChainAgent[] = [];

  /** 에이전트 추가 (순서대로) */
  add(agent: ChainAgent): this {
    this.agents.push(agent);
    return this;
  }

  /** 에이전트 목록 */
  list(): string[] {
    return this.agents.map(a => a.id);
  }

  /** 파이프라인 실행 */
  run(initialInput: any): ChainResult {
    const start = Date.now();
    const steps: ChainStep[] = [];
    let current = initialInput;
    let success = true;

    for (const agent of this.agents) {
      const stepStart = Date.now();
      try {
        const output = agent.process(current);
        steps.push({ agentId: agent.id, input: current, output, duration: Date.now() - stepStart });
        current = output;
      } catch (e) {
        steps.push({ agentId: agent.id, input: current, output: null, duration: Date.now() - stepStart });
        success = false;
        break;
      }
    }

    return { finalOutput: current, steps, success, totalDuration: Date.now() - start };
  }

  /** 에이전트 수 */
  size(): number {
    return this.agents.length;
  }

  /** 체인 초기화 */
  clear(): void {
    this.agents = [];
  }
}

export const globalAgentChain = new AgentChain();
