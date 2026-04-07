export interface AgentState {
    name: string;
    state: Record<string, any>;
    history: AgentHistoryEntry[];
    tools: Record<string, (...args: any[]) => any>;
    steps: number;
    status: "running" | "done" | "error" | "max_steps";
}
export interface AgentHistoryEntry {
    step: number;
    type: "tool_call" | "state_update" | "goal_check" | "message";
    data: any;
    timestamp: number;
}
export interface Plan {
    steps: string[];
    current: number;
    done: boolean;
    results: Record<string, any>;
}
/**
 * Create the AI Agent module for FreeLang v9
 */
export declare function createAgentModule(): {
    agent_create: (name: string) => AgentState;
    agent_set: (agent: AgentState, key: string, value: any) => AgentState;
    agent_get: (agent: AgentState, key: string) => any;
    agent_update: (agent: AgentState, updates: Record<string, any>) => AgentState;
    agent_steps: (agent: AgentState) => number;
    agent_status: (agent: AgentState) => string;
    agent_done: (agent: AgentState) => boolean;
    agent_add_tool: (agent: AgentState, toolName: string, fn: (...args: any[]) => any) => AgentState;
    agent_call_tool: (agent: AgentState, toolName: string, ...args: any[]) => any;
    agent_tools: (agent: AgentState) => string[];
    agent_push_history: (agent: AgentState, entry: Omit<AgentHistoryEntry, "step" | "timestamp">) => AgentState;
    agent_history: (agent: AgentState) => AgentHistoryEntry[];
    agent_history_last: (agent: AgentState, n: number) => AgentHistoryEntry[];
    agent_history_type: (agent: AgentState, type: string) => AgentHistoryEntry[];
    agent_loop: (agent: AgentState, goalFn: (state: Record<string, any>) => boolean, stepFn: (agent: AgentState) => AgentState, maxSteps: number) => AgentState;
    agent_run_until: (state: any, condition: (s: any) => boolean, action: (s: any) => any, maxSteps: number) => any;
    plan_create: (steps: string[]) => Plan;
    plan_next: (plan: Plan) => string | null;
    plan_advance: (plan: Plan, result: any) => Plan;
    plan_done: (plan: Plan) => boolean;
    plan_progress: (plan: Plan) => number;
    plan_results: (plan: Plan) => Record<string, any>;
    observe: (key: string, value: any, context: Record<string, any>) => Record<string, any>;
    summarize: (context: Record<string, any>) => string;
    context_create: () => Record<string, any>;
    context_merge: (ctx1: Record<string, any>, ctx2: Record<string, any>) => Record<string, any>;
};
//# sourceMappingURL=stdlib-agent.d.ts.map