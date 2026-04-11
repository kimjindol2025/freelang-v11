"use strict";
// FreeLang v9: Async Standard Library
// Phase 23: Async/await primitives - promise creation, awaiting, and composition
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAsyncModule = createAsyncModule;
const async_runtime_1 = require("./async-runtime");
/**
 * Create the async module for FreeLang v9
 * Provides: async_call, await_result, promise_all, promise_race,
 *           promise_delay, promise_timeout
 */
function createAsyncModule(callFn) {
    return {
        // async_call fn_name args -> Promise
        // Call a function asynchronously and return a promise
        "async_call": (fnName, args = []) => {
            return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                setImmediate(() => {
                    try {
                        const result = callFn(fnName, args);
                        resolve(result);
                    }
                    catch (e) {
                        reject(new Error(`async_call error: ${e.message}`));
                    }
                });
            });
        },
        // await_result promise -> value|error
        // Wait for a promise to resolve and get its value
        "await_result": (promise) => {
            const state = promise.getState();
            if (state === "resolved") {
                return promise.getValue();
            }
            else if (state === "rejected") {
                throw promise.getError() || new Error("Promise rejected");
            }
            else {
                // Still pending - throw error (should use real async/await in practice)
                throw new Error("Promise still pending - use proper async handling");
            }
        },
        // promise_all promises -> Promise
        // Wait for all promises to resolve
        "promise_all": (promises) => {
            return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                if (!Array.isArray(promises) || promises.length === 0) {
                    resolve([]);
                    return;
                }
                const results = [];
                let completed = 0;
                promises.forEach((p, idx) => {
                    if (!(p instanceof async_runtime_1.FreeLangPromise)) {
                        reject(new Error(`promise_all: element ${idx} is not a promise`));
                        return;
                    }
                    const state = p.getState();
                    if (state === "resolved") {
                        results[idx] = p.getValue();
                        completed++;
                        if (completed === promises.length)
                            resolve(results);
                    }
                    else if (state === "rejected") {
                        reject(p.getError() || new Error(`promise_all: promise ${idx} rejected`));
                    }
                    else {
                        // For pending promises, we'd need proper async handling
                        reject(new Error(`promise_all: promise ${idx} still pending`));
                    }
                });
            });
        },
        // promise_race promises -> Promise
        // Return first resolved promise
        "promise_race": (promises) => {
            return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                if (!Array.isArray(promises) || promises.length === 0) {
                    reject(new Error("promise_race: empty promise array"));
                    return;
                }
                for (let i = 0; i < promises.length; i++) {
                    const p = promises[i];
                    if (!(p instanceof async_runtime_1.FreeLangPromise)) {
                        reject(new Error(`promise_race: element ${i} is not a promise`));
                        return;
                    }
                    const state = p.getState();
                    if (state === "resolved") {
                        resolve(p.getValue());
                        return;
                    }
                    else if (state === "rejected") {
                        reject(p.getError() || new Error(`promise_race: promise ${i} rejected`));
                        return;
                    }
                }
                // All pending
                reject(new Error("promise_race: all promises still pending"));
            });
        },
        // promise_delay ms -> Promise
        // Create a promise that resolves after delay
        "promise_delay": (ms) => {
            return new async_runtime_1.FreeLangPromise((resolve) => {
                setTimeout(() => resolve(null), ms);
            });
        },
        // promise_timeout ms fn_name args -> Promise
        // Call function with timeout
        "promise_timeout": (ms, fnName, args = []) => {
            return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                let done = false;
                const timeout = setTimeout(() => {
                    if (!done) {
                        done = true;
                        reject(new Error(`promise_timeout: timed out after ${ms}ms`));
                    }
                }, ms);
                try {
                    const result = callFn(fnName, args);
                    done = true;
                    clearTimeout(timeout);
                    resolve(result);
                }
                catch (e) {
                    done = true;
                    clearTimeout(timeout);
                    reject(new Error(`promise_timeout: ${e.message}`));
                }
            });
        },
        // promise_resolve value -> Promise
        // Create immediately resolved promise
        "promise_resolve": (value) => {
            return (0, async_runtime_1.resolvedPromise)(value);
        },
        // promise_reject error -> Promise
        // Create immediately rejected promise
        "promise_reject": (error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            return (0, async_runtime_1.rejectedPromise)(err);
        },
        // promise_state promise -> "pending"|"resolved"|"rejected"
        // Get promise state
        "promise_state": (promise) => {
            if (!(promise instanceof async_runtime_1.FreeLangPromise)) {
                return "unknown";
            }
            return promise.getState();
        },
        // promise_then promise fn_name -> Promise
        // Chain promise with handler function
        "promise_then": (promise, fnName) => {
            if (!(promise instanceof async_runtime_1.FreeLangPromise)) {
                return (0, async_runtime_1.rejectedPromise)(new Error("promise_then: first arg is not a promise"));
            }
            return promise.then((value) => {
                try {
                    return callFn(fnName, [value]);
                }
                catch (e) {
                    throw new Error(`promise_then handler error: ${e.message}`);
                }
            });
        },
    };
}
//# sourceMappingURL=stdlib-async.js.map