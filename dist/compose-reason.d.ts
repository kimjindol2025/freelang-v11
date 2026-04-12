export type ReasonStep = {
    name: string;
    fn: (input: any, context: ReasonContext) => any;
    condition?: (input: any, context: ReasonContext) => boolean;
    onError?: (e: Error, input: any) => any;
};
export interface ReasonContext {
    step: number;
    history: Array<{
        name: string;
        input: any;
        output: any;
        duration: number;
    }>;
    store: Map<string, any>;
}
export interface ComposeResult {
    output: any;
    steps: number;
    history: ReasonContext['history'];
    success: boolean;
    duration: number;
}
export declare class ReasonComposer {
    compose(steps: ReasonStep[], input: any): ComposeResult;
    pipeline(): PipelineBuilder;
}
export declare class PipelineBuilder {
    private steps;
    private composer;
    constructor(composer: ReasonComposer);
    step(name: string, fn: ReasonStep['fn'], options?: {
        condition?: ReasonStep['condition'];
        onError?: ReasonStep['onError'];
    }): PipelineBuilder;
    run(input: any): ComposeResult;
    stepCount(): number;
}
export declare const globalComposer: ReasonComposer;
//# sourceMappingURL=compose-reason.d.ts.map