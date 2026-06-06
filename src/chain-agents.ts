// chain-agents.ts — FreeLang v9 Phase 128: Agent Chain Pipeline
// [CHAIN-AGENTS] 에이전트 체인 파이프라인 블록
// 여러 에이전트를 순차 연결, 이전 출력이 다음 입력으로 흐름

export interface ChainAgent {
  id: string;
  transform: (input: any) => any;
  validate?: (output: any) => boolean;  // 출력 검증
}

export interface ChainLink {
  agentId: string;
  input: any;
  output: any;
  duration: number;
  skipped: boolean;
}

export interface ChainResult {
  finalOutput: any;
  links: ChainLink[];
  success: boolean;
  stepsCompleted: number;
}

export class AgentChain {
  private agents: ChainAgent[] = [];

  add(agent: ChainAgent): AgentChain {
    this.agents.push(agent);
    return this;
  }

  run(initialInput: any): ChainResult {
    const links: ChainLink[] = [];
    let current = initialInput;
    let success = true;

    for (const agent of this.agents) {
      const start = Date.now();
      try {
        const output = agent.transform(current);
        const valid = agent.validate ? agent.validate(output) : true;
        links.push({
          agentId: agent.id,
          input: current,
          output,
          duration: Date.now() - start,
          skipped: !valid,
        });
        if (valid) current = output;
        // validate 실패 시 이전 값 유지하고 계속
      } catch {
        links.push({
          agentId: agent.id,
          input: current,
          output: null,
          duration: Date.now() - start,
          skipped: true,
        });
        success = false;
        break;
      }
    }

    return {
      finalOutput: current,
      links,
      success,
      stepsCompleted: links.filter(l => !l.skipped).length,
    };
  }

  // 팩토리: 배열로 빠르게 체인 생성
  static from(agents: ChainAgent[]): AgentChain {
    const chain = new AgentChain();
    agents.forEach(a => chain.add(a));
    return chain;
  }

  length(): number {
    return this.agents.length;
  }
}

export const globalChain = new AgentChain();
