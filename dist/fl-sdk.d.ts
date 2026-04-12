export interface FLSDKConfig {
    version: string;
    features: string[];
}
export interface FLCodeBlock {
    type: 'expression' | 'block' | 'program';
    code: string;
    description?: string;
}
export interface FLExecuteResult {
    success: boolean;
    output: any;
    error?: string;
    executionMs: number;
}
export declare class FLCodeBuilder {
    private lines;
    define(name: string, value: string): FLCodeBuilder;
    defn(name: string, params: string[], body: string): FLCodeBuilder;
    call(fn: string, ...args: string[]): FLCodeBuilder;
    cot(goal: string, steps: string[]): FLCodeBuilder;
    agent(goal: string, maxSteps?: number): FLCodeBuilder;
    maybe(confidence: number, value: string): FLCodeBuilder;
    result(type: 'ok' | 'err', value: string, errCode?: string): FLCodeBuilder;
    pipe(...fns: string[]): FLCodeBuilder;
    comment(text: string): FLCodeBuilder;
    build(): string;
    reset(): FLCodeBuilder;
    lineCount(): number;
}
export declare class FLSDK {
    readonly version: string;
    readonly features: string[];
    builder(): FLCodeBuilder;
    block(type: FLCodeBlock['type'], code: string, description?: string): FLCodeBlock;
    supports(feature: string): boolean;
    validate(code: string): {
        valid: boolean;
        errors: string[];
    };
    snippet(concept: string): string;
    getConfig(): FLSDKConfig;
}
export declare const sdk: FLSDK;
export default sdk;
//# sourceMappingURL=fl-sdk.d.ts.map