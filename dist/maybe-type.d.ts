export interface Maybe<T> {
    readonly _tag: 'Maybe';
    readonly value: T;
    readonly confidence: number;
    readonly reason?: string;
}
export interface None {
    readonly _tag: 'None';
    readonly reason?: string;
}
export type Uncertain<T> = Maybe<T> | None;
export declare function maybe<T>(confidence: number, value: T, reason?: string): Maybe<T>;
export declare function none(reason?: string): None;
export declare function isMaybe(v: any): v is Maybe<any>;
export declare function isNone(v: any): v is None;
/**
 * threshold 이상이면 값 반환, 아니면 null
 * default threshold = 0.5
 */
export declare function confident<T>(v: Uncertain<T>, threshold?: number): T | null;
/**
 * 가장 높은 confidence를 가진 Maybe 선택
 * 빈 배열이면 none() 반환
 */
export declare function mostLikely<T>(options: Maybe<T>[]): Maybe<T> | None;
/**
 * confidence >= threshold일 때만 fn 실행, 아니면 null
 */
export declare function whenConfident<T, R>(v: Uncertain<T>, threshold: number, fn: (value: T) => R): R | null;
/**
 * 두 Uncertain 값을 fn으로 조합
 * 확률은 곱셈 (독립 사건 가정)
 */
export declare function combine<T>(a: Uncertain<T>, b: Uncertain<T>, fn: (a: T, b: T) => T): Uncertain<T>;
type CallFnValue = (fnValue: any, args: any[]) => any;
type CallUserFn = (name: string, args: any[]) => any;
/**
 * stdlib-loader.ts에서 registerModule()로 등록할 함수 맵
 * callFunctionValue: FL function-value (fn [...] ...) 호출 콜백
 * callUserFunction: FL 이름 기반 함수 호출 콜백 ("+", "concat" 등)
 */
export declare function createMaybeModule(callFunctionValue?: CallFnValue, callUserFunction?: CallUserFn): Record<string, Function>;
export {};
//# sourceMappingURL=maybe-type.d.ts.map