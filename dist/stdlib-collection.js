"use strict";
// FreeLang v9: Collection + Execution Control Standard Library
// Phase 14: Array ops + retry/pipeline — AI agent workflow primitives
//
// AI processes batches of data and must be resilient to failure.
// These are the core building blocks for robust agent behavior.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCollectionModule = createCollectionModule;
/**
 * Create the collection + control module for FreeLang v9
 */
function createCollectionModule() {
    return {
        // ── Array Transformation ──────────────────────────────────
        // arr_flatten arr -> [any]  (flatten one level deep)
        "arr_flatten": (arr) => {
            return arr.flat();
        },
        // arr_flatten_deep arr -> [any]  (flatten all levels)
        "arr_flatten_deep": (arr) => {
            return arr.flat(Infinity);
        },
        // arr_zip arr1 arr2 -> [[a,b]]  (zip two arrays into pairs)
        "arr_zip": (arr1, arr2) => {
            const len = Math.min(arr1.length, arr2.length);
            return Array.from({ length: len }, (_, i) => [arr1[i], arr2[i]]);
        },
        // arr_unique arr -> [any]  (deduplicate, preserves order)
        "arr_unique": (arr) => {
            return [...new Set(arr.map(x => JSON.stringify(x)))].map(x => JSON.parse(x));
        },
        // arr_chunk arr size -> [[any]]  (split into chunks of size)
        "arr_chunk": (arr, size) => {
            const result = [];
            for (let i = 0; i < arr.length; i += size)
                result.push(arr.slice(i, i + size));
            return result;
        },
        // arr_take arr n -> [any]  (first n elements)
        "arr_take": (arr, n) => arr.slice(0, n),
        // arr_drop arr n -> [any]  (all but first n elements)
        "arr_drop": (arr, n) => arr.slice(n),
        // arr_sum arr -> number
        "arr_sum": (arr) => arr.reduce((a, b) => a + b, 0),
        // arr_avg arr -> number
        "arr_avg": (arr) => {
            if (arr.length === 0)
                throw new Error("arr_avg: empty array");
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        },
        // arr_min arr -> number
        "arr_min": (arr) => Math.min(...arr),
        // arr_max arr -> number
        "arr_max": (arr) => Math.max(...arr),
        // arr_group_by arr key -> {key: [items]}  (group objects by a key)
        "arr_group_by": (arr, key) => {
            const result = {};
            for (const item of arr) {
                const k = String(item[key] ?? "__undefined__");
                if (!result[k])
                    result[k] = [];
                result[k].push(item);
            }
            return result;
        },
        // arr_sort_by arr key -> [any]  (sort objects by a key, ascending)
        "arr_sort_by": (arr, key) => {
            return [...arr].sort((a, b) => {
                const av = a[key], bv = b[key];
                if (av < bv)
                    return -1;
                if (av > bv)
                    return 1;
                return 0;
            });
        },
        // arr_sort_by_desc arr key -> [any]  (descending)
        "arr_sort_by_desc": (arr, key) => {
            return [...arr].sort((a, b) => {
                const av = a[key], bv = b[key];
                if (av > bv)
                    return -1;
                if (av < bv)
                    return 1;
                return 0;
            });
        },
        // arr_count_by arr key -> {key: count}  (count by key value)
        "arr_count_by": (arr, key) => {
            const result = {};
            for (const item of arr) {
                const k = String(item[key] ?? "__undefined__");
                result[k] = (result[k] ?? 0) + 1;
            }
            return result;
        },
        // arr_pluck arr key -> [any]  (extract field from each object)
        "arr_pluck": (arr, key) => {
            return arr.map(item => item[key]);
        },
        // arr_index_by arr key -> {key: item}  (index objects by unique key)
        "arr_index_by": (arr, key) => {
            const result = {};
            for (const item of arr)
                result[String(item[key])] = item;
            return result;
        },
        // ── Execution Control ────────────────────────────────────
        // retry n fn -> any  (call fn(), retry up to n times on error)
        "retry": (n, fn) => {
            let lastErr;
            for (let i = 0; i <= n; i++) {
                try {
                    return fn();
                }
                catch (err) {
                    lastErr = err;
                    if (i < n) {
                        // small backoff: 100ms * attempt
                        const start = Date.now();
                        while (Date.now() - start < 100 * i) { /* spin */ }
                    }
                }
            }
            throw lastErr;
        },
        // retry_silent n fn -> any|null  (retry n times, return null on final failure)
        "retry_silent": (n, fn) => {
            for (let i = 0; i <= n; i++) {
                try {
                    return fn();
                }
                catch { }
            }
            return null;
        },
        // pipeline_run initial steps -> any  (chain: output of each step → input of next)
        // steps: array of functions
        "pipeline_run": (initial, steps) => {
            return steps.reduce((acc, fn) => fn(acc), initial);
        },
        // memoize fn -> fn  (return memoized version of fn, keyed by JSON args)
        "memoize": (fn) => {
            const cache = new Map();
            return (...args) => {
                const key = JSON.stringify(args);
                if (cache.has(key))
                    return cache.get(key);
                const result = fn(...args);
                cache.set(key, result);
                return result;
            };
        },
        // once fn -> fn  (return version of fn that only executes once)
        "once": (fn) => {
            let called = false, result;
            return (...args) => {
                if (!called) {
                    called = true;
                    result = fn(...args);
                }
                return result;
            };
        },
        // tap value fn -> value  (call fn(value) for side effects, return value unchanged)
        "tap": (value, fn) => {
            fn(value);
            return value;
        },
        // ── Range / Sequence ─────────────────────────────────────
        // range start end -> [number]  (inclusive start, exclusive end)
        "range": (start, end) => {
            const result = [];
            for (let i = start; i < end; i++)
                result.push(i);
            return result;
        },
        // range_step start end step -> [number]
        "range_step": (start, end, step) => {
            const result = [];
            for (let i = start; i < end; i += step)
                result.push(i);
            return result;
        },
        // repeat n value -> [value]  (array of n copies of value)
        "repeat": (n, value) => Array(n).fill(value),
    };
}
//# sourceMappingURL=stdlib-collection.js.map