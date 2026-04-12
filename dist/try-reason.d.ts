export type AttemptResult<T> = {
    success: true;
    value: T;
    attempt: number;
    strategy: string;
} | {
    success: false;
    error: string;
    attempt: number;
    strategy: string;
};
export interface TryReasonConfig<T> {
    attempts: Array<{
        strategy: string;
        fn: () => T | Promise<T>;
        validate?: (v: T) => boolean;
    }>;
    onSuccess?: (result: T, strategy: string, attemptNum: number) => void;
    onAllFail?: (errors: string[]) => T;
}
export declare class TryReasoner<T> {
    private history;
    run(config: TryReasonConfig<T>): Promise<T>;
    getHistory(): AttemptResult<T>[];
    lastSuccess(): AttemptResult<T> | null;
    reset(): void;
}
export declare function tryReasonSync<T>(config: Omit<TryReasonConfig<T>, 'attempts'> & {
    attempts: Array<{
        strategy: string;
        fn: () => T;
        validate?: (v: T) => boolean;
    }>;
}): T;
export declare function tryReasonBuiltin(attempts: Array<[string, () => any]>): Promise<any>;
export declare function tryWithFallback<T>(fn: () => T | Promise<T>, fallback: T): Promise<T>;
//# sourceMappingURL=try-reason.d.ts.map