export interface ChainAgent {
    id: string;
    transform: (input: any) => any;
    validate?: (output: any) => boolean;
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
export declare class AgentChain {
    private agents;
    add(agent: ChainAgent): AgentChain;
    run(initialInput: any): ChainResult;
    static from(agents: ChainAgent[]): AgentChain;
    length(): number;
}
export declare const globalChain: AgentChain;
//# sourceMappingURL=chain-agents.d.ts.map