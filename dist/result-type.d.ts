export declare enum ErrorCategory {
    TYPE_ERROR = "type-error",
    RUNTIME_ERROR = "runtime-error",
    NOT_FOUND = "not-found",
    ARITY = "arity-error",
    IO = "io-error",
    AI = "ai-error",
    USER = "user-error",
    TIMEOUT = "timeout"
}
export interface Ok<T> {
    readonly _tag: 'Ok';
    readonly value: T;
}
export interface Err {
    readonly _tag: 'Err';
    readonly code: string;
    readonly message: string;
    readonly category: ErrorCategory;
    readonly context?: Record<string, any>;
    readonly hint?: string;
    readonly recoverable: boolean;
}
export type Result<T> = Ok<T> | Err;
export declare function ok<T>(value: T): Ok<T>;
export declare function err(code: string, message: string, opts?: {
    category?: ErrorCategory;
    context?: Record<string, any>;
    hint?: string;
    recoverable?: boolean;
}): Err;
export declare function isOk<T>(r: Result<T>): r is Ok<T>;
export declare function isErr<T>(r: Result<T>): r is Err;
export declare function unwrap<T>(r: Result<T>): T;
export declare function unwrapOr<T>(r: Result<T>, defaultValue: T): T;
export declare function mapOk<T, U>(r: Result<T>, fn: (v: T) => U): Result<U>;
export declare function mapErr<T>(r: Result<T>, fn: (e: Err) => Err): Result<T>;
export declare function flatMap<T, U>(r: Result<T>, fn: (v: T) => Result<U>): Result<U>;
export declare function recover<T>(r: Result<T>, fn: (e: Err) => T): T;
export declare function fromThrown(e: unknown, code?: string): Err;
//# sourceMappingURL=result-type.d.ts.map