// FreeLang v9: Async Standard Library
// Phase 23: Async/await primitives - promise creation, awaiting, and composition

import { FreeLangPromise, resolvedPromise, rejectedPromise } from "./async-runtime";

type CallFn = (name: string, args: any[]) => any;

/**
 * Create the async module for FreeLang v9
 * Provides: async_call, await_result, promise_all, promise_race,
 *           promise_delay, promise_timeout
 */
export function createAsyncModule(callFn: CallFn) {
  return {
    // async_call fn_name args -> Promise
    // Call a function asynchronously and return a promise
    "async_call": (fnName: string, args: any[] = []): FreeLangPromise => {
      return new FreeLangPromise((resolve, reject) => {
        setImmediate(() => {
          try {
            const result = callFn(fnName, args);
            resolve(result);
          } catch (e: any) {
            reject(new Error(`async_call error: ${e.message}`));
          }
        });
      });
    },

    // await_result promise -> value|error
    // Wait for a promise to resolve and get its value
    "await_result": (promise: FreeLangPromise): any => {
      const state = promise.getState();
      if (state === "resolved") {
        return promise.getValue();
      } else if (state === "rejected") {
        throw promise.getError() || new Error("Promise rejected");
      } else {
        // Still pending - throw error (should use real async/await in practice)
        throw new Error("Promise still pending - use proper async handling");
      }
    },

    // promise_all promises -> Promise
    // Wait for all promises to resolve
    "promise_all": (promises: FreeLangPromise[]): FreeLangPromise => {
      return new FreeLangPromise((resolve, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          resolve([]);
          return;
        }

        const results: any[] = [];
        let completed = 0;

        promises.forEach((p, idx) => {
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_all: element ${idx} is not a promise`));
            return;
          }

          const state = p.getState();
          if (state === "resolved") {
            results[idx] = p.getValue();
            completed++;
            if (completed === promises.length) resolve(results);
          } else if (state === "rejected") {
            reject(p.getError() || new Error(`promise_all: promise ${idx} rejected`));
          } else {
            // For pending promises, we'd need proper async handling
            reject(new Error(`promise_all: promise ${idx} still pending`));
          }
        });
      });
    },

    // promise_race promises -> Promise
    // Return first resolved promise
    "promise_race": (promises: FreeLangPromise[]): FreeLangPromise => {
      return new FreeLangPromise((resolve, reject) => {
        if (!Array.isArray(promises) || promises.length === 0) {
          reject(new Error("promise_race: empty promise array"));
          return;
        }

        for (let i = 0; i < promises.length; i++) {
          const p = promises[i];
          if (!(p instanceof FreeLangPromise)) {
            reject(new Error(`promise_race: element ${i} is not a promise`));
            return;
          }

          const state = p.getState();
          if (state === "resolved") {
            resolve(p.getValue());
            return;
          } else if (state === "rejected") {
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
    "promise_delay": (ms: number): FreeLangPromise => {
      return new FreeLangPromise((resolve) => {
        setTimeout(() => resolve(null), ms);
      });
    },

    // promise_timeout ms fn_name args -> Promise
    // Call function with timeout
    "promise_timeout": (ms: number, fnName: string, args: any[] = []): FreeLangPromise => {
      return new FreeLangPromise((resolve, reject) => {
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
        } catch (e: any) {
          done = true;
          clearTimeout(timeout);
          reject(new Error(`promise_timeout: ${e.message}`));
        }
      });
    },

    // promise_resolve value -> Promise
    // Create immediately resolved promise
    "promise_resolve": (value: any): FreeLangPromise => {
      return resolvedPromise(value);
    },

    // promise_reject error -> Promise
    // Create immediately rejected promise
    "promise_reject": (error: any): FreeLangPromise => {
      const err = error instanceof Error ? error : new Error(String(error));
      return rejectedPromise(err);
    },

    // promise_state promise -> "pending"|"resolved"|"rejected"
    // Get promise state
    "promise_state": (promise: FreeLangPromise): string => {
      if (!(promise instanceof FreeLangPromise)) {
        return "unknown";
      }
      return promise.getState();
    },

    // promise_then promise fn_name -> Promise
    // Chain promise with handler function
    "promise_then": (promise: FreeLangPromise, fnName: string): FreeLangPromise => {
      if (!(promise instanceof FreeLangPromise)) {
        return rejectedPromise(new Error("promise_then: first arg is not a promise"));
      }

      return promise.then((value) => {
        try {
          return callFn(fnName, [value]);
        } catch (e: any) {
          throw new Error(`promise_then handler error: ${e.message}`);
        }
      });
    },
  };
}
