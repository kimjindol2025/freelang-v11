import { FreeLangPromise } from "./async-runtime";
type CallFn = (name: string, args: any[]) => any;
/**
 * Create the async module for FreeLang v9
 * Provides: async_call, await_result, promise_all, promise_race,
 *           promise_delay, promise_timeout
 */
export declare function createAsyncModule(callFn: CallFn): {
    async_call: (fnName: string, args?: any[]) => FreeLangPromise;
    await_result: (promise: FreeLangPromise) => any;
    promise_all: (promises: FreeLangPromise[]) => FreeLangPromise;
    promise_race: (promises: FreeLangPromise[]) => FreeLangPromise;
    promise_delay: (ms: number) => FreeLangPromise;
    promise_timeout: (ms: number, fnName: string, args?: any[]) => FreeLangPromise;
    promise_resolve: (value: any) => FreeLangPromise;
    promise_reject: (error: any) => FreeLangPromise;
    promise_state: (promise: FreeLangPromise) => string;
    promise_then: (promise: FreeLangPromise, fnName: string) => FreeLangPromise;
};
export {};
//# sourceMappingURL=stdlib-async.d.ts.map