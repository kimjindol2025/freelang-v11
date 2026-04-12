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
export declare class DelegationManager {
    private agents;
    register(agent: DelegateAgent): void;
    findCapable(capability: string): DelegateAgent[];
    delegate(task: DelegateTask): DelegateResult;
    delegateAll(tasks: DelegateTask[]): DelegationResult;
    list(): string[];
    size(): number;
}
export declare const globalDelegation: DelegationManager;
//# sourceMappingURL=delegate.d.ts.map