"use strict";
// eval-builtins.ts — FreeLang v9 Built-in Functions
// Phase 57 리팩토링: interpreter.ts의 switch 문을 분리
// evalSExpr에서 args가 평가된 이후 호출됨
// Phase 69: 레이지 시퀀스 추가
Object.defineProperty(exports, "__esModule", { value: true });
exports.evalBuiltin = evalBuiltin;
const async_runtime_1 = require("./async-runtime");
const lazy_seq_1 = require("./lazy-seq");
function evalBuiltin(interp, op, args, expr) {
    // interp.eval은 public이어야 하므로 (실제로는 public)
    const ev = (node) => interp.eval(node);
    const callFn = (fn, a) => interp.callFunction(fn, a);
    const callUser = (name, a) => interp.callUserFunction(name, a);
    const callFnVal = (fn, a) => interp.callFunctionValue(fn, a);
    const toDisplay = (val) => interp.toDisplayString(val);
    switch (op) {
        // Arithmetic
        case "+":
            return args.reduce((a, b) => a + b, 0);
        case "-":
            return args.length === 1 ? -args[0] : args.reduce((a, b) => a - b);
        case "*":
            return args.reduce((a, b) => a * b, 1);
        case "/":
            return args.length === 1 ? 1 / args[0] : args.reduce((a, b) => a / b);
        case "%":
            return args[0] % args[1];
        // Comparison
        case "=":
            return args[0] === args[1];
        case "<":
            return args[0] < args[1];
        case ">":
            return args[0] > args[1];
        case "<=":
            return args[0] <= args[1];
        case ">=":
            return args[0] >= args[1];
        case "!=":
            return args[0] !== args[1];
        // Logical (evaluated versions — unevaluated short-circuit is in eval-special-forms.ts)
        case "and":
            return args.every((a) => a);
        case "or":
            return args.some((a) => a);
        case "not":
            return !args[0];
        // Output
        case "print":
            process.stdout.write(args.map((a) => toDisplay(a)).join(" "));
            return null;
        case "println":
        case "echo":
            console.log(...args.map((a) => toDisplay(a)));
            return null;
        case "print-err":
            process.stderr.write(args.map((a) => toDisplay(a)).join(" ") + "\n");
            return null;
        case "str":
            return args.map((a) => toDisplay(a)).join("");
        case "repr":
            return JSON.stringify(args[0], null, 2);
        case "inspect": {
            const inspected = toDisplay(args[0]);
            console.log(inspected);
            return args[0];
        }
        // String basic
        case "concat":
            if (!Array.isArray(args[0]))
                return args.join("");
            // fall through to array concat below
            if (!Array.isArray(args[1]))
                return args[0] || [];
            return args[0].concat(args[1]);
        case "upper":
            return args[0]?.toString().toUpperCase();
        case "lower":
            return args[0]?.toString().toLowerCase();
        case "length":
            return args[0]?.length || 0;
        // Array/Collection
        case "list":
            return args;
        case "first":
            return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : (args[0]?.[0] ?? null);
        case "rest":
            return args[0]?.slice(1);
        case "append":
            if (Array.isArray(args[0]) && args.length === 2 && Array.isArray(args[1])) {
                return [...args[0], ...args[1]];
            }
            return [...(args[0] || []), ...args.slice(1)];
        case "reverse":
            if (Array.isArray(args[0]))
                return [...args[0]].reverse();
            return [...(args[0] || [])].reverse();
        case "map": {
            const mapFn = args[0];
            const mapArr = Array.isArray(args[1]) ? args[1] : [];
            if (typeof mapFn === "function") {
                return mapArr.map(mapFn);
            }
            else if (mapFn && (mapFn.kind === "function-value" || mapFn.kind === "async-function-value")) {
                return mapArr.map((item) => callFnVal(mapFn, [item]));
            }
            return mapArr;
        }
        // Phase 7: Async functions
        case "set-timeout": {
            if (expr.args.length < 2)
                throw new Error(`set-timeout requires callback and delay`);
            const callback = ev(expr.args[0]);
            const delay = ev(expr.args[1]);
            return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (typeof callback === "function") {
                            resolve(callback());
                        }
                        else if (callback.kind === "function-value") {
                            resolve(callFnVal(callback, []));
                        }
                        else {
                            reject(new Error("set-timeout callback must be a function"));
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                }, delay);
            });
        }
        case "promise": {
            if (expr.args.length < 1)
                throw new Error(`promise requires executor function`);
            const executor = ev(expr.args[0]);
            if (executor.kind === "function-value") {
                return new async_runtime_1.FreeLangPromise((resolve, reject) => {
                    try {
                        const resolveWrapper = { kind: "builtin-function", fn: (a) => resolve(a[0]) };
                        const rejectWrapper = {
                            kind: "builtin-function",
                            fn: (a) => reject(a[0] instanceof Error ? a[0] : new Error(String(a[0]))),
                        };
                        callFnVal(executor, [resolveWrapper, rejectWrapper]);
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }
            else {
                throw new Error("promise executor must be a function");
            }
        }
        case "fn": {
            // This case shouldn't normally reach here (handled earlier), but keep as fallback
            let params = [];
            const paramNode = expr.args[0];
            if (paramNode && typeof paramNode === "object" && "kind" in paramNode && paramNode.kind === "literal" && Array.isArray(paramNode.value)) {
                params = paramNode.value.map((p) => {
                    if (p && typeof p === "object" && "kind" in p && p.kind === "variable")
                        return p.name;
                    throw new Error(`fn parameter must be a variable`);
                });
            }
            else if (paramNode && typeof paramNode === "object" && "kind" in paramNode && paramNode.kind === "variable") {
                params = [paramNode.name];
            }
            else if (Array.isArray(paramNode)) {
                params = paramNode.map((p) => (typeof p === "string" ? p : String(p)));
            }
            else {
                throw new Error(`fn expects parameter array`);
            }
            return {
                kind: "function-value",
                params,
                body: expr.args[1],
                capturedEnv: interp.context.variables.snapshot(),
            };
        }
        case "reduce": {
            // (reduce fn init arr) 또는 (reduce arr init fn) 모두 지원
            let reduceFn, accumulator, arr;
            if (Array.isArray(args[0])) {
                // 구형: (reduce arr init fn)
                arr = args[0];
                accumulator = args[1];
                reduceFn = args[2];
            }
            else {
                // 표준: (reduce fn init arr)
                reduceFn = args[0];
                accumulator = args[1];
                arr = args[2] || [];
            }
            if (!Array.isArray(arr))
                throw new Error(`reduce: 배열 인자가 필요합니다`);
            for (const item of arr) {
                accumulator = callFn(reduceFn, [accumulator, item]);
            }
            return accumulator;
        }
        // HTTP responses
        case "json-response":
            if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0]))
                return args[0];
            if (Array.isArray(args[0])) {
                const obj = {};
                for (let i = 0; i < args[0].length; i += 2) {
                    let key = args[0][i];
                    const value = args[0][i + 1];
                    if (typeof key === "string" && key.startsWith(":"))
                        key = key.substring(1);
                    if (typeof key === "string")
                        obj[key] = value;
                }
                return obj;
            }
            return args[0];
        case "html-response":
            return { html: args[0] };
        // Time
        case "now":
            return new Date().toISOString();
        case "server-uptime":
            return Date.now() - interp.context.startTime;
        // String/Character Operations
        case "char-at":
            return typeof args[0] === "string" && typeof args[1] === "number" ? args[0][Math.floor(args[1])] || "" : "";
        case "char-code":
            if (typeof args[0] === "string" && args[0].length > 0)
                return args[0].charCodeAt(0);
            throw new Error(`char-code expects non-empty string`);
        case "substring":
            return typeof args[0] === "string"
                ? args[0].substring(Math.floor(args[1] || 0), Math.floor(args[2] || args[0].length))
                : "";
        case "is-whitespace?":
            return /^\s$/.test(String(args[0]));
        case "is-digit?":
            return /^\d$/.test(String(args[0]));
        case "is-symbol?":
            return /^[a-zA-Z_\-][a-zA-Z0-9_\-?!]*$/.test(String(args[0]));
        case "split":
        case "error":
            throw new Error(String(args[0]));
        case "null?":
            return args[0] === null || args[0] === undefined;
        case "zero?":
            return args[0] === 0;
        case "pos?":
            return typeof args[0] === "number" && args[0] > 0;
        case "neg?":
            return typeof args[0] === "number" && args[0] < 0;
        case "even?":
            return typeof args[0] === "number" && args[0] % 2 === 0;
        case "odd?":
            return typeof args[0] === "number" && args[0] % 2 !== 0;
        case "string?":
            return typeof args[0] === "string";
        case "number?":
            return typeof args[0] === "number";
        case "bool?":
            return typeof args[0] === "boolean";
        case "array?":
            return Array.isArray(args[0]);
        case "map?":
            return args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]);
        case "json_keys":
            return args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]) ? Object.keys(args[0]) : [];
        case "num-to-str":
        case "num->str":
            return String(args[0]);
        case "str-to-num":
        case "str->num":
            return parseFloat(String(args[0]));
        case "map-set":
            if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
                const k = typeof args[1] === "string" && args[1].startsWith(":") ? args[1].slice(1) : String(args[1]);
                return { ...args[0], [k]: args[2] };
            }
            return args[0];
        case "slice":
            if (Array.isArray(args[0]))
                return args[0].slice(args[1], args[2]);
            if (typeof args[0] === "string")
                return args[0].slice(args[1], args[2]);
            return [];
        case "str-split":
            return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].split(args[1]) : [];
        case "join":
        case "str-join":
            return Array.isArray(args[0]) ? args[0].join(args[1] || "") : "";
        case "trim":
            return typeof args[0] === "string" ? args[0].trim() : "";
        case "uppercase":
            return typeof args[0] === "string" ? args[0].toUpperCase() : "";
        case "lowercase":
            return typeof args[0] === "string" ? args[0].toLowerCase() : "";
        case "contains?":
            if (typeof args[0] === "string" && typeof args[1] === "string")
                return args[0].includes(args[1]);
            if (Array.isArray(args[0]))
                return args[0].includes(args[1]);
            return false;
        case "starts-with?":
            return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].startsWith(args[1]) : false;
        case "ends-with?":
            return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].endsWith(args[1]) : false;
        case "index-of":
            return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].indexOf(args[1]) : -1;
        case "replace":
            return typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string"
                ? args[0].split(args[1]).join(args[2])
                : "";
        case "repeat":
            return typeof args[0] === "string" && typeof args[1] === "number" ? args[0].repeat(args[1]) : "";
        // Array Operations
        case "filter": {
            if (!Array.isArray(args[0]))
                return [];
            const filterFn = args[1];
            if (typeof filterFn === "function")
                return args[0].filter(filterFn);
            if (filterFn && filterFn.kind === "function-value") {
                return args[0].filter((item) => callFnVal(filterFn, [item]));
            }
            return args[0];
        }
        case "find":
            if (Array.isArray(args[0])) {
                const findFn = args[1];
                if (typeof findFn === "function")
                    return args[0].find(findFn) ?? null;
                if (findFn && findFn.kind === "function-value") {
                    return args[0].find((item) => callFnVal(findFn, [item])) ?? null;
                }
                return args[0].indexOf(findFn);
            }
            return -1;
        case "last":
            return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
        case "get":
            if (Array.isArray(args[0]))
                return typeof args[1] === "number" ? (args[0][args[1]] ?? null) : null;
            if (typeof args[0] === "string")
                return typeof args[1] === "number" ? (args[0][args[1]] ?? null) : null;
            if (args[0] !== null && typeof args[0] === "object")
                return args[0][args[1]] ?? null;
            return null;
        case "assoc":
            if (args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
                return { ...args[0], [args[1]]: args[2] };
            }
            return { [args[1]]: args[2] };
        case "dissoc": {
            if (args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
                const { [args[1]]: _, ...rest } = args[0];
                return rest;
            }
            return args[0] ?? {};
        }
        case "flatten": {
            if (!Array.isArray(args[0]))
                return [];
            const flatten = (arr) => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
            return flatten(args[0]);
        }
        case "unique":
            return Array.isArray(args[0]) ? [...new Set(args[0])] : [];
        case "sort":
            if (!Array.isArray(args[0]))
                return [];
            return [...args[0]].sort((a, b) => {
                if (typeof a === "number" && typeof b === "number")
                    return a - b;
                return String(a).localeCompare(String(b));
            });
        case "push":
            if (!Array.isArray(args[0]))
                return [args[1]];
            return [...args[0], args[1]];
        case "pop":
            return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
        case "shift":
            return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
        case "unshift":
            if (!Array.isArray(args[0]))
                return [args[1]];
            return [args[1], ...args[0]];
        // Type/Utility
        case "typeof":
            return typeof args[0];
        case "num":
            return Number(args[0]);
        case "bool":
            return Boolean(args[0]);
        // Math Functions
        case "abs":
            return Math.abs(args[0]);
        case "min":
            return Math.min(...args);
        case "max":
            return Math.max(...args);
        case "floor":
            return Math.floor(args[0]);
        case "ceil":
            return Math.ceil(args[0]);
        case "round":
            return Math.round(args[0]);
        case "sqrt":
            return Math.sqrt(args[0]);
        case "pow":
            return Math.pow(args[0], args[1]);
        case "log":
            return Math.log(args[0]);
        case "exp":
            return Math.exp(args[0]);
        case "sin":
            return Math.sin(args[0]);
        case "cos":
            return Math.cos(args[0]);
        case "tan":
            return Math.tan(args[0]);
        case "random":
            return Math.random();
        case "clamp":
            return Math.max(args[1], Math.min(args[2], args[0]));
        // Monad Operations
        case "ok":
            return { tag: "Ok", value: args[0], kind: "Result" };
        case "err":
            return { tag: "Err", value: args[0], kind: "Result" };
        case "some":
            return { tag: "Some", value: args[0], kind: "Option" };
        case "none":
            return { tag: "None", value: null, kind: "Option" };
        case "pure":
            return { tag: "Pure", value: args[0], kind: "Monad" };
        case "left":
            return { tag: "Left", value: args[0], kind: "Either" };
        case "right":
            return { tag: "Right", value: args[0], kind: "Either" };
        case "failure": {
            const errors = Array.isArray(args[0]) ? args[0] : [args[0]];
            return { tag: "Failure", value: errors, kind: "Validation" };
        }
        case "success":
            return { tag: "Success", value: args[0], kind: "Validation" };
        case "tell":
            return { kind: "Writer", value: null, log: String(args[0]) };
        case "return-writer":
        case "pure-writer":
            return { kind: "Writer", value: args[0], log: "" };
        case "bind": {
            if (expr.args.length < 2)
                throw new Error(`bind requires monad and transform function`);
            const monad = ev(expr.args[0]);
            const transformFn = ev(expr.args[1]);
            if (monad.kind === "Result") {
                return monad.tag === "Ok" ? callFn(transformFn, [monad.value]) : monad;
            }
            if (monad.kind === "Option") {
                return monad.tag === "Some" ? callFn(transformFn, [monad.value]) : monad;
            }
            if (Array.isArray(monad)) {
                let result = [];
                for (const item of monad) {
                    const transformed = callFn(transformFn, [item]);
                    if (Array.isArray(transformed))
                        result = result.concat(transformed);
                    else
                        result.push(transformed);
                }
                return result;
            }
            if (monad.kind === "Either") {
                return monad.tag === "Right" ? callFn(transformFn, [monad.value]) : monad;
            }
            if (monad.kind === "Validation") {
                if (monad.tag === "Success") {
                    const result = callFn(transformFn, [monad.value]);
                    if (result.kind === "Validation" && result.tag === "Failure")
                        return result;
                    return result;
                }
                return monad;
            }
            if (monad.kind === "Writer") {
                const result = callFn(transformFn, [monad.value]);
                if (result.kind === "Writer") {
                    return { kind: "Writer", value: result.value, log: monad.log + result.log };
                }
                return result;
            }
            throw new Error(`bind: unsupported monad type`);
        }
        // ── Phase 69: Lazy Sequences ──────────────────────────────────────────
        // (lazy-seq head-thunk tail-thunk) — 직접 생성 (드물게 사용)
        case "lazy-seq": {
            // args[0]: head 값, args[1]: tail 레이지 시퀀스 (이미 평가됨)
            // 사용: (lazy-seq <head-val> <tail-lazy-or-null>)
            const hVal = args[0];
            const tVal = args.length > 1 ? args[1] : null;
            return (0, lazy_seq_1.lazySeq)(() => hVal, () => (0, lazy_seq_1.isLazySeq)(tVal) ? tVal : null);
        }
        // (iterate f init) — 무한 시퀀스: init, f(init), f(f(init)), ...
        case "iterate": {
            const fn = args[0];
            const initVal = args[1];
            const applyFn = (v) => callFn(fn, [v]);
            const makeIter = (cur) => (0, lazy_seq_1.lazySeq)(() => cur, () => makeIter(applyFn(cur)));
            return makeIter(initVal);
        }
        // (range n) → lazy [0..n-1], (range start end) → lazy [start..end-1]
        case "range": {
            if (args.length === 0) {
                // 무한 자연수
                return (0, lazy_seq_1.rangeSeq)(0);
            }
            else if (args.length === 1) {
                return (0, lazy_seq_1.rangeSeq)(0, args[0]);
            }
            else {
                return (0, lazy_seq_1.rangeSeq)(args[0], args[1]);
            }
        }
        // (take n seq) — lazy or array에서 n개 꺼냄
        case "take": {
            const n = args[0];
            const seq = args[1];
            return (0, lazy_seq_1.take)(n, (0, lazy_seq_1.isLazySeq)(seq) ? seq : Array.isArray(seq) ? seq : null);
        }
        // (drop n seq) — lazy seq에서 n개 버리고 나머지 반환
        case "drop": {
            const n = args[0];
            const seq = args[1];
            if (Array.isArray(seq))
                return seq.slice(n);
            return (0, lazy_seq_1.drop)(n, (0, lazy_seq_1.isLazySeq)(seq) ? seq : null);
        }
        // (filter-lazy pred seq) — 레이지 필터
        case "filter-lazy": {
            const pred = args[0];
            const seq = args[1];
            const applyPred = (v) => Boolean(callFn(pred, [v]));
            const doFilter = (s) => {
                if (!s)
                    return null;
                // pred가 false인 앞부분 건너뜀 (eager skip)
                let cur = s;
                while (cur && !applyPred((0, lazy_seq_1.lazyHead)(cur)))
                    cur = (0, lazy_seq_1.lazyTail)(cur);
                if (!cur)
                    return null;
                const h = (0, lazy_seq_1.lazyHead)(cur);
                const t = (0, lazy_seq_1.lazyTail)(cur);
                return (0, lazy_seq_1.lazySeq)(() => h, () => doFilter(t));
            };
            return doFilter((0, lazy_seq_1.isLazySeq)(seq) ? seq : null);
        }
        // (map-lazy f seq) — 레이지 맵 (단항)
        case "map-lazy": {
            const f2 = args[0];
            const seq2 = args[1];
            const doMap = (s) => {
                if (!s)
                    return null;
                const h = (0, lazy_seq_1.lazyHead)(s);
                return (0, lazy_seq_1.lazySeq)(() => callFn(f2, [h]), () => doMap((0, lazy_seq_1.lazyTail)(s)));
            };
            return doMap((0, lazy_seq_1.isLazySeq)(seq2) ? seq2 : null);
        }
        // (take-while pred seq) — pred가 true인 동안만 꺼냄 (배열 반환)
        case "take-while": {
            const pred = args[0];
            const seq = args[1];
            if (Array.isArray(seq)) {
                const result = [];
                for (const v of seq) {
                    if (!callFn(pred, [v]))
                        break;
                    result.push(v);
                }
                return result;
            }
            const doTakeWhile = (s) => {
                const result = [];
                let cur = s;
                while (cur) {
                    const h = (0, lazy_seq_1.lazyHead)(cur);
                    if (!callFn(pred, [h]))
                        break;
                    result.push(h);
                    cur = (0, lazy_seq_1.lazyTail)(cur);
                }
                return result;
            };
            return doTakeWhile((0, lazy_seq_1.isLazySeq)(seq) ? seq : null);
        }
        // (lazy-head seq) / (lazy-tail seq) — 직접 접근
        case "lazy-head": {
            return (0, lazy_seq_1.isLazySeq)(args[0]) ? (0, lazy_seq_1.lazyHead)(args[0]) : null;
        }
        case "lazy-tail": {
            return (0, lazy_seq_1.isLazySeq)(args[0]) ? (0, lazy_seq_1.lazyTail)(args[0]) : null;
        }
        // (lazy? v) — 레이지 시퀀스 여부 확인
        case "lazy?": {
            return (0, lazy_seq_1.isLazySeq)(args[0]);
        }
        // Function call (default)
        default: {
            // Check if it's a user-defined function
            if (interp.context.functions.has(op)) {
                return callUser(op, args);
            }
            // Generic function (e.g. "identity[int]")
            const bracketMatch = op.match(/^([\w\-]+)\[([^\]]+)\]$/);
            if (bracketMatch && interp.context.functions.has(bracketMatch[1])) {
                return callUser(op, args);
            }
            // Variable containing a function value
            if (interp.context.variables.has(op)) {
                const fn = interp.context.variables.get(op);
                if (fn.kind === "builtin-function") {
                    return fn.fn(args.map((arg) => ev(arg)));
                }
                else if (typeof fn === "function" || fn.kind === "function-value") {
                    return callFn(fn, args);
                }
            }
            // (export sym1 sym2 ...) — self-hosting 파일 호환
            if (op === "export")
                return null;
            // (call $fn arg...) — FL stdlib 고차 함수용
            if (op === "call" && args.length >= 1) {
                const fnRef = ev(args[0]);
                const callArgs = args.slice(1);
                if (typeof fnRef === "string")
                    return callUser(fnRef, callArgs);
                if (typeof fnRef === "function" || fnRef?.kind === "function-value")
                    return callFn(fnRef, callArgs);
                return null;
            }
            // Phase 59: callUserFunction을 통해 FunctionNotFoundError(유사 함수 힌트 포함) 발생
            return callUser(op, args);
        }
    }
}
//# sourceMappingURL=eval-builtins.js.map