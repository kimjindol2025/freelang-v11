// agent.ts — FreeLang v9 Phase 98: AGENT 에이전트 루프 런타임
// AI 에이전트 루프를 언어의 기본 블록으로 구현
// 목표(goal)를 향해 반복적으로 추론하고, 도구를 사용하고, 상태를 업데이트한다.

export interface AgentState {
  goal: string;
  step: number;
  maxSteps: number;
  memory: Record<string, any>;  // 에이전트 내부 메모리
  history: AgentAction[];
  done: boolean;
  result?: any;
}

export interface AgentAction {
  step: number;
  thought: string;   // 이 단계에서의 추론
  action: string;    // 실행한 액션 (도구 이름 등)
  observation: any;  // 결과/관찰값
}

export interface AgentOptions {
  goal: string;
  maxSteps?: number;   // 기본 10
  tools?: string[];    // 사용 가능한 도구 목록
  onStep?: (state: AgentState) => void;   // 단계별 콜백
  stopWhen?: (state: AgentState) => boolean;  // 종료 조건
}

/**
 * FLAgent — AI 에이전트 루프 런타임
 *
 * 사용 예:
 *   const agent = new FLAgent({ goal: "1~5 합 계산", maxSteps: 10 });
 *   agent.step("n=1 확인", (s) => s.memory["n"] || 0);
 *   const state = agent.run((s) => {
 *     const n = s.memory["n"] || 1;
 *     if (n > 5) { agent.setResult(s.memory["sum"]); return null; }
 *     s.memory["sum"] = (s.memory["sum"] || 0) + n;
 *     s.memory["n"] = n + 1;
 *     return { step: s.step, thought: `n=${n} 더하기`, action: "add", observation: s.memory["sum"] };
 *   });
 */
export class FLAgent {
  private state: AgentState;
  private options: AgentOptions;
  // 미리 등록된 단계 함수 목록 (step() 메서드로 추가)
  private stepFunctions: Array<{ thought: string; fn: (state: AgentState) => any }> = [];
  private stepCursor = 0;

  constructor(opts: AgentOptions) {
    this.options = opts;
    this.state = {
      goal: opts.goal,
      step: 0,
      maxSteps: opts.maxSteps ?? 10,
      memory: {},
      history: [],
      done: false,
    };
  }

  /**
   * 단계 등록 — 나중에 run()에서 순서대로 실행
   * @param thought 이 단계에서의 추론 설명
   * @param actionFn 실행할 함수. 반환값이 observation이 됨.
   */
  step(thought: string, actionFn: (state: AgentState) => any): this {
    this.stepFunctions.push({ thought, fn: actionFn });
    return this;
  }

  /**
   * 에이전트 루프 실행
   * @param stepFn 각 스텝에서 호출되는 함수.
   *   AgentAction을 반환하면 history에 추가, null 반환하면 루프 종료.
   *   step()으로 등록된 함수가 있으면 순서대로 실행.
   */
  run(stepFn?: (state: AgentState) => AgentAction | null): AgentState {
    while (!this.state.done && this.state.step < this.state.maxSteps) {
      // stopWhen 조건 먼저 확인
      if (this.options.stopWhen && this.options.stopWhen(this.state)) {
        break;
      }

      let action: AgentAction | null = null;

      if (stepFn) {
        // 외부 stepFn 사용
        action = stepFn(this.state);
        if (action === null) break;
      } else if (this.stepCursor < this.stepFunctions.length) {
        // 등록된 stepFunctions 순서대로 실행
        const { thought, fn } = this.stepFunctions[this.stepCursor];
        const observation = fn(this.state);
        action = {
          step: this.state.step,
          thought,
          action: thought,
          observation,
        };
        this.stepCursor++;
      } else {
        break;
      }

      this.state.step++;
      this.state.history.push(action);

      // onStep 콜백
      if (this.options.onStep) {
        this.options.onStep({ ...this.state });
      }

      // stopWhen 재확인 (action 후)
      if (this.options.stopWhen && this.options.stopWhen(this.state)) {
        break;
      }
    }

    // maxSteps 초과 시 강제 종료
    if (this.state.step >= this.state.maxSteps && !this.state.done) {
      this.state.done = true;
    }

    return this.state;
  }

  /**
   * 현재 상태 반환
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * 완료 여부 확인
   */
  isDone(): boolean {
    return this.state.done;
  }

  /**
   * 결과값 설정 + 완료 처리
   */
  setResult(v: any): void {
    this.state.result = v;
    this.state.done = true;
  }

  /**
   * 실행 이력 마크다운 시각화
   */
  toMarkdown(): string {
    const lines: string[] = [`# Agent: ${this.state.goal}\n`];
    lines.push(`- **목표**: ${this.state.goal}`);
    lines.push(`- **완료**: ${this.state.done}`);
    lines.push(`- **총 단계**: ${this.state.step}`);
    if (this.state.result !== undefined) {
      lines.push(`- **결과**: ${JSON.stringify(this.state.result)}`);
    }
    lines.push("");

    for (const action of this.state.history) {
      lines.push(`## Step ${action.step + 1}: ${action.thought}`);
      lines.push(`- **액션**: ${action.action}`);
      lines.push(`- **관찰**: ${JSON.stringify(action.observation)}`);
      lines.push("");
    }

    return lines.join("\n");
  }
}

// ── 단축 헬퍼 함수 ──────────────────────────────────────────────────────────

/** 새 에이전트 생성 */
export function agentNew(opts: AgentOptions): FLAgent {
  return new FLAgent(opts);
}

/** 에이전트 루프 실행 */
export function agentRun(agent: FLAgent, stepFn?: (state: AgentState) => AgentAction | null): AgentState {
  return agent.run(stepFn);
}

/** 완료 여부 */
export function agentDone(agent: FLAgent): boolean {
  return agent.isDone();
}

/** 최종 결과값 반환 */
export function agentResult(agent: FLAgent): any {
  return agent.getState().result;
}

/** 실행 이력 반환 */
export function agentHistory(agent: FLAgent): AgentAction[] {
  return agent.getState().history;
}

/** 에이전트 상태를 통해 메모리에서 값 가져오기 */
export function getMemory(state: AgentState, key: string, defaultVal: any = null): any {
  return key in state.memory ? state.memory[key] : defaultVal;
}

/** 에이전트 상태 통해 메모리에 값 저장 */
export function setMemory(state: AgentState, key: string, value: any): void {
  state.memory[key] = value;
}

/** 에이전트 완료 표시 (done=true, result 설정) */
export function agentDoneSignal(state: AgentState, result: any): AgentState {
  state.done = true;
  state.result = result;
  return state;
}

/** 에이전트 계속 진행 표시 */
export function agentContinue(state: AgentState): AgentState {
  return state;
}

// ── FL 인터프리터 통합: AGENT 블록 평가 ─────────────────────────────────────

/**
 * evalAgentBlock — FL [AGENT ...] 블록 파서 결과를 런타임에서 실행
 *
 * FL 문법:
 *   [AGENT
 *     :goal "1부터 5까지 합 계산"
 *     :max-steps 10
 *     :tools [math str-upper]
 *     :step (fn [$state]
 *       (do
 *         (define $n (get-memory $state "n" 1))
 *         (define $sum (get-memory $state "sum" 0))
 *         (if (> $n 5)
 *           (agent-done $state $sum)
 *           (do
 *             (set-memory $state "n" (+ $n 1))
 *             (set-memory $state "sum" (+ $sum $n))
 *             (agent-continue $state)))))
 *     :stop-when (fn [$state] $state.done)]
 */
export function evalAgentBlock(
  fields: Map<string, any>,
  evalFn: (node: any) => any,
  callFnVal: (fn: any, args: any[]) => any,
): AgentState {
  // :goal
  const goalNode = fields.get("goal");
  const goal = goalNode != null ? String(evalFn(goalNode)) : "unknown";

  // :max-steps
  const maxStepsNode = fields.get("max-steps");
  const maxSteps = maxStepsNode != null ? Number(evalFn(maxStepsNode)) : 10;

  // :tools (optional, just for documentation)
  // :step — 각 단계 함수 (fn [$state] ...)
  const stepNode = fields.get("step");
  let stepFnValue: any = null;
  if (stepNode != null) {
    stepFnValue = evalFn(stepNode);
  }

  // :stop-when — 종료 조건 함수
  const stopWhenNode = fields.get("stop-when");
  let stopWhenFnValue: any = null;
  if (stopWhenNode != null) {
    stopWhenFnValue = evalFn(stopWhenNode);
  }

  // :on-step — 콜백 함수
  const onStepNode = fields.get("on-step");
  let onStepFnValue: any = null;
  if (onStepNode != null) {
    onStepFnValue = evalFn(onStepNode);
  }

  // 에이전트 생성 + 실행
  const opts: AgentOptions = {
    goal,
    maxSteps,
  };

  if (stopWhenFnValue != null) {
    opts.stopWhen = (state: AgentState) => {
      const r = callFnVal(stopWhenFnValue, [state]);
      return r === true || r === 1;
    };
  }

  if (onStepFnValue != null) {
    opts.onStep = (state: AgentState) => {
      callFnVal(onStepFnValue, [state]);
    };
  }

  const agent = new FLAgent(opts);

  // stepFn 정의
  const stepFn = stepFnValue != null
    ? (state: AgentState): AgentAction | null => {
        // FL 함수 호출 — state를 인자로 전달
        const r = callFnVal(stepFnValue, [state]);
        // done이 되면 null 반환 (루프 종료)
        if (state.done) return null;
        // AgentAction 구성
        return {
          step: state.step,
          thought: `step-${state.step}`,
          action: "fl-step",
          observation: r,
        };
      }
    : undefined;

  return agent.run(stepFn);
}

// ── FL stdlib 등록용 모듈 ────────────────────────────────────────────────────

/**
 * createAgentBuiltins — FL 인터프리터에 등록할 에이전트 관련 빌트인 함수
 */
export function createAgentBuiltins(interp: { callFunctionValue: (fn: any, args: any[]) => any }): Record<string, (...args: any[]) => any> {
  return {
    // (agent-new :goal "..." :max-steps 10)
    "agent-new": (...args: any[]): FLAgent => {
      const opts: AgentOptions = { goal: "unnamed" };
      for (let i = 0; i < args.length; i += 2) {
        const key = String(args[i]).replace(/^:/, "");
        const val = args[i + 1];
        if (key === "goal") opts.goal = String(val);
        else if (key === "max-steps") opts.maxSteps = Number(val);
        else if (key === "tools") opts.tools = Array.isArray(val) ? val.map(String) : [];
      }
      return new FLAgent(opts);
    },

    // (agent-run $agent $step-fn)
    "agent-run": (agent: FLAgent, stepFnVal?: any): AgentState => {
      if (!stepFnVal) return agent.run();
      const stepFn = (state: AgentState): AgentAction | null => {
        const r = interp.callFunctionValue(stepFnVal, [state]);
        if (state.done) return null;
        if (r === null || r === undefined) return null;
        if (typeof r === "object" && "thought" in r) return r as AgentAction;
        return {
          step: state.step,
          thought: `step-${state.step}`,
          action: "fl-step",
          observation: r,
        };
      };
      return agent.run(stepFn);
    },

    // (agent-done? $agent) → bool
    "agent-done?": (agent: FLAgent): boolean => agent.isDone(),

    // (agent-result $agent) → 최종값
    "agent-result": (agent: FLAgent): any => agent.getState().result ?? null,

    // (agent-history $agent) → 배열
    "agent-history": (agent: FLAgent): AgentAction[] => agent.getState().history,

    // (agent-state $agent) → AgentState
    "agent-state": (agent: FLAgent): AgentState => agent.getState(),

    // (agent-markdown $agent) → string
    "agent-markdown": (agent: FLAgent): string => agent.toMarkdown(),

    // (get-memory $state "key" default) → any
    "get-memory": (state: AgentState, key: string, def: any = null): any =>
      getMemory(state, key, def),

    // (set-memory $state "key" value) → void
    "set-memory": (state: AgentState, key: string, value: any): null => {
      setMemory(state, key, value);
      return null;
    },

    // (agent-done $state $result) → state (done=true, result 설정)
    "agent-done": (state: AgentState, result: any): AgentState =>
      agentDoneSignal(state, result),

    // (agent-continue $state) → state
    "agent-continue": (state: AgentState): AgentState =>
      agentContinue(state),
  };
}
