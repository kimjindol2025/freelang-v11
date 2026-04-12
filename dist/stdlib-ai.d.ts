import { Maybe, None, Uncertain, maybe, none, confident, mostLikely } from './maybe-type';
import { ChainOfThought, ThoughtStep, CoTResult } from './cot';
import { TreeOfThought, ThoughtBranch, ToTResult } from './tot';
import { Reflector, ReflectionCriteria, ReflectionResult } from './reflect';
import { ContextManager, ContextEntry, ContextStrategy } from './context-window';
import { ok, err, isOk, isErr, unwrapOr, Result, Ok, Err, ErrorCategory } from './result-type';
import { AIErrorSystem, RecoveryStrategy } from './error-system';
import { ToolRegistry, ToolDefinition, ToolResult } from './tool-registry';
import { FLAgent, AgentOptions, AgentState, AgentAction } from './agent';
import { SelfImprover, SelfImproveConfig, SelfImproveState } from './self-improve';
export type MaybeValue<T> = Maybe<T> | None;
export declare const defaultCriteria: ReflectionCriteria[];
export declare class AISession {
    cot: ChainOfThought;
    tot: TreeOfThought;
    reflector: Reflector;
    context: ContextManager;
    tools: ToolRegistry;
    private results;
    constructor(options?: {
        maxTokens?: number;
        goal?: string;
    });
    store(key: string, value: any): void;
    recall(key: string): any;
    summary(): string;
}
export declare class AIWorkflow {
    private steps;
    private results;
    step(fn: () => any): AIWorkflow;
    run(): Promise<any[]>;
    last(): any;
}
export declare function quickReason(goal: string, steps: string[]): string;
export declare function quickReflect(output: any, threshold?: number): {
    passed: boolean;
    score: number;
    feedback: string[];
};
export declare function quickMaybe<T>(value: T, confidence: number): MaybeValue<T>;
export declare const AIStdLib: {
    session: (opts?: {
        maxTokens?: number;
        goal?: string;
    }) => AISession;
    workflow: () => AIWorkflow;
    cot: (_goal?: string) => ChainOfThought;
    tot: (_goal?: string) => TreeOfThought;
    reflect: () => Reflector;
    context: (maxTokens: number) => ContextManager;
    tools: () => ToolRegistry;
    agent: (goal: string, maxSteps: number) => FLAgent;
    improve: <T>(config: SelfImproveConfig<T>) => SelfImprover<T>;
    ok: typeof ok;
    err: typeof err;
    isOk: typeof isOk;
    isErr: typeof isErr;
    unwrapOr: typeof unwrapOr;
    maybe: typeof maybe;
    none: typeof none;
    confident: typeof confident;
    mostLikely: typeof mostLikely;
    errorSystem: () => AIErrorSystem;
    quickReason: typeof quickReason;
    quickReflect: typeof quickReflect;
    quickMaybe: typeof quickMaybe;
};
export default AIStdLib;
export type { Maybe, None, Uncertain, ThoughtStep, CoTResult, ThoughtBranch, ToTResult, ReflectionCriteria, ReflectionResult, ContextEntry, ContextStrategy, Result, Ok, Err, ErrorCategory, RecoveryStrategy, ToolDefinition, ToolResult, AgentOptions, AgentState, AgentAction, SelfImproveConfig, SelfImproveState, };
//# sourceMappingURL=stdlib-ai.d.ts.map