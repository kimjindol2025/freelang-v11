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
export declare class AgentChain {
    private agents;
    /** 에이전트 추가 (순서대로) */
    add(agent: ChainAgent): this;
    /** 에이전트 목록 */
    list(): string[];
    /** 파이프라인 실행 */
    run(initialInput: any): ChainResult;
    /** 에이전트 수 */
    size(): number;
    /** 체인 초기화 */
    clear(): void;
}
export declare const globalAgentChain: AgentChain;
//# sourceMappingURL=agent-chain.d.ts.map