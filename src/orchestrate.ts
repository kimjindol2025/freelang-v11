// orchestrate.ts — FreeLang v9 Phase 126: ORCHESTRATE 에이전트 오케스트레이터
// 여러 에이전트를 태스크 의존성 그래프 기반으로 위상 정렬하여 순서대로 실행한다.
// AI가 복잡한 파이프라인을 선언적으로 표현할 수 있게 한다.

export interface OrchestrateTask {
  id: string;
  input: any;
  dependsOn?: string[];  // 선행 태스크 ID 목록
}

export interface OrchestrateAgent {
  id: string;
  run: (input: any) => any;
}

export interface OrchestrateResult {
  outputs: Record<string, any>;  // taskId → output
  order: string[];               // 실행 순서
  duration: number;              // ms
  success: boolean;
}

export class Orchestrator {
  private agents: Map<string, OrchestrateAgent> = new Map();

  /** 에이전트 등록 */
  register(agent: OrchestrateAgent): void {
    this.agents.set(agent.id, agent);
  }

  /** 등록된 에이전트 ID 목록 */
  list(): string[] {
    return [...this.agents.keys()];
  }

  /**
   * 위상 정렬 — 의존성이 먼저 오도록 실행 순서 결정
   * 순환 의존성: visited Set으로 재방문 방지 (사이클 무시, 첫 방문 경로만 사용)
   */
  private topSort(tasks: OrchestrateTask[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const task = taskMap.get(id);
      if (task?.dependsOn) {
        for (const dep of task.dependsOn) {
          visit(dep);
        }
      }
      order.push(id);
    };

    for (const t of tasks) {
      visit(t.id);
    }
    return order;
  }

  /**
   * 태스크 목록 실행 — 위상 정렬 후 순서대로 실행
   * 선행 태스크의 output을 다음 태스크 input의 deps 필드에 주입
   */
  run(tasks: OrchestrateTask[]): OrchestrateResult {
    const start = Date.now();
    const outputs: Record<string, any> = {};
    const order = this.topSort(tasks);
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    if (tasks.length === 0) {
      return { outputs, order: [], duration: Date.now() - start, success: true };
    }

    try {
      for (const id of order) {
        const task = taskMap.get(id);
        if (!task) continue;

        // 에이전트 선택: id 매칭 우선, 없으면 첫 번째 등록 에이전트 사용
        const agent = this.agents.get(id) ?? this.agents.values().next().value;
        if (!agent) continue;

        // 선행 태스크 출력을 deps 배열로 주입
        const depOutputs = (task.dependsOn ?? []).map(d => outputs[d]);
        const input = depOutputs.length > 0
          ? { ...task.input, deps: depOutputs }
          : task.input;

        outputs[id] = agent.run(input);
      }
      return { outputs, order, duration: Date.now() - start, success: true };
    } catch (e) {
      return { outputs, order, duration: Date.now() - start, success: false };
    }
  }

  /** 실행 순서만 반환 (dry run) */
  getOrder(tasks: OrchestrateTask[]): string[] {
    return this.topSort(tasks);
  }
}

/** 싱글톤 글로벌 오케스트레이터 */
export const globalOrchestrator = new Orchestrator();

/**
 * createOrchestrateBuiltins — FL 인터프리터에 등록할 오케스트레이터 빌트인 함수
 */
export function createOrchestrateBuiltins(
  interp: { callFunctionValue: (fn: any, args: any[]) => any }
): Record<string, (...args: any[]) => any> {
  return {
    // (orchestrate-register "id" fn) → void
    "orchestrate-register": (id: string, fn: any): null => {
      globalOrchestrator.register({
        id: String(id),
        run: (input: any) => interp.callFunctionValue(fn, [input]),
      });
      return null;
    },

    // (orchestrate tasks-list) → outputs 맵 (Record<taskId, output>)
    "orchestrate": (tasks: any[]): Record<string, any> => {
      const normalized: OrchestrateTask[] = (Array.isArray(tasks) ? tasks : []).map((t: any) => ({
        id: String(t.id ?? t[0]),
        input: t.input ?? t[1] ?? null,
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String)
          : Array.isArray(t[2]) ? t[2].map(String)
          : undefined,
      }));
      return globalOrchestrator.run(normalized).outputs;
    },

    // (orchestrate-order tasks-list) → 실행 순서 string[]
    "orchestrate-order": (tasks: any[]): string[] => {
      const normalized: OrchestrateTask[] = (Array.isArray(tasks) ? tasks : []).map((t: any) => ({
        id: String(t.id ?? t[0]),
        input: t.input ?? t[1] ?? null,
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String)
          : Array.isArray(t[2]) ? t[2].map(String)
          : undefined,
      }));
      return globalOrchestrator.getOrder(normalized);
    },

    // (orchestrate-list) → 등록된 에이전트 ID 목록
    "orchestrate-list": (): string[] => {
      return globalOrchestrator.list();
    },
  };
}
