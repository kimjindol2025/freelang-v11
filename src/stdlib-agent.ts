// FreeLang v9: AI Agent State Machine Standard Library
// Phase 15: Agent primitives — the execution model FOR AI agents
//
// FreeLang v9의 존재 이유:
// AI(Claude Code)가 자신의 추론/행동 루프를 이 언어로 표현한다.
// agent_create → agent_add_tool → agent_loop → 목표 달성
//
// 이전 Phase들(HTTP/Shell/File/Data/Collection)이 모두 "도구"가 되고,
// Phase 15가 그것들을 조율하는 실행 모델이 된다.

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
export function createAgentModule() {
  return {
    // ── Agent Lifecycle ──────────────────────────────────────

    // agent_create name -> AgentState
    "agent_create": (name: string): AgentState => ({
      name,
      state: {},
      history: [],
      tools: {},
      steps: 0,
      status: "running",
    }),

    // agent_set agent key value -> AgentState (immutable update)
    "agent_set": (agent: AgentState, key: string, value: any): AgentState => ({
      ...agent,
      state: { ...agent.state, [key]: value },
    }),

    // agent_get agent key -> any
    "agent_get": (agent: AgentState, key: string): any => {
      return agent.state[key] ?? null;
    },

    // agent_update agent updates -> AgentState (merge multiple keys)
    "agent_update": (agent: AgentState, updates: Record<string, any>): AgentState => ({
      ...agent,
      state: { ...agent.state, ...updates },
    }),

    // agent_steps agent -> number
    "agent_steps": (agent: AgentState): number => agent.steps,

    // agent_status agent -> string
    "agent_status": (agent: AgentState): string => agent.status,

    // agent_done agent -> boolean
    "agent_done": (agent: AgentState): boolean =>
      agent.status === "done" || agent.status === "error" || agent.status === "max_steps",

    // ── Tool Registry ────────────────────────────────────────

    // agent_add_tool agent toolName fn -> AgentState
    "agent_add_tool": (agent: AgentState, toolName: string, fn: (...args: any[]) => any): AgentState => ({
      ...agent,
      tools: { ...agent.tools, [toolName]: fn },
    }),

    // agent_call_tool agent toolName ...args -> any
    "agent_call_tool": (agent: AgentState, toolName: string, ...args: any[]): any => {
      const tool = agent.tools[toolName];
      if (!tool) throw new Error(`Tool not found: "${toolName}". Available: ${Object.keys(agent.tools).join(", ")}`);
      return tool(...args);
    },

    // agent_tools agent -> [string] (list registered tool names)
    "agent_tools": (agent: AgentState): string[] => Object.keys(agent.tools),

    // ── History ──────────────────────────────────────────────

    // agent_push_history agent entry -> AgentState
    "agent_push_history": (agent: AgentState, entry: Omit<AgentHistoryEntry, "step" | "timestamp">): AgentState => ({
      ...agent,
      history: [...agent.history, { ...entry, step: agent.steps, timestamp: Date.now() }],
    }),

    // agent_history agent -> [AgentHistoryEntry]
    "agent_history": (agent: AgentState): AgentHistoryEntry[] => agent.history,

    // agent_history_last agent n -> [AgentHistoryEntry] (last n entries)
    "agent_history_last": (agent: AgentState, n: number): AgentHistoryEntry[] =>
      agent.history.slice(-n),

    // agent_history_type agent type -> [AgentHistoryEntry] (filter by type)
    "agent_history_type": (agent: AgentState, type: string): AgentHistoryEntry[] =>
      agent.history.filter(e => e.type === type),

    // ── Loop Execution ───────────────────────────────────────

    // agent_loop agent goalFn stepFn maxSteps -> AgentState
    // goalFn(state) -> boolean: return true to stop
    // stepFn(agent) -> AgentState: perform one step, return updated agent
    "agent_loop": (
      agent: AgentState,
      goalFn: (state: Record<string, any>) => boolean,
      stepFn: (agent: AgentState) => AgentState,
      maxSteps: number
    ): AgentState => {
      let cur = agent;
      while (cur.steps < maxSteps) {
        if (goalFn(cur.state)) {
          return { ...cur, status: "done" };
        }
        try {
          cur = stepFn({ ...cur, steps: cur.steps + 1 });
        } catch (err: any) {
          return {
            ...cur,
            status: "error",
            state: { ...cur.state, _error: err.message },
          };
        }
      }
      return { ...cur, status: "max_steps" };
    },

    // agent_run_until state condition action maxSteps -> final_state
    // Simpler version: just a value + condition + transform loop
    "agent_run_until": (
      state: any,
      condition: (s: any) => boolean,
      action: (s: any) => any,
      maxSteps: number
    ): any => {
      let cur = state;
      let steps = 0;
      while (!condition(cur) && steps < maxSteps) {
        cur = action(cur);
        steps++;
      }
      return cur;
    },

    // ── Plan Tracking ─────────────────────────────────────────

    // plan_create steps -> Plan
    "plan_create": (steps: string[]): Plan => ({
      steps,
      current: 0,
      done: false,
      results: {},
    }),

    // plan_next plan -> string | null (current step or null if done)
    "plan_next": (plan: Plan): string | null => {
      if (plan.done || plan.current >= plan.steps.length) return null;
      return plan.steps[plan.current];
    },

    // plan_advance plan result -> Plan (mark current step done, move to next)
    "plan_advance": (plan: Plan, result: any): Plan => {
      const step = plan.steps[plan.current];
      const newCurrent = plan.current + 1;
      return {
        ...plan,
        current: newCurrent,
        done: newCurrent >= plan.steps.length,
        results: { ...plan.results, [step]: result },
      };
    },

    // plan_done plan -> boolean
    "plan_done": (plan: Plan): boolean => plan.done || plan.current >= plan.steps.length,

    // plan_progress plan -> number (0.0 - 1.0)
    "plan_progress": (plan: Plan): number => {
      if (plan.steps.length === 0) return 1;
      return plan.current / plan.steps.length;
    },

    // plan_results plan -> {step: result}
    "plan_results": (plan: Plan): Record<string, any> => plan.results,

    // ── Observation / Context ────────────────────────────────

    // observe key value context -> context (accumulate observations)
    "observe": (key: string, value: any, context: Record<string, any>): Record<string, any> => ({
      ...context,
      [key]: value,
    }),

    // summarize context -> string (human/AI readable summary of context)
    "summarize": (context: Record<string, any>): string => {
      return Object.entries(context)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join("\n");
    },

    // context_create -> {} (empty context)
    "context_create": (): Record<string, any> => ({}),

    // context_merge ctx1 ctx2 -> context
    "context_merge": (ctx1: Record<string, any>, ctx2: Record<string, any>): Record<string, any> => ({
      ...ctx1,
      ...ctx2,
    }),
  };
}
