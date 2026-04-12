export interface SelfImproveState<T> {
    iteration: number;
    current: T;
    score: number;
    history: Array<{
        iteration: number;
        value: T;
        score: number;
        improvement: string;
    }>;
    done: boolean;
    reason: string;
}
export interface SelfImproveConfig<T> {
    target: T;
    evaluate: (v: T) => number;
    improve: (v: T, score: number, history: SelfImproveState<T>['history']) => {
        value: T;
        improvement: string;
    };
    maxIterations?: number;
    stopWhen?: (score: number, iteration: number) => boolean;
    minImprovement?: number;
}
export declare class SelfImprover<T> {
    private state;
    private config;
    constructor(config: SelfImproveConfig<T>);
    step(): SelfImproveState<T>;
    run(): SelfImproveState<T>;
    getState(): SelfImproveState<T>;
    toMarkdown(): string;
}
export declare function createSelfImprover<T>(config: SelfImproveConfig<T>): SelfImprover<T>;
//# sourceMappingURL=self-improve.d.ts.map