import { Uncertain } from './maybe-type';
export declare function maybeMap<T, U>(m: Uncertain<T>, fn: (v: T) => U): Uncertain<U>;
export declare function maybeBind<T, U>(m: Uncertain<T>, fn: (v: T) => Uncertain<U>): Uncertain<U>;
export declare function maybeChain<T>(maybes: Uncertain<T>[], fn: (...values: T[]) => T): Uncertain<T>;
export declare function maybeFilter<T>(m: Uncertain<T>, pred: (v: T) => boolean): Uncertain<T>;
export declare function maybeCombine<A, B, C>(a: Uncertain<A>, b: Uncertain<B>, fn: (a: A, b: B) => C): Uncertain<C>;
export declare function maybeSelect<T>(maybes: Uncertain<T>[]): Uncertain<T>;
type CallFnValue = (fnValue: any, args: any[]) => any;
export declare function createMaybeChainModule(callFunctionValue?: CallFnValue): Record<string, Function>;
export {};
//# sourceMappingURL=maybe-chain.d.ts.map