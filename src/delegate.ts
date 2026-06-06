// FreeLang v9 Delegation System — AI 서브태스크 위임
// Phase 122: [DELEGATE] 서브태스크 위임 블록

export interface DelegateTask {
  id: string;
  description: string;
  input: any;
  requiredCapability?: string;
}

export interface DelegateAgent {
  id: string;
  capabilities: string[];
  execute: (task: DelegateTask) => any;
}

export interface DelegateResult {
  taskId: string;
  agentId: string;
  output: any;
  success: boolean;
  duration: number;
}

export interface DelegationResult {
  results: DelegateResult[];
  successful: number;
  failed: number;
  totalDuration: number;
}

export class DelegationManager {
  private agents: Map<string, DelegateAgent> = new Map();

  register(agent: DelegateAgent): void {
    this.agents.set(agent.id, agent);
  }

  // 능력 기반 에이전트 찾기
  findCapable(capability: string): DelegateAgent[] {
    return [...this.agents.values()].filter(a => a.capabilities.includes(capability));
  }

  // 단일 태스크 위임
  delegate(task: DelegateTask): DelegateResult {
    const candidates = task.requiredCapability
      ? this.findCapable(task.requiredCapability)
      : [...this.agents.values()];
    if (candidates.length === 0) {
      return { taskId: task.id, agentId: 'none', output: null, success: false, duration: 0 };
    }
    const agent = candidates[0];
    const start = Date.now();
    try {
      const output = agent.execute(task);
      return { taskId: task.id, agentId: agent.id, output, success: true, duration: Date.now() - start };
    } catch (e) {
      return { taskId: task.id, agentId: agent.id, output: null, success: false, duration: Date.now() - start };
    }
  }

  // 여러 태스크 병렬 위임
  delegateAll(tasks: DelegateTask[]): DelegationResult {
    const start = Date.now();
    const results = tasks.map(t => this.delegate(t));
    return {
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDuration: Date.now() - start
    };
  }

  list(): string[] { return [...this.agents.keys()]; }
  size(): number { return this.agents.size; }
}

export const globalDelegation = new DelegationManager();
