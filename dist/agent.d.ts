export interface AgentState {
    goal: string;
    step: number;
    maxSteps: number;
    memory: Record<string, any>;
    history: AgentAction[];
    done: boolean;
    result?: any;
}
export interface AgentAction {
    step: number;
    thought: string;
    action: string;
    observation: any;
}
export interface AgentOptions {
    goal: string;
    maxSteps?: number;
    tools?: string[];
    onStep?: (state: AgentState) => void;
    stopWhen?: (state: AgentState) => boolean;
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
export declare class FLAgent {
    private state;
    private options;
    private stepFunctions;
    private stepCursor;
    constructor(opts: AgentOptions);
    /**
     * 단계 등록 — 나중에 run()에서 순서대로 실행
     * @param thought 이 단계에서의 추론 설명
     * @param actionFn 실행할 함수. 반환값이 observation이 됨.
     */
    step(thought: string, actionFn: (state: AgentState) => any): this;
    /**
     * 에이전트 루프 실행
     * @param stepFn 각 스텝에서 호출되는 함수.
     *   AgentAction을 반환하면 history에 추가, null 반환하면 루프 종료.
     *   step()으로 등록된 함수가 있으면 순서대로 실행.
     */
    run(stepFn?: (state: AgentState) => AgentAction | null): AgentState;
    /**
     * 현재 상태 반환
     */
    getState(): AgentState;
    /**
     * 완료 여부 확인
     */
    isDone(): boolean;
    /**
     * 결과값 설정 + 완료 처리
     */
    setResult(v: any): void;
    /**
     * 실행 이력 마크다운 시각화
     */
    toMarkdown(): string;
}
/** 새 에이전트 생성 */
export declare function agentNew(opts: AgentOptions): FLAgent;
/** 에이전트 루프 실행 */
export declare function agentRun(agent: FLAgent, stepFn?: (state: AgentState) => AgentAction | null): AgentState;
/** 완료 여부 */
export declare function agentDone(agent: FLAgent): boolean;
/** 최종 결과값 반환 */
export declare function agentResult(agent: FLAgent): any;
/** 실행 이력 반환 */
export declare function agentHistory(agent: FLAgent): AgentAction[];
/** 에이전트 상태를 통해 메모리에서 값 가져오기 */
export declare function getMemory(state: AgentState, key: string, defaultVal?: any): any;
/** 에이전트 상태 통해 메모리에 값 저장 */
export declare function setMemory(state: AgentState, key: string, value: any): void;
/** 에이전트 완료 표시 (done=true, result 설정) */
export declare function agentDoneSignal(state: AgentState, result: any): AgentState;
/** 에이전트 계속 진행 표시 */
export declare function agentContinue(state: AgentState): AgentState;
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
export declare function evalAgentBlock(fields: Map<string, any>, evalFn: (node: any) => any, callFnVal: (fn: any, args: any[]) => any): AgentState;
/**
 * createAgentBuiltins — FL 인터프리터에 등록할 에이전트 관련 빌트인 함수
 */
export declare function createAgentBuiltins(interp: {
    callFunctionValue: (fn: any, args: any[]) => any;
}): Record<string, (...args: any[]) => any>;
//# sourceMappingURL=agent.d.ts.map