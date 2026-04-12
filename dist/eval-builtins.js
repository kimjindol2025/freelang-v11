"use strict";
// eval-builtins.ts — FreeLang v9 Built-in Functions
// Phase 57 리팩토링: interpreter.ts의 switch 문을 분리
// evalSExpr에서 args가 평가된 이후 호출됨
// Phase 69: 레이지 시퀀스 추가
// Phase 95: ContextManager (ctx-*) 추가
// Phase 96: Result 타입 + AI 에러 처리 추가
// Phase 101: 장기/단기/에피소드 메모리 시스템
// Phase 103: 멀티 에이전트 통신
// Phase 104: TRY-REASON 실패 복구 추론
// Phase 106: 자동 품질 평가 루프
// Phase 107: FL 자기 교육 시스템 (FLTutor)
// Phase 108: AI 추론 시각화 디버거
// Phase 112: maybe-chain 확률 자동 전파
// Phase 121: CONSENSUS 여러 에이전트 합의
Object.defineProperty(exports, "__esModule", { value: true });
exports.evalBuiltin = evalBuiltin;
exports.evalRefactorSelf = evalRefactorSelf;
exports.evalAlign = evalAlign;
exports.evalPredict_PHASE144 = evalPredict_PHASE144;
exports.evalCuriosity = evalCuriosity;
exports.evalEthicsCheck = evalEthicsCheck;
exports.evalWisdom = evalWisdom;
exports.evalExplain_PHASE145 = evalExplain_PHASE145;
const async_runtime_1 = require("./async-runtime");
const lazy_seq_1 = require("./lazy-seq");
const context_window_1 = require("./context-window"); // Phase 95
const result_type_1 = require("./result-type"); // Phase 96
const error_system_1 = require("./error-system"); // Phase 96
const tool_registry_1 = require("./tool-registry"); // Phase 97: Tool DSL
const memory_system_1 = require("./memory-system"); // Phase 101: Memory System
const rag_1 = require("./rag"); // Phase 102: RAG
const multi_agent_1 = require("./multi-agent"); // Phase 103: Multi-Agent
const try_reason_1 = require("./try-reason"); // Phase 104: TRY-REASON
const streaming_1 = require("./streaming"); // Phase 105: Streaming
const quality_loop_1 = require("./quality-loop"); // Phase 106: Quality Loop
const fl_tutor_1 = require("./fl-tutor"); // Phase 107: FL Self-Teaching
const reasoning_debugger_1 = require("./reasoning-debugger"); // Phase 108: Reasoning Debugger
const prompt_compiler_1 = require("./prompt-compiler"); // Phase 109: Prompt Compiler
const fl_sdk_1 = require("./fl-sdk"); // Phase 110: External AI SDK
const hypothesis_1 = require("./hypothesis"); // Phase 111: Hypothesis
const maybe_chain_1 = require("./maybe-chain"); // Phase 112: Maybe Chain
const debate_1 = require("./debate"); // Phase 113: Debate
const checkpoint_1 = require("./checkpoint"); // Phase 114: Checkpoint
const meta_reason_1 = require("./meta-reason"); // Phase 115: Meta-Reason
const belief_1 = require("./belief"); // Phase 116: Belief System
const analogy_1 = require("./analogy"); // Phase 117: Analogy
const critique_1 = require("./critique"); // Phase 118: Critique Agent
const compose_reason_1 = require("./compose-reason"); // Phase 119: Compose-Reason
const cognitive_1 = require("./cognitive"); // Phase 120: Cognitive Architecture
const consensus_1 = require("./consensus"); // Phase 121: Consensus
const delegate_1 = require("./delegate"); // Phase 122: Delegation
const negotiate_1 = require("./negotiate"); // Phase 124: Negotiate
const vote_1 = require("./vote"); // Phase 123: VOTE
const swarm_1 = require("./swarm"); // Phase 125: Swarm Intelligence
const peer_review_1 = require("./peer-review"); // Phase 127: Peer-Review
const compete_1 = require("./compete"); // Phase 129: Compete
const chain_agents_1 = require("./chain-agents"); // Phase 128: Chain-Agents
const multi_agent_hub_1 = require("./multi-agent-hub"); // Phase 130: Multi-Agent Hub
const orchestrate_1 = require("./orchestrate"); // Phase 126: Orchestrate
const evolve_1 = require("./evolve"); // Phase 131: EVOLVE
const mutate_1 = require("./mutate"); // Phase 132: Mutate
const crossover_1 = require("./crossover"); // Phase 133: Crossover
const fitness_1 = require("./fitness"); // Phase 134: FITNESS
const generation_1 = require("./generation"); // Phase 135: GENERATION
const prune_1 = require("./prune"); // Phase 136: PRUNE
const benchmark_self_1 = require("./benchmark-self"); // Phase 138: BENCHMARK-SELF
const refactor_self_1 = require("./refactor-self"); // Phase 137: REFACTOR-SELF
const version_self_1 = require("./version-self"); // Phase 139: VERSION-SELF
const self_evolution_hub_1 = require("./self-evolution-hub"); // Phase 140: SELF-EVOLUTION HUB
const align_1 = require("./align"); // Phase 146: ALIGN
const ethics_check_1 = require("./ethics-check"); // Phase 147: ETHICS-CHECK
const curiosity_1 = require("./curiosity"); // Phase 148: CURIOSITY
const wisdom_1 = require("./wisdom"); // Phase 149: WISDOM
const causal_1 = require("./causal"); // Phase 142: CAUSAL
const explain_1 = require("./explain"); // Phase 145: EXPLAIN
const world_model_1 = require("./world-model"); // Phase 141: WORLD-MODEL
const counterfactual_1 = require("./counterfactual"); // Phase 143: COUNTERFACTUAL
const predict_1 = require("./predict"); // Phase 144: PREDICT
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
        case "string->number":
        case "string-to-number":
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
        case "string_trim":
        case "str_trim":
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
        // Monad Operations — Phase 96: Result 타입으로 업그레이드 (_tag 기반)
        case "ok":
            return (0, result_type_1.ok)(args[0]);
        case "err": {
            // (err code message) / (err code message category) — Phase 96 형식
            // 하위 호환: (err value) → {_tag: "Err", code: "ERR", message: String(value)}
            if (args.length >= 2) {
                const code96 = String(args[0] ?? 'ERR');
                const message96 = String(args[1] ?? '');
                const category96 = args[2];
                return (0, result_type_1.err)(code96, message96, category96 ? { category: category96 } : undefined);
            }
            // 하위 호환: (err value) → Err
            return (0, result_type_1.err)("ERR", String(args[0] ?? ''));
        }
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
        // ── Phase 95: Context Window 관리 함수 ─────────────────────────────
        // (ctx-new max-tokens?) → ContextManager
        case "ctx-new": {
            const maxTokens = typeof args[0] === "number" ? args[0] : 4096;
            return new context_window_1.ContextManager(maxTokens);
        }
        // (ctx-add ctx content :priority p :tags [...] :tokens n) → id
        case "ctx-add": {
            const ctx = args[0];
            const content = args[1];
            const opts = {};
            for (let i = 2; i < expr.args.length - 1; i++) {
                const raw = expr.args[i];
                if (raw.kind === "keyword") {
                    const kw = raw.name;
                    const val = args[i];
                    if (kw === "priority")
                        opts.priority = Number(val);
                    else if (kw === "tags")
                        opts.tags = Array.isArray(val) ? val : [String(val)];
                    else if (kw === "tokens")
                        opts.tokens = Number(val);
                }
            }
            return ctx.add(content, opts);
        }
        // (ctx-get ctx id) → ContextEntry | undefined
        case "ctx-get": {
            const ctx = args[0];
            return ctx.get(String(args[1])) ?? null;
        }
        // (ctx-remove ctx id) → void
        case "ctx-remove": {
            const ctx = args[0];
            ctx.remove(String(args[1]));
            return null;
        }
        // (ctx-trim ctx) → removed entries
        case "ctx-trim": {
            const ctx = args[0];
            return ctx.trim();
        }
        // (ctx-stats ctx) → {used, max, percent, count}
        case "ctx-stats": {
            const ctx = args[0];
            return ctx.stats();
        }
        // (ctx-has-room? ctx tokens) → bool
        case "ctx-has-room?": {
            const ctx = args[0];
            return ctx.hasRoom(Number(args[1]));
        }
        // (ctx-all ctx) / (ctx-all ctx tag) → entries
        case "ctx-all": {
            const ctx = args[0];
            const tag = args.length > 1 ? String(args[1]) : undefined;
            return ctx.getAll(tag);
        }
        // ── Phase 96: Result 타입 추가 함수 ─────────────────────────────────────
        // (ok? result) → bool
        case "ok?":
            return (0, result_type_1.isOk)(args[0]);
        // (err? result) → bool
        case "err?":
            return (0, result_type_1.isErr)(args[0]);
        // (unwrap result) → value or throw
        case "unwrap":
            return (0, result_type_1.unwrap)(args[0]);
        // (unwrap-or result default) → value
        case "unwrap-or":
            return (0, result_type_1.unwrapOr)(args[0], args[1]);
        // (map-ok result fn) → Result
        case "map-ok": {
            const r = args[0];
            const fn = args[1];
            return (0, result_type_1.mapOk)(r, (v) => callFn(fn, [v]));
        }
        // (map-err result fn) → Result
        case "map-err": {
            const r = args[0];
            const fn = args[1];
            return (0, result_type_1.mapErr)(r, (e) => callFn(fn, [e]));
        }
        // (flat-map result fn) → Result
        case "flat-map": {
            const r = args[0];
            const fn = args[1];
            return (0, result_type_1.flatMap)(r, (v) => callFn(fn, [v]));
        }
        // (recover result fn) → value (Ok값 또는 fn(err) 반환)
        case "recover": {
            const r = args[0];
            const fn = args[1];
            return (0, result_type_1.recover)(r, (e) => callFn(fn, [e]));
        }
        // (result-explain err) → 한국어 설명 문자열
        case "result-explain": {
            const e = args[0];
            if (!(0, result_type_1.isErr)(e))
                return '(Ok 값 — 에러 없음)';
            return error_system_1.defaultErrorSystem.explain(e);
        }
        // (result-classify err-obj) → Err 구조체
        case "result-classify": {
            const raw = args[0];
            if (raw instanceof Error)
                return error_system_1.defaultErrorSystem.classify(raw);
            if (typeof raw === 'string')
                return error_system_1.defaultErrorSystem.classify(new Error(raw));
            return raw;
        }
        // Phase 101: Memory System
        // (mem-remember "key" value) — 장기 저장
        case "mem-remember": {
            const key = String(args[0]);
            const value = args[1];
            memory_system_1.globalMemory.remember(key, value, { scope: 'long-term', ttl: 'forever' });
            return null;
        }
        // (mem-remember-short "key" value ttl-ms) — 단기 저장
        case "mem-remember-short": {
            const key = String(args[0]);
            const value = args[1];
            const ttl = typeof args[2] === 'number' ? args[2] : 60000;
            memory_system_1.globalMemory.remember(key, value, { scope: 'short-term', ttl });
            return null;
        }
        // (mem-recall "key") / (mem-recall "key" fallback) — 조회
        case "mem-recall": {
            const key = String(args[0]);
            const fallback = args.length > 1 ? args[1] : null;
            return memory_system_1.globalMemory.recall(key, fallback);
        }
        // (mem-forget "key") — 삭제
        case "mem-forget": {
            const key = String(args[0]);
            return memory_system_1.globalMemory.forget(key);
        }
        // (mem-episode "id" "what") / (mem-episode "id" "what" context outcome)
        case "mem-episode": {
            const id = String(args[0]);
            const what = String(args[1]);
            const context = args[2] ?? {};
            const outcome = args[3];
            return memory_system_1.globalMemory.recordEpisode(id, what, context, outcome);
        }
        // (mem-search-episodes "query") — 에피소드 검색
        case "mem-search-episodes": {
            const query = String(args[0]);
            return memory_system_1.globalMemory.searchEpisodes(query);
        }
        // (mem-working-set value) — 작업 메모리 저장
        case "mem-working-set": {
            memory_system_1.globalMemory.setWorking(args[0]);
            return null;
        }
        // (mem-working-get) — 작업 메모리 조회
        case "mem-working-get": {
            return memory_system_1.globalMemory.getWorking();
        }
        // (mem-working-clear) — 작업 메모리 초기화
        case "mem-working-clear": {
            memory_system_1.globalMemory.clearWorking();
            return null;
        }
        // (mem-keys) / (mem-keys "scope") — 모든 키 목록
        case "mem-keys": {
            const scope = args.length > 0 ? String(args[0]) : undefined;
            return memory_system_1.globalMemory.keys(scope);
        }
        // (mem-stats) — 통계
        case "mem-stats": {
            return memory_system_1.globalMemory.stats();
        }
        // (mem-purge) — 만료 정리
        case "mem-purge": {
            return memory_system_1.globalMemory.purgeExpired();
        }
        // (mem-search-tag "tag") — 태그 검색
        case "mem-search-tag": {
            const tag = String(args[0]);
            return memory_system_1.globalMemory.searchByTag(tag);
        }
        // Phase 97: (use-tool "toolname" {key val ...}) — 도구 사용
        case "use-tool": {
            const toolName = String(args[0]);
            const toolArgs = (args[1] && typeof args[1] === 'object' && !Array.isArray(args[1]))
                ? args[1]
                : {};
            const result = tool_registry_1.globalToolRegistry.executeSync(toolName, toolArgs);
            if (!result.success)
                throw new Error(result.error || `Tool failed: ${toolName}`);
            return result.output;
        }
        // Phase 97: (list-tools) — 등록된 도구 목록
        case "list-tools": {
            return tool_registry_1.globalToolRegistry.listAll().map(t => t.name);
        }
        // Phase 102: RAG 내장 함수
        // (rag-add "id" "content") — 문서 추가
        case "rag-add": {
            const id = String(args[0]);
            const content = String(args[1]);
            const metadata = args[2] && typeof args[2] === 'object' ? args[2] : undefined;
            rag_1.globalRAG.add({ id, content, metadata });
            return true;
        }
        // (rag-retrieve "query" topK) — 검색 → 리스트
        case "rag-retrieve": {
            const query = String(args[0]);
            const topK = typeof args[1] === 'number' ? args[1] : 3;
            const results = rag_1.globalRAG.retrieve(query, topK);
            return results.map(d => ({ id: d.id, content: d.content, score: d.score ?? 0 }));
        }
        // (rag-query "query") — 검색 + 기본 augment → 문자열
        case "rag-query": {
            const query = String(args[0]);
            const topK = typeof args[1] === 'number' ? args[1] : 3;
            const result = rag_1.globalRAG.query(query, { topK });
            return result.augmented;
        }
        // (rag-size) — 문서 수
        case "rag-size": {
            return rag_1.globalRAG.size();
        }
        // (rag-remove "id") — 문서 삭제
        case "rag-remove": {
            const id = String(args[0]);
            return rag_1.globalRAG.remove(id);
        }
        // Phase 103: 멀티 에이전트 통신
        // (agent-spawn "id" handler-fn) → AgentHandle
        case "agent-spawn": {
            const agentId = String(args[0]);
            const handlerFn = args[1];
            const handler = (msg, bus) => {
                return callFn(handlerFn, [msg, bus]);
            };
            return multi_agent_1.globalBus.spawn(agentId, handler);
        }
        // (agent-send "from" "to" content) → AgentMessage
        case "agent-send": {
            const from = String(args[0]);
            const to = String(args[1]);
            const content = args[2];
            return multi_agent_1.globalBus.send(from, to, content);
        }
        // (agent-broadcast "from" content) → AgentMessage[]
        case "agent-broadcast": {
            const from = String(args[0]);
            const content = args[1];
            return multi_agent_1.globalBus.broadcast(from, content);
        }
        // (agent-recv "id") → AgentMessage | null
        case "agent-recv": {
            const agentId = String(args[0]);
            return multi_agent_1.globalBus.recv(agentId);
        }
        // (agent-process "id") → any[]
        case "agent-process": {
            const agentId = String(args[0]);
            return multi_agent_1.globalBus.process(agentId);
        }
        // (agent-list) → string[]
        case "agent-list": {
            return multi_agent_1.globalBus.list();
        }
        // (agent-history) → AgentMessage[]
        case "agent-history": {
            return multi_agent_1.globalBus.history();
        }
        // (agent-inbox-size "id") → number
        case "agent-inbox-size": {
            const agentId = String(args[0]);
            return multi_agent_1.globalBus.inboxSize(agentId);
        }
        // Phase 104: TRY-REASON
        // (try-reason [[strategy fn] ...]) → 첫 성공 값
        case "try-reason": {
            const attemptsList = args[0];
            if (!Array.isArray(attemptsList)) {
                throw new Error("try-reason: attempts must be a list");
            }
            const attempts = attemptsList.map((item) => {
                if (Array.isArray(item) && item.length === 2) {
                    const [strategy, fn] = item;
                    return [String(strategy), () => {
                            if (typeof fn === "function")
                                return fn();
                            if (fn && fn.kind === "function-value")
                                return callFn(fn, []);
                            return fn;
                        }];
                }
                throw new Error("try-reason: each attempt must be [strategy fn]");
            });
            return (0, try_reason_1.tryReasonBuiltin)(attempts);
        }
        // Phase 106: Quality Loop 내장 함수
        // (quality-check output threshold?) → score (0.0~1.0)
        case "quality-check": {
            const output = args[0];
            const threshold = args.length > 1 ? Number(args[1]) : 0.7;
            const result = (0, quality_loop_1.evaluateQuality)(output, quality_loop_1.defaultCriteria, threshold);
            return result.score;
        }
        // (quality-passed? output threshold?) → boolean
        case "quality-passed?": {
            const output = args[0];
            const threshold = args.length > 1 ? Number(args[1]) : 0.7;
            const result = (0, quality_loop_1.evaluateQuality)(output, quality_loop_1.defaultCriteria, threshold);
            return result.passed;
        }
        // (quality-feedback output) → string[]
        case "quality-feedback": {
            const output = args[0];
            const result = (0, quality_loop_1.evaluateQuality)(output, quality_loop_1.defaultCriteria, 0.7);
            return result.feedback;
        }
        // Phase 105: Streaming Output
        // (stream-create) → stream-id 문자열
        case "stream-create": {
            const { id } = (0, streaming_1.createStream)();
            return id;
        }
        // (stream-write "id" "chunk") — 청크 쓰기
        case "stream-write": {
            const streamId = String(args[0]);
            const content = String(args[1] ?? "");
            const s105a = (0, streaming_1.getStream)(streamId);
            if (!s105a)
                throw new Error(`stream-write: stream not found: ${streamId}`);
            s105a.write(content);
            return null;
        }
        // (stream-end "id") — 스트림 종료
        case "stream-end": {
            const streamId = String(args[0]);
            const s105b = (0, streaming_1.getStream)(streamId);
            if (!s105b)
                throw new Error(`stream-end: stream not found: ${streamId}`);
            s105b.end();
            return null;
        }
        // (stream-collect "id") → 수집된 문자열 (Promise or string)
        case "stream-collect": {
            const streamId = String(args[0]);
            const s105c = (0, streaming_1.getStream)(streamId);
            if (!s105c)
                throw new Error(`stream-collect: stream not found: ${streamId}`);
            return s105c.collect();
        }
        // (stream-done? "id") → boolean
        case "stream-done?": {
            const streamId = String(args[0]);
            const s105d = (0, streaming_1.getStream)(streamId);
            if (!s105d)
                return true;
            return s105d.isDone();
        }
        // (stream-chunks "id") → StreamChunk[]
        case "stream-chunks": {
            const streamId = String(args[0]);
            const s105e = (0, streaming_1.getStream)(streamId);
            if (!s105e)
                throw new Error(`stream-chunks: stream not found: ${streamId}`);
            return s105e.getChunks();
        }
        // (stream-chunk-count "id") → number
        case "stream-chunk-count": {
            const streamId = String(args[0]);
            const s105f = (0, streaming_1.getStream)(streamId);
            if (!s105f)
                throw new Error(`stream-chunk-count: stream not found: ${streamId}`);
            return s105f.chunkCount();
        }
        // (stream-text "id" "text") — 텍스트를 단어 단위로 자동 스트리밍
        case "stream-text": {
            const streamId = String(args[0]);
            const text = String(args[1] ?? "");
            const s105g = (0, streaming_1.getStream)(streamId);
            if (!s105g)
                throw new Error(`stream-text: stream not found: ${streamId}`);
            return (0, streaming_1.streamText)(s105g, text, 0);
        }
        // (stream-delete "id") → boolean
        case "stream-delete": {
            const streamId = String(args[0]);
            return (0, streaming_1.deleteStream)(streamId);
        }
        // (try-with-fallback fn fallback) → fn() 실패 시 fallback
        case "try-with-fallback": {
            const fn = args[0];
            const fallback = args[1];
            const wrappedFn = () => {
                if (typeof fn === "function")
                    return fn();
                if (fn && fn.kind === "function-value")
                    return callFn(fn, []);
                return fn;
            };
            return (0, try_reason_1.tryWithFallback)(wrappedFn, fallback);
        }
        // Phase 107: FL 자기 교육 시스템 내장 함수
        // (fl-learn "concept") → 레슨 마크다운 문자열
        case "fl-learn": {
            const concept = String(args[0] ?? "");
            return fl_tutor_1.globalTutor.lessonMarkdown(concept);
        }
        // (fl-examples "tag") → 태그별 예제 리스트 (JSON 문자열)
        case "fl-examples": {
            const tag = String(args[0] ?? "");
            const examples = fl_tutor_1.globalTutor.findByTag(tag);
            return examples.map(e => `${e.concept}: ${e.description}`).join("\n");
        }
        // (fl-example-count) → 총 예제 수
        case "fl-example-count": {
            return fl_tutor_1.globalTutor.size();
        }
        // (fl-concepts) → 개념 목록 (공백 구분 문자열)
        case "fl-concepts": {
            return fl_tutor_1.globalTutor.concepts().join(" ");
        }
        // Phase 108: AI 추론 시각화 디버거 내장 함수
        // (trace-create "label") → trace-id 문자열
        case "trace-create": {
            const label = String(args[0] ?? "trace");
            const { id } = (0, reasoning_debugger_1.createTrace)(label);
            return id;
        }
        // (trace-add id "type" "label") → null
        // (trace-add id "type" "label" value) → null
        case "trace-add": {
            const traceId = String(args[0] ?? "");
            const nodeType = String(args[1] ?? "thought");
            const nodeLabel = String(args[2] ?? "");
            const nodeValue = args.length >= 4 ? args[3] : undefined;
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return null;
            trace.add(nodeType, nodeLabel, nodeValue);
            return null;
        }
        // (trace-enter id "type" "label") → null
        case "trace-enter": {
            const traceId = String(args[0] ?? "");
            const nodeType = String(args[1] ?? "thought");
            const nodeLabel = String(args[2] ?? "");
            const nodeValue = args.length >= 4 ? args[3] : undefined;
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return null;
            trace.enter(nodeType, nodeLabel, nodeValue);
            return null;
        }
        // (trace-exit id) → null
        // (trace-exit id result) → null
        case "trace-exit": {
            const traceId = String(args[0] ?? "");
            const result = args.length >= 2 ? args[1] : undefined;
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return null;
            trace.exit(result);
            return null;
        }
        // (trace-markdown id) → 마크다운 문자열
        case "trace-markdown": {
            const traceId = String(args[0] ?? "");
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return "";
            return trace.toMarkdown();
        }
        // (trace-tree id) → 텍스트 트리 문자열
        case "trace-tree": {
            const traceId = String(args[0] ?? "");
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return "";
            return trace.toTree();
        }
        // (trace-node-count id) → 노드 수 (숫자)
        case "trace-node-count": {
            const traceId = String(args[0] ?? "");
            const trace = (0, reasoning_debugger_1.getTrace)(traceId);
            if (!trace)
                return 0;
            return trace.nodeCount();
        }
        // Phase 109: FL → 최적 프롬프트 컴파일러 내장 함수
        // (prompt-compile "blockType" "instruction") → 프롬프트 문자열
        case "prompt-compile": {
            const blockType = String(args[0] ?? "COT");
            const instruction = String(args[1] ?? "");
            const section = prompt_compiler_1.globalCompiler.compileBlock(blockType, {});
            const sections = section ? [section] : [{ name: 'default', content: '', priority: 0.5 }];
            const result = prompt_compiler_1.globalCompiler.compile(sections, instruction);
            return result.prompt;
        }
        // (prompt-tokens "text") → 추정 토큰 수 (숫자)
        case "prompt-tokens": {
            const text = String(args[0] ?? "");
            return Math.ceil(text.length / 4);
        }
        // (prompt-target "claude"|"gpt"|"generic") → 타겟 설정 후 현재 타겟 반환
        case "prompt-target": {
            const target = String(args[0] ?? "claude");
            prompt_compiler_1.globalCompiler.setTarget(target);
            return target;
        }
        // (prompt-from-code "fl-code" "instruction") → FL 코드에서 자동 컴파일된 프롬프트
        case "prompt-from-code": {
            const flCode = String(args[0] ?? "");
            const instruction = String(args[1] ?? "");
            const result = prompt_compiler_1.globalCompiler.compileFromCode(flCode, instruction);
            return result.prompt;
        }
        // Phase 110: External AI SDK 내장 함수
        // (sdk-version) → "9.0.0"
        case "sdk-version": {
            return fl_sdk_1.sdk.version;
        }
        // (sdk-features) → 피처 리스트 (배열)
        case "sdk-features": {
            return [...fl_sdk_1.sdk.features];
        }
        // (sdk-supports "feature") → boolean
        case "sdk-supports": {
            const feature = String(args[0] ?? "");
            return fl_sdk_1.sdk.supports(feature);
        }
        // (sdk-snippet "concept") → 코드 문자열
        case "sdk-snippet": {
            const concept = String(args[0] ?? "");
            return fl_sdk_1.sdk.snippet(concept);
        }
        // (sdk-validate "code") → boolean
        case "sdk-validate": {
            const code = String(args[0] ?? "");
            const result = fl_sdk_1.sdk.validate(code);
            return result.valid;
        }
        // ── Phase 112: maybe-chain 확률 자동 전파 ────────────────────────────
        // (maybe-map $m fn) → maybe(same-confidence, fn(value))
        case "maybe-map": {
            const [m, fn] = args;
            return (0, maybe_chain_1.maybeMap)(m, (v) => callFnVal(fn, [v]));
        }
        // (maybe-bind $m fn) → fn(value) 결과 maybe와 확률 곱
        case "maybe-bind": {
            const [m, fn] = args;
            return (0, maybe_chain_1.maybeBind)(m, (v) => callFnVal(fn, [v]));
        }
        // (maybe-chain maybe-list fn) → 확률 곱 + 값 합성
        case "maybe-chain": {
            const [maybes, fn] = args;
            const list = Array.isArray(maybes) ? maybes : [maybes];
            return (0, maybe_chain_1.maybeChain)(list, (...vals) => callFnVal(fn, vals));
        }
        // (maybe-filter $m pred) → 조건 불만족 시 none
        case "maybe-filter": {
            const [m, pred] = args;
            return (0, maybe_chain_1.maybeFilter)(m, (v) => callFnVal(pred, [v]));
        }
        // (maybe-combine $a $b fn) → 두 maybe 결합 (확률 곱)
        case "maybe-combine": {
            const [a, b, fn] = args;
            return (0, maybe_chain_1.maybeCombine)(a, b, (x, y) => callFnVal(fn, [x, y]));
        }
        // (maybe-select maybe-list) → 최고 신뢰도 선택
        case "maybe-select": {
            const list = Array.isArray(args[0]) ? args[0] : args;
            return (0, maybe_chain_1.maybeSelect)(list);
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
            // Phase 111: Hypothesis 내장 함수
            if (op === "hypothesis") {
                // (hypothesis claim test-fn eval-fn) → verdict string
                const [claim, testFn, evalFn] = args;
                const config = {
                    claim: String(claim),
                    test: (attempt) => {
                        if (typeof testFn === "function")
                            return testFn(attempt);
                        if (testFn?.kind === "function-value")
                            return callFn(testFn, [attempt]);
                        return null;
                    },
                    evaluate: (evidence) => {
                        if (typeof evalFn === "function")
                            return evalFn(evidence);
                        if (evalFn?.kind === "function-value")
                            return callFn(evalFn, [evidence]);
                        return 0;
                    },
                };
                const result = hypothesis_1.globalTester.test(config);
                return result.verdict;
            }
            if (op === "hypothesis-confidence") {
                // (hypothesis-confidence claim test-fn eval-fn) → confidence number
                const [claim, testFn, evalFn] = args;
                const config = {
                    claim: String(claim),
                    test: (attempt) => {
                        if (typeof testFn === "function")
                            return testFn(attempt);
                        if (testFn?.kind === "function-value")
                            return callFn(testFn, [attempt]);
                        return null;
                    },
                    evaluate: (evidence) => {
                        if (typeof evalFn === "function")
                            return evalFn(evidence);
                        if (evalFn?.kind === "function-value")
                            return callFn(evalFn, [evidence]);
                        return 0;
                    },
                };
                const result = hypothesis_1.globalTester.test(config);
                return result.confidence;
            }
            if (op === "hypothesis-compete") {
                // (hypothesis-compete hypotheses-list) → winner claim string
                // hypotheses-list: array of [claim, test-fn, eval-fn]
                const hypoList = args[0];
                if (!Array.isArray(hypoList) || hypoList.length === 0)
                    return null;
                const configs = hypoList.map((h) => {
                    const [claim, testFn, evalFn] = Array.isArray(h) ? h : [h, () => null, () => 0];
                    return {
                        claim: String(claim),
                        test: (attempt) => {
                            if (typeof testFn === "function")
                                return testFn(attempt);
                            if (testFn?.kind === "function-value")
                                return callFn(testFn, [attempt]);
                            return null;
                        },
                        evaluate: (evidence) => {
                            if (typeof evalFn === "function")
                                return evalFn(evidence);
                            if (evalFn?.kind === "function-value")
                                return callFn(evalFn, [evidence]);
                            return 0;
                        },
                    };
                });
                const winner = hypothesis_1.globalTester.compete(configs);
                return winner.claim;
            }
            // Phase 113: Debate 내장 함수
            if (op === "debate") {
                // (debate proposition pro-fn con-fn) → winner string
                const [proposition, proFn, conFn] = args;
                const result = debate_1.globalDebater.debate({
                    proposition: String(proposition),
                    pro: (round, conArgs) => {
                        if (typeof proFn === "function")
                            return proFn(round, conArgs);
                        if (proFn?.kind === "function-value")
                            return callFn(proFn, [round, conArgs]);
                        return { side: 'pro', point: String(proFn), strength: 0.5 };
                    },
                    con: (round, proArgs) => {
                        if (typeof conFn === "function")
                            return conFn(round, proArgs);
                        if (conFn?.kind === "function-value")
                            return callFn(conFn, [round, proArgs]);
                        return { side: 'con', point: String(conFn), strength: 0.5 };
                    },
                });
                return result.winner;
            }
            if (op === "debate-score") {
                // (debate-score proposition pro-fn con-fn) → { pro: number; con: number }
                const [proposition, proFn, conFn] = args;
                const result = debate_1.globalDebater.debate({
                    proposition: String(proposition),
                    pro: (round, conArgs) => {
                        if (typeof proFn === "function")
                            return proFn(round, conArgs);
                        if (proFn?.kind === "function-value")
                            return callFn(proFn, [round, conArgs]);
                        return { side: 'pro', point: String(proFn), strength: 0.5 };
                    },
                    con: (round, proArgs) => {
                        if (typeof conFn === "function")
                            return conFn(round, proArgs);
                        if (conFn?.kind === "function-value")
                            return callFn(conFn, [round, proArgs]);
                        return { side: 'con', point: String(conFn), strength: 0.5 };
                    },
                });
                return { pro: result.proScore, con: result.conScore };
            }
            if (op === "debate-conclusion") {
                // (debate-conclusion proposition pro-fn con-fn) → conclusion string
                const [proposition, proFn, conFn] = args;
                const result = debate_1.globalDebater.debate({
                    proposition: String(proposition),
                    pro: (round, conArgs) => {
                        if (typeof proFn === "function")
                            return proFn(round, conArgs);
                        if (proFn?.kind === "function-value")
                            return callFn(proFn, [round, conArgs]);
                        return { side: 'pro', point: String(proFn), strength: 0.5 };
                    },
                    con: (round, proArgs) => {
                        if (typeof conFn === "function")
                            return conFn(round, proArgs);
                        if (conFn?.kind === "function-value")
                            return callFn(conFn, [round, proArgs]);
                        return { side: 'con', point: String(conFn), strength: 0.5 };
                    },
                });
                return result.conclusion;
            }
            // Phase 114: Checkpoint — AI 추론 세이브포인트 저장/복원
            if (op === "cp-save") {
                // (cp-save "name" state)
                const [name, state] = args;
                checkpoint_1.globalCheckpoint.save(String(name), state);
                return null;
            }
            if (op === "cp-restore") {
                // (cp-restore "name") → 최신 state 또는 null
                const [name] = args;
                return checkpoint_1.globalCheckpoint.restore(String(name));
            }
            if (op === "cp-branch") {
                // (cp-branch "name" state fn) → 성공 시 결과, 실패 시 복원된 state
                // fn: function-value (인라인 fn), string (함수이름), 또는 JS function
                const [name, state, fn] = args;
                const result = checkpoint_1.globalCheckpoint.branch(String(name), state, (s) => {
                    if (typeof fn === "function")
                        return fn(s);
                    if (typeof fn === "string")
                        return callUser(fn, [s]);
                    if (fn?.kind === "function-value" || fn?.kind === "async-function-value") {
                        return callFnVal(fn, [s]);
                    }
                    // fn이 함수 정의 객체(params+body)인 경우
                    if (fn?.params && fn?.body)
                        return callFnVal({ kind: "function-value", ...fn }, [s]);
                    throw new Error(`cp-branch: fn must be callable, got ${typeof fn} ${fn?.kind ?? ""}`);
                });
                if (result.success)
                    return result.result;
                return result.restored;
            }
            if (op === "cp-drop") {
                // (cp-drop "name") → boolean
                const [name] = args;
                return checkpoint_1.globalCheckpoint.drop(String(name));
            }
            if (op === "cp-list") {
                // (cp-list) → 이름 목록 (배열)
                return checkpoint_1.globalCheckpoint.list();
            }
            if (op === "cp-versions") {
                // (cp-versions "name") → 버전 수 (number)
                const [name] = args;
                return checkpoint_1.globalCheckpoint.versions(String(name));
            }
            // Phase 115: Meta-Reason — AI 추론 방법 자동 선택
            if (op === "meta-reason") {
                // (meta-reason "problem") → 선택된 전략 이름 문자열
                const problem = String(args[0] ?? "");
                const result = meta_reason_1.globalMetaReasoner.analyze(problem);
                return result.selected;
            }
            if (op === "meta-reason-scores") {
                // (meta-reason-scores "problem") → 전략별 점수 맵 [{strategy, score, reason}]
                const problem = String(args[0] ?? "");
                const result = meta_reason_1.globalMetaReasoner.analyze(problem);
                // Map으로 변환: { COT: 0.9, TOT: 0.4, ... }
                const scoreMap = {};
                for (const s of result.scores) {
                    scoreMap[s.strategy] = s.score;
                }
                return scoreMap;
            }
            if (op === "meta-reason-rationale") {
                // (meta-reason-rationale "problem") → 선택 이유 문자열
                const problem = String(args[0] ?? "");
                const result = meta_reason_1.globalMetaReasoner.analyze(problem);
                return result.rationale;
            }
            // Phase 116: Belief System — AI 신념 + 베이즈 업데이트
            if (op === "belief-set") {
                // (belief-set "claim" confidence) → null
                const [claim, confidence] = args;
                belief_1.globalBeliefs.set(String(claim), Number(confidence));
                return null;
            }
            if (op === "belief-get") {
                // (belief-get "claim") → confidence 숫자 또는 null
                const [claim] = args;
                return belief_1.globalBeliefs.get(String(claim));
            }
            if (op === "belief-update") {
                // (belief-update "claim" evidence) → 업데이트된 confidence
                const [claim, evidence] = args;
                return belief_1.globalBeliefs.update(String(claim), Number(evidence));
            }
            if (op === "belief-negate") {
                // (belief-negate "claim") → 약화된 confidence
                const [claim] = args;
                return belief_1.globalBeliefs.negate(String(claim));
            }
            if (op === "belief-list") {
                // (belief-list) → 신념 리스트 배열
                return belief_1.globalBeliefs.list();
            }
            if (op === "belief-certain") {
                // (belief-certain threshold) → 임계값 이상 신념들
                const threshold = args.length > 0 ? Number(args[0]) : 0.8;
                return belief_1.globalBeliefs.certain(threshold);
            }
            if (op === "belief-strongest") {
                // (belief-strongest) → 가장 강한 신념의 claim 문자열 또는 null
                const b = belief_1.globalBeliefs.strongest();
                return b ? b.claim : null;
            }
            if (op === "belief-forget") {
                // (belief-forget "claim") → boolean
                const [claim] = args;
                return belief_1.globalBeliefs.forget(String(claim));
            }
            if (op === "belief-size") {
                // (belief-size) → 신념 개수
                return belief_1.globalBeliefs.size();
            }
            // Phase 117: Analogy — 유사 패턴 추론
            if (op === "analogy-store") {
                // (analogy-store "description" solution tags?) → 패턴 저장, id 반환
                const [desc, solution, tagsRaw] = args;
                const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];
                const p = analogy_1.globalAnalogy.store(String(desc), solution, tags);
                return p.id;
            }
            if (op === "analogy-find") {
                // (analogy-find "problem" topK?) → 유사 패턴 description 리스트
                const [problem, topK] = args;
                const results = analogy_1.globalAnalogy.find(String(problem), topK != null ? Number(topK) : 3);
                return results.map(p => p.description);
            }
            if (op === "analogy-best") {
                // (analogy-best "problem") → 가장 유사한 패턴의 solution, 없으면 null
                const [problem] = args;
                const p = analogy_1.globalAnalogy.best(String(problem));
                return p ? p.solution : null;
            }
            if (op === "analogy-by-tag") {
                // (analogy-by-tag "tag") → 태그별 패턴 description 리스트
                const [tag] = args;
                const results = analogy_1.globalAnalogy.byTag(String(tag));
                return results.map(p => p.description);
            }
            if (op === "analogy-popular") {
                // (analogy-popular n?) → 자주 쓰인 패턴 description 리스트
                const [n] = args;
                const results = analogy_1.globalAnalogy.popular(n != null ? Number(n) : 3);
                return results.map(p => p.description);
            }
            if (op === "analogy-size") {
                // (analogy-size) → 저장된 패턴 수
                return analogy_1.globalAnalogy.size();
            }
            if (op === "analogy-all") {
                // (analogy-all) → 전체 패턴 description 리스트
                return analogy_1.globalAnalogy.all().map(p => p.description);
            }
            // Phase 118: Critique Agent — 자기 출력 비판
            if (op === "critique") {
                // (critique output) → approved? boolean (defaultFinders 사용)
                const [output] = args;
                const result = critique_1.globalCritique.run(output, { finders: critique_1.defaultFinders });
                return result.approved;
            }
            if (op === "critique-points") {
                // (critique-points output) → 문제점 리스트 (descriptions)
                const [output] = args;
                const result = critique_1.globalCritique.run(output, { finders: critique_1.defaultFinders });
                return result.points.map(p => p.description);
            }
            if (op === "critique-risk") {
                // (critique-risk output) → 위험도 숫자
                const [output] = args;
                const result = critique_1.globalCritique.run(output, { finders: critique_1.defaultFinders });
                return result.overallRisk;
            }
            if (op === "critique-summary") {
                // (critique-summary output) → 요약 문자열
                const [output] = args;
                const result = critique_1.globalCritique.run(output, { finders: critique_1.defaultFinders });
                return result.summary;
            }
            // Phase 119: Compose-Reason — 추론 블록 파이프라인 조합기
            if (op === "compose-reason") {
                // (compose-reason steps-list input) → 최종 출력값
                // steps-list: [[name fn], ...] 또는 [[name fn condition], ...]
                const [stepsList, input] = args;
                if (!Array.isArray(stepsList))
                    return input;
                const steps = stepsList.map((s) => {
                    if (!Array.isArray(s))
                        return { name: String(s), fn: (x) => x };
                    const [name, fn, condition] = s;
                    const step = {
                        name: String(name),
                        fn: typeof fn === "function" ? fn : (x) => x,
                    };
                    if (typeof condition === "function")
                        step.condition = condition;
                    return step;
                });
                const result = compose_reason_1.globalComposer.compose(steps, input);
                return result.output;
            }
            if (op === "compose-history") {
                // (compose-history steps-list input) → 단계별 이름 리스트
                const [stepsList, input] = args;
                if (!Array.isArray(stepsList))
                    return [];
                const steps = stepsList.map((s) => {
                    if (!Array.isArray(s))
                        return { name: String(s), fn: (x) => x };
                    const [name, fn, condition] = s;
                    const step = {
                        name: String(name),
                        fn: typeof fn === "function" ? fn : (x) => x,
                    };
                    if (typeof condition === "function")
                        step.condition = condition;
                    return step;
                });
                const result = compose_reason_1.globalComposer.compose(steps, input);
                return result.history.map(h => h.name);
            }
            if (op === "compose-steps") {
                // (compose-steps steps-list input) → 실행된 단계 수
                const [stepsList, input] = args;
                if (!Array.isArray(stepsList))
                    return 0;
                const steps = stepsList.map((s) => {
                    if (!Array.isArray(s))
                        return { name: String(s), fn: (x) => x };
                    const [name, fn, condition] = s;
                    const step = {
                        name: String(name),
                        fn: typeof fn === "function" ? fn : (x) => x,
                    };
                    if (typeof condition === "function")
                        step.condition = condition;
                    return step;
                });
                const result = compose_reason_1.globalComposer.compose(steps, input);
                return result.steps;
            }
            // Phase 120: Cognitive Architecture — 인지 아키텍처 통합
            if (op === "cognition-solve") {
                // (cognition-solve "problem" solver-fn) → { strategy, output, approved, risk }
                const [problem, solverFn] = args;
                const result = cognitive_1.globalCognition.solve(String(problem), (strategy, prob) => {
                    if (typeof solverFn === "function")
                        return solverFn(strategy, prob);
                    if (solverFn?.kind === "function-value")
                        return callFn(solverFn, [strategy, prob]);
                    return solverFn;
                });
                return new Map([
                    ["strategy", result.strategy],
                    ["output", result.output],
                    ["approved", result.approved],
                    ["risk", result.risk]
                ]);
            }
            if (op === "cognition-stats") {
                // (cognition-stats) → { beliefs, analogies, checkpoints }
                const s = cognitive_1.globalCognition.stats();
                return new Map([
                    ["beliefs", s.beliefs],
                    ["analogies", s.analogies],
                    ["checkpoints", s.checkpoints]
                ]);
            }
            if (op === "cognition-meta") {
                // (cognition-meta "problem") → 전략 문자열
                const [problem] = args;
                const result = cognitive_1.globalCognition.meta.analyze(String(problem));
                return result.selected;
            }
            if (op === "cognition-believe") {
                // (cognition-believe "claim" confidence) → void
                const [claim, confidence] = args;
                cognitive_1.globalCognition.beliefs.set(String(claim), Number(confidence));
                return null;
            }
            if (op === "cognition-recall") {
                // (cognition-recall "pattern") → 유사 패턴 solution or null
                const [pattern] = args;
                const p = cognitive_1.globalCognition.analogies.best(String(pattern));
                return p ? p.solution : null;
            }
            // Phase 121: Consensus — 여러 에이전트 합의
            // votes-list 형식: [[agentId answer confidence], ...]
            {
                function parseVotes(raw) {
                    if (!Array.isArray(raw))
                        return [];
                    return raw.map((item) => {
                        if (Array.isArray(item)) {
                            return { agentId: String(item[0]), answer: item[1], confidence: Number(item[2]) };
                        }
                        return item;
                    });
                }
                if (op === "consensus-majority") {
                    // (consensus-majority votes-list) → answer
                    const votes = parseVotes(args[0]);
                    const result = consensus_1.globalConsensus.majority(votes);
                    return result.answer;
                }
                if (op === "consensus-weighted") {
                    // (consensus-weighted votes-list) → 숫자
                    const votes = parseVotes(args[0]);
                    const result = consensus_1.globalConsensus.weighted(votes);
                    return result.answer;
                }
                if (op === "consensus-threshold") {
                    // (consensus-threshold votes-list threshold) → answer or null
                    const votes = parseVotes(args[0]);
                    const threshold = args[1] !== undefined ? Number(args[1]) : 0.7;
                    const result = consensus_1.globalConsensus.threshold(votes, threshold);
                    return result ? result.answer : null;
                }
                if (op === "consensus-agreement") {
                    // (consensus-agreement votes-list) → agreement 숫자
                    const votes = parseVotes(args[0]);
                    return consensus_1.globalConsensus.agreement(votes);
                }
            }
            // Phase 123: VOTE — 에이전트 투표 결정
            // ballots 형식: [[voterId [choice1 choice2 ...] {scores}], ...]
            {
                function parseBallots(raw) {
                    if (!Array.isArray(raw))
                        return [];
                    return raw.map((item) => {
                        if (Array.isArray(item)) {
                            const voterId = String(item[0]);
                            const choices = Array.isArray(item[1]) ? item[1].map(String) : [];
                            const scores = item[2] && typeof item[2] === "object" && !Array.isArray(item[2]) ? item[2] : undefined;
                            return { voterId, choices, scores };
                        }
                        return item;
                    });
                }
                function parseCandidates(raw) {
                    if (Array.isArray(raw))
                        return raw.map(String);
                    return [];
                }
                if (op === "vote-plurality") {
                    const ballots = parseBallots(args[0]);
                    const candidates = parseCandidates(args[1]);
                    const result = vote_1.globalVoting.plurality(ballots, candidates);
                    return result.winner;
                }
                if (op === "vote-approval") {
                    const ballots = parseBallots(args[0]);
                    const candidates = parseCandidates(args[1]);
                    const result = vote_1.globalVoting.approval(ballots, candidates);
                    return result.winner;
                }
                if (op === "vote-score") {
                    const ballots = parseBallots(args[0]);
                    const candidates = parseCandidates(args[1]);
                    const result = vote_1.globalVoting.score(ballots, candidates);
                    return result.winner;
                }
                if (op === "vote-tally") {
                    const ballots = parseBallots(args[0]);
                    const candidates = parseCandidates(args[1]);
                    const t = vote_1.globalVoting.tally(ballots, candidates);
                    return new Map(Object.entries(t));
                }
            }
            // Phase 124: Negotiate — 에이전트 협상 블록
            if (op === "negotiate") {
                // (negotiate positions-list) → agreed? boolean
                const [raw] = args;
                if (!Array.isArray(raw))
                    return false;
                const positions = raw.map((p) => {
                    if (Array.isArray(p)) {
                        return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
                    }
                    return p;
                });
                const result = negotiate_1.globalNegotiator.negotiate(positions);
                return result.agreed;
            }
            if (op === "negotiate-value") {
                // (negotiate-value positions-list) → 합의 값 or null
                const [raw] = args;
                if (!Array.isArray(raw))
                    return null;
                const positions = raw.map((p) => {
                    if (Array.isArray(p)) {
                        return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
                    }
                    return p;
                });
                const result = negotiate_1.globalNegotiator.negotiate(positions);
                return result.agreed ? (result.value ?? null) : null;
            }
            if (op === "negotiate-rounds") {
                // (negotiate-rounds positions-list) → 라운드 수
                const [raw] = args;
                if (!Array.isArray(raw))
                    return 0;
                const positions = raw.map((p) => {
                    if (Array.isArray(p)) {
                        return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
                    }
                    return p;
                });
                const result = negotiate_1.globalNegotiator.negotiate(positions);
                return result.rounds.length;
            }
            // Phase 125: Swarm Intelligence — PSO 기반 군집 지능
            if (op === "swarm-optimize") {
                // (swarm-optimize fn particles iterations) → bestPosition
                const [fnArg, nArg, iterArg] = args;
                const objective = typeof fnArg === "function"
                    ? fnArg
                    : (x) => callFnVal(fnArg, [x]);
                const result = swarm_1.globalSwarm.optimize({
                    objective,
                    particles: nArg !== undefined ? Number(nArg) : 10,
                    iterations: iterArg !== undefined ? Number(iterArg) : 50,
                });
                return result.bestPosition;
            }
            if (op === "swarm-best-score") {
                // (swarm-best-score fn particles iterations) → bestScore
                const [fnArg, nArg, iterArg] = args;
                const objective = typeof fnArg === "function"
                    ? fnArg
                    : (x) => callFnVal(fnArg, [x]);
                const result = swarm_1.globalSwarm.optimize({
                    objective,
                    particles: nArg !== undefined ? Number(nArg) : 10,
                    iterations: iterArg !== undefined ? Number(iterArg) : 50,
                });
                return result.bestScore;
            }
            if (op === "swarm-converged?") {
                // (swarm-converged? fn) → boolean
                const [fnArg] = args;
                const objective = typeof fnArg === "function"
                    ? fnArg
                    : (x) => callFnVal(fnArg, [x]);
                const result = swarm_1.globalSwarm.optimize({ objective });
                return result.converged;
            }
            // Phase 129: Compete — 에이전트 경쟁 최선 선택
            if (op === "compete-register") {
                // (compete-register id solve-fn) → void
                const [id, solveFn] = args;
                const competitor = {
                    id: String(id),
                    solve: (problem) => callFn(solveFn, [problem]),
                };
                compete_1.globalCompetition.register(competitor);
                return null;
            }
            if (op === "compete") {
                // (compete problem eval-fn) → winner agentId
                const [problem, evalFn] = args;
                const evaluate = (output) => Number(callFn(evalFn, [output]));
                const result = compete_1.globalCompetition.run(problem, evaluate);
                return result.winner?.agentId ?? null;
            }
            if (op === "compete-score") {
                // (compete-score problem eval-fn) → winner score
                const [problem, evalFn] = args;
                const evaluate = (output) => Number(callFn(evalFn, [output]));
                const result = compete_1.globalCompetition.run(problem, evaluate);
                return result.winner?.score ?? null;
            }
            if (op === "compete-all") {
                // (compete-all problem eval-fn) → 전체 순위 리스트 [[agentId score rank] ...]
                const [problem, evalFn] = args;
                const evaluate = (output) => Number(callFn(evalFn, [output]));
                const result = compete_1.globalCompetition.run(problem, evaluate);
                return result.allResults.map(r => [r.agentId, r.score, r.rank]);
            }
            if (op === "compete-list") {
                // (compete-list) → 등록된 경쟁자 목록
                return compete_1.globalCompetition.list();
            }
            // Phase 127: PEER-REVIEW — 에이전트 간 피어 리뷰
            if (op === "peer-review-add") {
                // (peer-review-add "id" review-fn) → void
                const [idArg, fnArg] = args;
                const reviewerId = String(idArg);
                const reviewer = {
                    id: reviewerId,
                    review: (output) => {
                        const raw = callFnVal(fnArg, [output]);
                        if (raw && typeof raw === "object") {
                            return {
                                reviewerId,
                                aspect: String(raw.aspect ?? "quality"),
                                score: Number(raw.score ?? 0.5),
                                comment: String(raw.comment ?? ""),
                                suggestion: raw.suggestion !== undefined ? String(raw.suggestion) : undefined,
                            };
                        }
                        return { reviewerId, aspect: "quality", score: 0.5, comment: String(raw ?? "") };
                    },
                };
                peer_review_1.globalPeerReview.addReviewer(reviewer);
                return null;
            }
            if (op === "peer-review") {
                // (peer-review "targetId" output) → approved? boolean
                const [targetId, output] = args;
                const result = peer_review_1.globalPeerReview.review(String(targetId), output);
                return result.approved;
            }
            if (op === "peer-review-score") {
                // (peer-review-score "targetId" output) → averageScore
                const [targetId, output] = args;
                const result = peer_review_1.globalPeerReview.review(String(targetId), output);
                return result.averageScore;
            }
            if (op === "peer-review-comments") {
                // (peer-review-comments "targetId" output) → comments list
                const [targetId, output] = args;
                const result = peer_review_1.globalPeerReview.review(String(targetId), output);
                return result.comments;
            }
            if (op === "peer-review-list") {
                // (peer-review-list) → reviewer ids
                return peer_review_1.globalPeerReview.list();
            }
            // Phase 128: Chain-Agents — 에이전트 체인 파이프라인
            if (op === "chain-agents") {
                // (chain-agents agents-list input) → finalOutput
                const [rawAgents, input] = args;
                if (!Array.isArray(rawAgents))
                    return input;
                const agents = rawAgents.map((a) => {
                    if (typeof a === "object" && a !== null && typeof a.transform === "function")
                        return a;
                    if (Array.isArray(a)) {
                        const [id, tf, vf] = a;
                        return {
                            id: String(id),
                            transform: (inp) => callFn(tf, [inp]),
                            validate: vf ? (out) => Boolean(callFn(vf, [out])) : undefined,
                        };
                    }
                    return { id: String(a), transform: (x) => x };
                });
                const chain = chain_agents_1.AgentChain.from(agents);
                const result = chain.run(input);
                return result.finalOutput;
            }
            if (op === "chain-links") {
                // (chain-links agents-list input) → agentId 리스트 (완료된 것)
                const [rawAgents, input] = args;
                if (!Array.isArray(rawAgents))
                    return [];
                const agents = rawAgents.map((a) => {
                    if (typeof a === "object" && a !== null && typeof a.transform === "function")
                        return a;
                    if (Array.isArray(a)) {
                        const [id, tf, vf] = a;
                        return {
                            id: String(id),
                            transform: (inp) => callFn(tf, [inp]),
                            validate: vf ? (out) => Boolean(callFn(vf, [out])) : undefined,
                        };
                    }
                    return { id: String(a), transform: (x) => x };
                });
                const chain = chain_agents_1.AgentChain.from(agents);
                const result = chain.run(input);
                return result.links.filter((l) => !l.skipped).map((l) => l.agentId);
            }
            if (op === "chain-steps") {
                // (chain-steps agents-list input) → 완료 스텝 수
                const [rawAgents, input] = args;
                if (!Array.isArray(rawAgents))
                    return 0;
                const agents = rawAgents.map((a) => {
                    if (typeof a === "object" && a !== null && typeof a.transform === "function")
                        return a;
                    if (Array.isArray(a)) {
                        const [id, tf, vf] = a;
                        return {
                            id: String(id),
                            transform: (inp) => callFn(tf, [inp]),
                            validate: vf ? (out) => Boolean(callFn(vf, [out])) : undefined,
                        };
                    }
                    return { id: String(a), transform: (x) => x };
                });
                const chain = chain_agents_1.AgentChain.from(agents);
                const result = chain.run(input);
                return result.stepsCompleted;
            }
            // Phase 126: Orchestrate — 의존성 기반 에이전트 오케스트레이션
            if (op === "orchestrate-run") {
                // (orchestrate-run tasks-list) → outputs map
                const [rawTasks] = args;
                if (!Array.isArray(rawTasks))
                    return {};
                const tasks = rawTasks.map((t) => {
                    if (Array.isArray(t)) {
                        return { id: String(t[0]), input: t[1] ?? null, dependsOn: Array.isArray(t[2]) ? t[2].map(String) : undefined };
                    }
                    return { id: String(t.id ?? 'task'), input: t.input ?? null, dependsOn: t.dependsOn };
                });
                return orchestrate_1.globalOrchestrator.run(tasks).outputs;
            }
            if (op === "orchestrate-order") {
                // (orchestrate-order tasks-list) → 실행 순서 배열
                const [rawTasks] = args;
                if (!Array.isArray(rawTasks))
                    return [];
                const tasks = rawTasks.map((t) => {
                    if (Array.isArray(t)) {
                        return { id: String(t[0]), input: t[1] ?? null, dependsOn: Array.isArray(t[2]) ? t[2].map(String) : undefined };
                    }
                    return { id: String(t.id ?? 'task'), input: t.input ?? null, dependsOn: t.dependsOn };
                });
                return orchestrate_1.globalOrchestrator.getOrder(tasks);
            }
            // Phase 130: Multi-Agent Hub — 협업 통합 허브
            if (op === "hub-route") {
                // (hub-route "taskType" problem) → result
                const [taskType, problem] = args;
                const result = multi_agent_hub_1.globalHub.route(String(taskType), problem, []);
                return result.result;
            }
            if (op === "hub-stats") {
                // (hub-stats) → { systems, ready, phases, tier }
                return multi_agent_hub_1.globalHub.stats();
            }
            if (op === "hub-systems") {
                // (hub-systems) → 시스템 이름 배열
                return multi_agent_hub_1.globalHub.systems();
            }
            if (op === "hub-task-types") {
                // (hub-task-types) → 태스크 타입 배열
                return multi_agent_hub_1.globalHub.taskTypes();
            }
            // Phase 122: Delegation — 서브태스크 위임
            if (op === "delegate-register") {
                const [id, caps, fn] = args;
                const capabilities = Array.isArray(caps) ? caps.map(String) : [];
                const agent = {
                    id: String(id),
                    capabilities,
                    execute: (task) => {
                        if (typeof fn === "function")
                            return fn(task);
                        if (fn?.kind === "function-value")
                            return callFn(fn, [task]);
                        return fn;
                    }
                };
                delegate_1.globalDelegation.register(agent);
                return String(id);
            }
            if (op === "delegate") {
                const [desc, input, capability] = args;
                const task = {
                    id: `task-${Date.now()}`,
                    description: String(desc),
                    input,
                    requiredCapability: capability != null ? String(capability) : undefined
                };
                const result = delegate_1.globalDelegation.delegate(task);
                return new Map([
                    ["taskId", result.taskId],
                    ["agentId", result.agentId],
                    ["output", result.output],
                    ["success", result.success],
                    ["duration", result.duration]
                ]);
            }
            if (op === "delegate-all") {
                const [taskList] = args;
                const tasks = Array.isArray(taskList)
                    ? taskList.map((t, i) => ({
                        id: t instanceof Map ? String(t.get("id") ?? `task-${i}`) : `task-${i}`,
                        description: t instanceof Map ? String(t.get("description") ?? "") : String(t),
                        input: t instanceof Map ? t.get("input") : t,
                        requiredCapability: t instanceof Map && t.has("requiredCapability")
                            ? String(t.get("requiredCapability"))
                            : undefined
                    }))
                    : [];
                const result = delegate_1.globalDelegation.delegateAll(tasks);
                return new Map([
                    ["results", result.results.map(r => new Map([
                            ["taskId", r.taskId],
                            ["agentId", r.agentId],
                            ["output", r.output],
                            ["success", r.success],
                            ["duration", r.duration]
                        ]))],
                    ["successful", result.successful],
                    ["failed", result.failed],
                    ["totalDuration", result.totalDuration]
                ]);
            }
            if (op === "delegate-list") {
                return delegate_1.globalDelegation.list();
            }
            // === Phase 133: CROSSOVER ===
            // (crossover-single [1 2 3] [4 5 6]) → CrossoverResult
            if (op === "crossover-single") {
                const [a, b] = args;
                const arrA = Array.isArray(a) ? a : [a];
                const arrB = Array.isArray(b) ? b : [b];
                const result = crossover_1.globalCrossover.singlePoint(arrA, arrB);
                return new Map([
                    ["parent1", result.parent1],
                    ["parent2", result.parent2],
                    ["child1", result.child1],
                    ["child2", result.child2],
                    ["crossoverPoint", result.crossoverPoint],
                    ["type", result.type],
                ]);
            }
            // (crossover-two [1 2 3 4] [5 6 7 8]) → CrossoverResult
            if (op === "crossover-two") {
                const [a, b] = args;
                const arrA = Array.isArray(a) ? a : [a];
                const arrB = Array.isArray(b) ? b : [b];
                const result = crossover_1.globalCrossover.twoPoint(arrA, arrB);
                return new Map([
                    ["parent1", result.parent1],
                    ["parent2", result.parent2],
                    ["child1", result.child1],
                    ["child2", result.child2],
                    ["crossoverPoints", result.crossoverPoints],
                    ["type", result.type],
                ]);
            }
            // (crossover-uniform [1 2 3] [4 5 6]) → CrossoverResult
            if (op === "crossover-uniform") {
                const [a, b] = args;
                const arrA = Array.isArray(a) ? a : [a];
                const arrB = Array.isArray(b) ? b : [b];
                const result = crossover_1.globalCrossover.uniform(arrA, arrB);
                return new Map([
                    ["parent1", result.parent1],
                    ["parent2", result.parent2],
                    ["child1", result.child1],
                    ["child2", result.child2],
                    ["type", result.type],
                ]);
            }
            // (crossover-arithmetic [1.0 2.0] [3.0 4.0] :alpha 0.5) → CrossoverResult
            if (op === "crossover-arithmetic") {
                let alpha;
                let cleanArgs = [...args];
                const alphaIdx = cleanArgs.findIndex((v) => v === "alpha" || v === ":alpha");
                if (alphaIdx !== -1) {
                    alpha = Number(cleanArgs[alphaIdx + 1]);
                    cleanArgs.splice(alphaIdx, 2);
                }
                const [a, b] = cleanArgs;
                const arrA = Array.isArray(a) ? a.map(Number) : [Number(a)];
                const arrB = Array.isArray(b) ? b.map(Number) : [Number(b)];
                const result = crossover_1.globalCrossover.arithmetic(arrA, arrB, alpha);
                return new Map([
                    ["parent1", result.parent1],
                    ["parent2", result.parent2],
                    ["child1", result.child1],
                    ["child2", result.child2],
                    ["type", result.type],
                ]);
            }
            // (crossover-strings "hello" "world") → CrossoverResult
            if (op === "crossover-strings") {
                const [a, b] = args;
                const result = crossover_1.globalCrossover.crossoverStrings(String(a), String(b));
                return new Map([
                    ["parent1", result.parent1],
                    ["parent2", result.parent2],
                    ["child1", result.child1],
                    ["child2", result.child2],
                    ["crossoverPoint", result.crossoverPoint],
                    ["type", result.type],
                ]);
            }
            // (crossover-objects {:a 1} {:b 2}) → CrossoverResult
            if (op === "crossover-objects") {
                const [a, b] = args;
                const objA = a instanceof Map
                    ? Object.fromEntries(a.entries())
                    : (typeof a === "object" && a !== null ? a : {});
                const objB = b instanceof Map
                    ? Object.fromEntries(b.entries())
                    : (typeof b === "object" && b !== null ? b : {});
                const result = crossover_1.globalCrossover.crossoverObjects(objA, objB);
                const toMap = (o) => new Map(Object.entries(o));
                return new Map([
                    ["parent1", toMap(result.parent1)],
                    ["parent2", toMap(result.parent2)],
                    ["child1", toMap(result.child1)],
                    ["child2", toMap(result.child2)],
                    ["type", result.type],
                ]);
            }
            // (crossover-children $result) → [child1, child2]
            if (op === "crossover-children") {
                const [result] = args;
                if (result instanceof Map) {
                    return [result.get("child1"), result.get("child2")];
                }
                return [];
            }
            // (blend $a $b :alpha 0.3) → 두 값 혼합
            if (op === "blend") {
                let alpha = 0.5;
                let cleanArgs = [...args];
                const alphaIdx = cleanArgs.findIndex((v) => v === "alpha" || v === ":alpha");
                if (alphaIdx !== -1) {
                    alpha = Number(cleanArgs[alphaIdx + 1]);
                    cleanArgs.splice(alphaIdx, 2);
                }
                const [a, b] = cleanArgs;
                if (Array.isArray(a) && Array.isArray(b)) {
                    const result = crossover_1.globalCrossover.arithmetic(a.map(Number), b.map(Number), alpha);
                    return result.child1;
                }
                if (typeof a === "number" && typeof b === "number") {
                    return alpha * a + (1 - alpha) * b;
                }
                return a;
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
            // === Phase 131: EVOLVE ===
            // evolve-numbers: 숫자 배열 진화
            if (op === "evolve-numbers") {
                const target = Array.isArray(args[0]) ? args[0].map(Number) : [0];
                let popSize = 20;
                let maxGens = 50;
                for (let i = 1; i < args.length - 1; i += 2) {
                    const key = String(args[i]);
                    if (key === ":pop")
                        popSize = Number(args[i + 1]);
                    if (key === ":gens")
                        maxGens = Number(args[i + 1]);
                }
                const result = (0, evolve_1.evolveNumbers)(target, popSize, maxGens);
                return new Map([
                    ["best", new Map([
                            ["genome", result.best.genome],
                            ["fitness", result.best.fitness],
                            ["generation", result.best.generation],
                            ["id", result.best.id],
                        ])],
                    ["generations", result.generations],
                    ["converged", result.converged],
                    ["history", result.history.map(h => new Map([
                            ["gen", h.gen],
                            ["bestFitness", h.bestFitness],
                            ["avgFitness", h.avgFitness],
                        ]))],
                ]);
            }
            // evolve-strings: 문자열 진화
            if (op === "evolve-strings") {
                const target = String(args[0] ?? "");
                let popSize = 30;
                let maxGens = 100;
                for (let i = 1; i < args.length - 1; i += 2) {
                    const key = String(args[i]);
                    if (key === ":pop")
                        popSize = Number(args[i + 1]);
                    if (key === ":gens")
                        maxGens = Number(args[i + 1]);
                }
                const result = (0, evolve_1.evolveStrings)(target, popSize, maxGens);
                return new Map([
                    ["best", new Map([
                            ["genome", result.best.genome],
                            ["fitness", result.best.fitness],
                            ["generation", result.best.generation],
                            ["id", result.best.id],
                        ])],
                    ["generations", result.generations],
                    ["converged", result.converged],
                    ["history", result.history.map(h => new Map([
                            ["gen", h.gen],
                            ["bestFitness", h.bestFitness],
                            ["avgFitness", h.avgFitness],
                        ]))],
                ]);
            }
            // evolve-config: 설정 맵 생성
            if (op === "evolve-config") {
                let popSize = 20;
                let maxGens = 50;
                let mutationRate = 0.1;
                let eliteRatio = 0.1;
                let fitnessGoal = null;
                for (let i = 0; i < args.length - 1; i += 2) {
                    const key = String(args[i]);
                    if (key === ":pop")
                        popSize = Number(args[i + 1]);
                    if (key === ":gens")
                        maxGens = Number(args[i + 1]);
                    if (key === ":mutation")
                        mutationRate = Number(args[i + 1]);
                    if (key === ":elite")
                        eliteRatio = Number(args[i + 1]);
                    if (key === ":goal")
                        fitnessGoal = Number(args[i + 1]);
                }
                return new Map([
                    ["populationSize", popSize],
                    ["maxGenerations", maxGens],
                    ["mutationRate", mutationRate],
                    ["eliteRatio", eliteRatio],
                    ["fitnessGoal", fitnessGoal],
                ]);
            }
            // evolve-step: 한 세대만 진행
            if (op === "evolve-step") {
                const engine = args[0];
                if (engine instanceof evolve_1.EvolutionEngine) {
                    const stepResult = engine.step();
                    return new Map([
                        ["bestFitness", stepResult.bestFitness],
                        ["avgFitness", stepResult.avgFitness],
                    ]);
                }
                return null;
            }
            // evolve-best: 현재 최고 개체 반환
            if (op === "evolve-best") {
                const engine = args[0];
                if (engine instanceof evolve_1.EvolutionEngine) {
                    const best = engine.getBest();
                    if (!best)
                        return null;
                    return new Map([
                        ["genome", best.genome],
                        ["fitness", best.fitness],
                        ["generation", best.generation],
                        ["id", best.id],
                    ]);
                }
                return null;
            }
            // evolve-population: 개체군 반환
            if (op === "evolve-population") {
                const engine = args[0];
                if (engine instanceof evolve_1.EvolutionEngine) {
                    return engine.getPopulation().map(ind => new Map([
                        ["genome", ind.genome],
                        ["fitness", ind.fitness],
                        ["generation", ind.generation],
                        ["id", ind.id],
                    ]));
                }
                return [];
            }
            // evolve-run: 전체 진화 실행
            if (op === "evolve-run") {
                const engine = args[0];
                if (engine instanceof evolve_1.EvolutionEngine) {
                    const result = engine.run();
                    return new Map([
                        ["best", new Map([
                                ["genome", result.best.genome],
                                ["fitness", result.best.fitness],
                                ["generation", result.best.generation],
                                ["id", result.best.id],
                            ])],
                        ["generations", result.generations],
                        ["converged", result.converged],
                        ["history", result.history.map(h => new Map([
                                ["gen", h.gen],
                                ["bestFitness", h.bestFitness],
                                ["avgFitness", h.avgFitness],
                            ]))],
                    ]);
                }
                return null;
            }
            // evolve-history: 진화 히스토리 반환
            if (op === "evolve-history") {
                const arg = args[0];
                if (arg instanceof evolve_1.EvolutionEngine) {
                    return arg.getHistory().map((h) => new Map([
                        ["gen", h.gen],
                        ["bestFitness", h.bestFitness],
                        ["avgFitness", h.avgFitness],
                    ]));
                }
                if (arg instanceof Map) {
                    const history = arg.get("history");
                    if (Array.isArray(history))
                        return history;
                }
                return [];
            }
            // === Phase 132: MUTATE ===
            if (op === "mutate-config") {
                const config = {};
                for (let i = 0; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                    else if (k === "strength")
                        config.strength = Number(v);
                    else if (k === "type")
                        config.type = String(v);
                }
                return new Map([
                    ["rate", config.rate ?? 0.1],
                    ["strength", config.strength ?? 0.1],
                    ["type", config.type ?? "random"]
                ]);
            }
            if (op === "mutate-numbers") {
                const arr = Array.isArray(args[0]) ? args[0].map(Number) : [];
                const config = {};
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                    else if (k === "strength")
                        config.strength = Number(v);
                    else if (k === "type")
                        config.type = String(v);
                }
                const m = new mutate_1.Mutator(config);
                const r = m.mutateNumbers(arr);
                return new Map([
                    ["original", r.original],
                    ["mutated", r.mutated],
                    ["mutations", r.mutations],
                    ["mutationType", r.mutationType]
                ]);
            }
            if (op === "mutate-string") {
                const s = String(args[0] ?? "");
                const config = {};
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                    else if (k === "strength")
                        config.strength = Number(v);
                    else if (k === "type")
                        config.type = String(v);
                }
                const m = new mutate_1.Mutator(config);
                const r = m.mutateString(s);
                return new Map([
                    ["original", r.original],
                    ["mutated", r.mutated],
                    ["mutations", r.mutations],
                    ["mutationType", r.mutationType]
                ]);
            }
            if (op === "mutate-object") {
                const raw = args[0];
                const obj = raw instanceof Map
                    ? Object.fromEntries(raw.entries())
                    : (typeof raw === "object" && raw !== null ? raw : {});
                const config = {};
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                    else if (k === "strength")
                        config.strength = Number(v);
                    else if (k === "type")
                        config.type = String(v);
                }
                const m = new mutate_1.Mutator(config);
                const r = m.mutateObject(obj);
                const toMap = (o) => new Map(Object.entries(o));
                return new Map([
                    ["original", toMap(r.original)],
                    ["mutated", toMap(r.mutated)],
                    ["mutations", r.mutations],
                    ["mutationType", r.mutationType]
                ]);
            }
            if (op === "mutate-swap") {
                const arr = Array.isArray(args[0]) ? args[0] : [];
                const config = { type: "swap", rate: 0.3 };
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                }
                const m = new mutate_1.Mutator(config);
                const r = m.swapMutation(arr);
                return new Map([
                    ["original", r.original],
                    ["mutated", r.mutated],
                    ["mutations", r.mutations],
                    ["mutationType", r.mutationType]
                ]);
            }
            if (op === "mutate-flip") {
                const arr = Array.isArray(args[0]) ? args[0].map(Number) : [];
                const config = { type: "flip" };
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "rate")
                        config.rate = Number(v);
                }
                const m = new mutate_1.Mutator(config);
                const r = m.flipMutation(arr);
                return new Map([
                    ["original", r.original],
                    ["mutated", r.mutated],
                    ["mutations", r.mutations],
                    ["mutationType", r.mutationType]
                ]);
            }
            if (op === "mutate-select") {
                const rawList = Array.isArray(args[0]) ? args[0] : [];
                let n = 1;
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "n")
                        n = Number(v);
                }
                const candidates = rawList.map((item) => {
                    if (item instanceof Map) {
                        return { value: item.get("value"), fitness: Number(item.get("fitness") ?? 0) };
                    }
                    if (typeof item === "object" && item !== null && "value" in item && "fitness" in item) {
                        return { value: item.value, fitness: Number(item.fitness ?? 0) };
                    }
                    return { value: item, fitness: 0 };
                });
                return mutate_1.globalMutator.select(candidates, n);
            }
            if (op === "mutation-count") {
                const r = args[0];
                if (r instanceof Map)
                    return r.get("mutations") ?? 0;
                return 0;
            }
            // === Phase 135: GENERATION ===
            // (generation-run $pop $fitness $next-gen :max 50) → GenerationResult
            if (op === "generation-run") {
                const [popArg, fitnessFnArg, nextGenFnArg, ...rest] = args;
                const population = Array.isArray(popArg) ? popArg : [];
                const maxGen = rest.length >= 2 && rest[0] === "max" ? Number(rest[1]) : 50;
                const fitnessFunc = (item) => {
                    if (typeof fitnessFnArg === "function")
                        return Number(fitnessFnArg(item));
                    if (fitnessFnArg?.kind === "function-value")
                        return Number(callFn(fitnessFnArg, [item]));
                    if (typeof fitnessFnArg === "string")
                        return Number(callUser(fitnessFnArg, [item]));
                    return 0;
                };
                const nextGenFunc = (pop, fits) => {
                    if (typeof nextGenFnArg === "function")
                        return nextGenFnArg(pop, fits) ?? pop;
                    if (nextGenFnArg?.kind === "function-value")
                        return callFn(nextGenFnArg, [pop, fits]) ?? pop;
                    if (typeof nextGenFnArg === "string")
                        return callUser(nextGenFnArg, [pop, fits]) ?? pop;
                    // 기본: 정렬 후 상위 절반 유지 + 복사
                    const paired = pop.map((item, i) => ({ item, fit: fits[i] }));
                    paired.sort((a, b) => b.fit - a.fit);
                    const half = Math.max(1, Math.floor(paired.length / 2));
                    const elites = paired.slice(0, half).map((p) => p.item);
                    const result = [...elites];
                    while (result.length < pop.length)
                        result.push(elites[result.length % half]);
                    return result;
                };
                const loop = new generation_1.GenerationLoop({ maxGenerations: maxGen });
                const genResult = loop.run(population, fitnessFunc, nextGenFunc);
                return new Map([
                    ["best", genResult.best],
                    ["bestFitness", genResult.bestFitness],
                    ["totalGenerations", genResult.totalGenerations],
                    ["history", genResult.history.map((s) => new Map([
                            ["generation", s.generation],
                            ["best", s.best],
                            ["worst", s.worst],
                            ["average", s.average],
                            ["diversity", s.diversity],
                            ["elites", s.elites],
                            ["improved", s.improved],
                        ]))],
                    ["terminationReason", genResult.terminationReason],
                    ["improvementRatio", genResult.improvementRatio],
                ]);
            }
            // (generation-stats $result) → 히스토리 배열
            if (op === "generation-stats") {
                const [arg] = args;
                if (arg instanceof Map) {
                    const history = arg.get("history");
                    return Array.isArray(history) ? history : [];
                }
                return [];
            }
            // (generation-best $result) → 최고 개체
            if (op === "generation-best") {
                const [arg] = args;
                if (arg instanceof Map)
                    return arg.get("best") ?? null;
                return null;
            }
            // (generation-history $result) → GenerationStats[]
            if (op === "generation-history") {
                const [arg] = args;
                if (arg instanceof Map) {
                    const history = arg.get("history");
                    return Array.isArray(history) ? history : [];
                }
                return [];
            }
            // (generation-converged $result) → boolean
            if (op === "generation-converged") {
                const [arg] = args;
                if (arg instanceof generation_1.GenerationLoop)
                    return arg.hasConverged();
                if (arg instanceof Map) {
                    const history = arg.get("history") ?? [];
                    if (history.length < 5)
                        return false;
                    const recent = history.slice(-5);
                    const firstBest = recent[0] instanceof Map ? recent[0].get("best") : recent[0]?.best;
                    return recent.every((s) => {
                        const b = s instanceof Map ? s.get("best") : s?.best;
                        return Math.abs(b - firstBest) < 1e-9;
                    });
                }
                return false;
            }
            // (generation-diversity [0.8 0.7 0.9 0.6]) → 다양성 지수
            if (op === "generation-diversity") {
                const [arr] = args;
                const fitnesses = Array.isArray(arr) ? arr.map(Number) : [];
                const tmpLoop = new generation_1.GenerationLoop({ maxGenerations: 1 });
                return tmpLoop.calculateDiversity(fitnesses);
            }
            // (gen-improvement $result) → improvementRatio
            if (op === "gen-improvement") {
                const [arg] = args;
                if (arg instanceof Map)
                    return arg.get("improvementRatio") ?? 0;
                return 0;
            }
            // (gen-termination $result) → terminationReason 문자열
            if (op === "gen-termination") {
                const [arg] = args;
                if (arg instanceof Map)
                    return arg.get("terminationReason") ?? "max-generations";
                return "max-generations";
            }
            // === Phase 134: FITNESS ===
            if (op === "fitness-proximity") {
                const fpValue = Number(args[0]);
                const fpTarget = Number(args[1]);
                const fpTol = args[2] !== undefined ? Number(args[2]) : undefined;
                const fpRes = fitness_1.globalFitness.proximity(fpValue, fpTarget, fpTol);
                return new Map([["score", fpRes.score], ["rawScore", fpRes.rawScore], ["details", new Map(Object.entries(fpRes.details))]]);
            }
            if (op === "fitness-string") {
                const fsA = String(args[0] ?? "");
                const fsB = String(args[1] ?? "");
                const fsRes = fitness_1.globalFitness.stringSimilarity(fsA, fsB);
                return new Map([["score", fsRes.score], ["rawScore", fsRes.rawScore], ["details", new Map(Object.entries(fsRes.details))]]);
            }
            if (op === "fitness-array") {
                const faArr = Array.isArray(args[0]) ? args[0] : [];
                const faTgt = Array.isArray(args[1]) ? args[1] : [];
                const faRes = fitness_1.globalFitness.arrayMatch(faArr, faTgt);
                return new Map([["score", faRes.score], ["rawScore", faRes.rawScore], ["details", new Map(Object.entries(faRes.details))]]);
            }
            if (op === "fitness-multi") {
                const fmVMap = args[0] instanceof Map ? args[0] : new Map();
                const fmTMap = args[1] instanceof Map ? args[1] : new Map();
                const fmWMap = args[2] instanceof Map ? args[2] : undefined;
                const fmV = {};
                const fmT = {};
                const fmW = fmWMap ? {} : undefined;
                fmVMap.forEach((v, k) => { fmV[String(k)] = Number(v); });
                fmTMap.forEach((v, k) => { fmT[String(k)] = Number(v); });
                if (fmWMap && fmW)
                    fmWMap.forEach((v, k) => { fmW[String(k)] = Number(v); });
                const fmRes = fitness_1.globalFitness.multiObjective(fmV, fmT, fmW);
                return new Map([["score", fmRes.score], ["rawScore", fmRes.rawScore], ["details", new Map(Object.entries(fmRes.details))]]);
            }
            if (op === "fitness-constraint") {
                const fcVal = args[0];
                const fcRaw = Array.isArray(args[1]) ? args[1] : [];
                const fcFns = fcRaw.map((c) => {
                    if (typeof c === "function")
                        return c;
                    if (c?.kind === "function-value")
                        return (v) => callFn(c, [v]);
                    if (c === "positive" || c === ":positive")
                        return (v) => typeof v === "number" && v > 0;
                    if (c === "negative" || c === ":negative")
                        return (v) => typeof v === "number" && v < 0;
                    if (c === "even" || c === ":even")
                        return (v) => typeof v === "number" && v % 2 === 0;
                    if (c === "odd" || c === ":odd")
                        return (v) => typeof v === "number" && v % 2 !== 0;
                    if (c === "zero" || c === ":zero")
                        return (v) => v === 0;
                    return () => false;
                });
                const fcRes = fitness_1.globalFitness.constraintSatisfaction(fcVal, fcFns);
                return new Map([["score", fcRes.score], ["rawScore", fcRes.rawScore], ["details", new Map(Object.entries(fcRes.details))]]);
            }
            if (op === "fitness-rank") {
                const frItems = Array.isArray(args[0]) ? args[0] : [];
                const frScorer = args[1];
                const frFn = (item) => {
                    if (typeof frScorer === "function")
                        return frScorer(item);
                    if (frScorer?.kind === "function-value")
                        return callFn(frScorer, [item]);
                    return 0;
                };
                const frRanked = fitness_1.globalFitness.rank(frItems, frFn);
                return frRanked.map((r) => new Map(Object.entries(r)));
            }
            if (op === "fitness-pareto") {
                const fpPItems = Array.isArray(args[0]) ? args[0] : [];
                const fpObjs = (Array.isArray(args[1]) ? args[1] : []).map((f) => {
                    if (typeof f === "function")
                        return f;
                    if (f?.kind === "function-value")
                        return (item) => callFn(f, [item]);
                    return () => 0;
                });
                return fitness_1.globalFitness.paretoFront(fpPItems, fpObjs);
            }
            if (op === "fitness-score") {
                const fsResult = args[0];
                if (fsResult instanceof Map)
                    return fsResult.get("score") ?? 0;
                if (typeof fsResult === "object" && fsResult !== null)
                    return fsResult.score ?? 0;
                return Number(fsResult);
            }
            // === Phase 136: PRUNE ===
            if (op === "prune-threshold") {
                // (prune-threshold $items $scorer :min 0.5)
                const [pItems, pScorerFn, ...pKw] = args;
                const pThreshold = (() => {
                    for (let i = 0; i < pKw.length - 1; i++) {
                        if (pKw[i] === ":min" || pKw[i] === "min")
                            return Number(pKw[i + 1]);
                    }
                    return 0.5;
                })();
                const pScorer1 = (item) => Number(callFn(pScorerFn, [item]));
                const pArr1 = Array.isArray(pItems) ? pItems : [];
                const pruner1 = new prune_1.Pruner();
                return pruneResultToMap(pruner1.pruneByThreshold(pArr1, pScorer1, pThreshold));
            }
            if (op === "prune-top-k") {
                // (prune-top-k $items $scorer :k 5)
                const [pItems, pScorerFn, ...pKw] = args;
                const pK = (() => {
                    for (let i = 0; i < pKw.length - 1; i++) {
                        if (pKw[i] === ":k" || pKw[i] === "k")
                            return Number(pKw[i + 1]);
                    }
                    return 5;
                })();
                const pScorer2 = (item) => Number(callFn(pScorerFn, [item]));
                const pArr2 = Array.isArray(pItems) ? pItems : [];
                const pruner2 = new prune_1.Pruner();
                return pruneResultToMap(pruner2.pruneToTopK(pArr2, pScorer2, pK));
            }
            if (op === "prune-top-percent") {
                // (prune-top-percent $items $scorer :percent 0.3)
                const [pItems, pScorerFn, ...pKw] = args;
                const pPct = (() => {
                    for (let i = 0; i < pKw.length - 1; i++) {
                        if (pKw[i] === ":percent" || pKw[i] === "percent")
                            return Number(pKw[i + 1]);
                    }
                    return 0.3;
                })();
                const pScorer3 = (item) => Number(callFn(pScorerFn, [item]));
                const pArr3 = Array.isArray(pItems) ? pItems : [];
                const pruner3 = new prune_1.Pruner();
                return pruneResultToMap(pruner3.pruneToTopPercent(pArr3, pScorer3, pPct));
            }
            if (op === "prune-diversity") {
                // (prune-diversity $items $scorer $similarity :min 0.2)
                const [pItems, pScorerFn, pSimFn, ...pKw] = args;
                const pMinDiv = (() => {
                    for (let i = 0; i < pKw.length - 1; i++) {
                        if (pKw[i] === ":min" || pKw[i] === "min")
                            return Number(pKw[i + 1]);
                    }
                    return 0.2;
                })();
                const pScorer4 = (item) => Number(callFn(pScorerFn, [item]));
                const pSim4 = (a, b) => Number(callFn(pSimFn, [a, b]));
                const pArr4 = Array.isArray(pItems) ? pItems : [];
                const pruner4 = new prune_1.Pruner();
                return pruneResultToMap(pruner4.pruneForDiversity(pArr4, pScorer4, pSim4, pMinDiv));
            }
            if (op === "prune-dedup") {
                // (prune-dedup $items)
                const [pItems, pKeyFn] = args;
                const pArr5 = Array.isArray(pItems) ? pItems : [];
                const pruner5 = new prune_1.Pruner();
                const pKeyFnWrapped = pKeyFn ? (item) => String(callFn(pKeyFn, [item])) : undefined;
                return pruneResultToMap(pruner5.dedup(pArr5, pKeyFnWrapped));
            }
            if (op === "prune-weak") {
                // (prune-weak $items $scorer)
                const [pItems, pScorerFn] = args;
                const pScorer6 = (item) => Number(callFn(pScorerFn, [item]));
                const pArr6 = Array.isArray(pItems) ? pItems : [];
                const pruner6 = new prune_1.Pruner();
                return pruneResultToMap(pruner6.pruneWeak(pArr6, pScorer6));
            }
            if (op === "keep-best") {
                // (keep-best $items $scorer :k 3)
                const [pItems, pScorerFn, ...pKw] = args;
                const pK7 = (() => {
                    for (let i = 0; i < pKw.length - 1; i++) {
                        if (pKw[i] === ":k" || pKw[i] === "k")
                            return Number(pKw[i + 1]);
                    }
                    return 3;
                })();
                const pScorer7 = (item) => Number(callFn(pScorerFn, [item]));
                const pArr7 = Array.isArray(pItems) ? pItems : [];
                return (0, prune_1.keepBest)(pArr7, pScorer7, pK7);
            }
            if (op === "prune-stats") {
                // (prune-stats $result) → stats 객체
                const pRes = args[0];
                if (pRes instanceof Map && pRes.has("stats")) {
                    return pRes.get("stats");
                }
                return null;
            }
            // Phase 137: REFACTOR-SELF 빌트인
            if (op.startsWith("refactor-")) {
                const r137 = evalRefactorSelf(op, args);
                if (r137 !== null)
                    return r137;
            }
            // === Phase 139: VERSION-SELF ===
            // version-snapshot: (version-snapshot $data "설명") → Snapshot
            if (op === "version-snapshot") {
                const data = args[0] ?? null;
                const description = String(args[1] ?? "snapshot");
                const tags = [];
                let performance;
                for (let i = 2; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "tags" && Array.isArray(v))
                        tags.push(...v.map(String));
                    if (k === "performance")
                        performance = Number(v);
                }
                const snap = version_self_1.globalVersioning.snapshot(data, description, tags, performance);
                return new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["timestamp", snap.timestamp.toISOString()],
                    ["data", snap.data],
                    ["description", snap.metadata.description],
                    ["tags", snap.metadata.tags],
                    ["performance", snap.metadata.performance ?? null],
                    ["parentId", snap.parentId ?? null],
                    ["diff", snap.diff ?? null],
                ]);
            }
            // version-rollback: (version-rollback $id) → RollbackResult
            if (op === "version-rollback") {
                const id = String(args[0] ?? "");
                const result = version_self_1.globalVersioning.rollback(id);
                return new Map([
                    ["success", result.success],
                    ["reason", result.reason ?? null],
                    ["previousId", result.previous?.id ?? null],
                    ["restoredId", result.restored?.id ?? null],
                ]);
            }
            // version-prev: (version-prev) → 이전 버전으로 롤백
            if (op === "version-prev") {
                const result = version_self_1.globalVersioning.rollbackPrev();
                return new Map([
                    ["success", result.success],
                    ["reason", result.reason ?? null],
                    ["previousId", result.previous?.id ?? null],
                    ["restoredId", result.restored?.id ?? null],
                ]);
            }
            // version-diff: (version-diff $id1 $id2) → diff 문자열
            if (op === "version-diff") {
                const id1 = String(args[0] ?? "");
                const id2 = String(args[1] ?? "");
                return version_self_1.globalVersioning.diff(id1, id2);
            }
            // version-get: (version-get $id) → Snapshot
            if (op === "version-get") {
                const id = String(args[0] ?? "");
                const snap = version_self_1.globalVersioning.get(id);
                if (!snap)
                    return null;
                return new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["timestamp", snap.timestamp.toISOString()],
                    ["data", snap.data],
                    ["description", snap.metadata.description],
                    ["tags", snap.metadata.tags],
                    ["performance", snap.metadata.performance ?? null],
                    ["parentId", snap.parentId ?? null],
                    ["diff", snap.diff ?? null],
                ]);
            }
            // version-latest: (version-latest) → 최신 Snapshot
            if (op === "version-latest") {
                const snap = version_self_1.globalVersioning.latest();
                if (!snap)
                    return null;
                return new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["timestamp", snap.timestamp.toISOString()],
                    ["data", snap.data],
                    ["description", snap.metadata.description],
                    ["tags", snap.metadata.tags],
                    ["performance", snap.metadata.performance ?? null],
                    ["parentId", snap.parentId ?? null],
                ]);
            }
            // version-history: (version-history) → Snapshot[]
            if (op === "version-history") {
                return version_self_1.globalVersioning.getHistory().map(snap => new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["timestamp", snap.timestamp.toISOString()],
                    ["description", snap.metadata.description],
                    ["tags", snap.metadata.tags],
                    ["parentId", snap.parentId ?? null],
                ]));
            }
            // version-branch: (version-branch "name") → 브랜치 ID
            if (op === "version-branch") {
                const name = String(args[0] ?? "");
                const fromId = args[1] ? String(args[1]) : undefined;
                return version_self_1.globalVersioning.branch(name, fromId);
            }
            // version-checkout: (version-checkout "name") → Snapshot
            if (op === "version-checkout") {
                const name = String(args[0] ?? "");
                const snap = version_self_1.globalVersioning.checkout(name);
                if (!snap)
                    return null;
                return new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["description", snap.metadata.description],
                ]);
            }
            // version-best: (version-best) → 최고 성능 Snapshot
            if (op === "version-best") {
                const snap = version_self_1.globalVersioning.bestPerforming();
                if (!snap)
                    return null;
                return new Map([
                    ["id", snap.id],
                    ["version", snap.version],
                    ["performance", snap.metadata.performance ?? null],
                    ["description", snap.metadata.description],
                ]);
            }
            // === Phase 138: BENCHMARK-SELF ===
            // bench-measure: (bench-measure "name" $fn :runs 100) → BenchmarkResult
            if (op === "bench-measure") {
                const bName = String(args[0] ?? "unnamed");
                const bFn = args[1];
                let bRuns = 100;
                for (let i = 2; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    if (k === "runs")
                        bRuns = Number(args[i + 1]);
                }
                const bCallable = () => typeof bFn === 'function' ? bFn() : callFnVal(bFn, []);
                const bResult = benchmark_self_1.globalBenchmark.measure(bName, bCallable, bRuns);
                return new Map([
                    ["name", bResult.name],
                    ["runs", bResult.runs],
                    ["totalMs", bResult.totalMs],
                    ["avgMs", bResult.avgMs],
                    ["minMs", bResult.minMs],
                    ["maxMs", bResult.maxMs],
                    ["p50", bResult.p50],
                    ["p95", bResult.p95],
                    ["p99", bResult.p99],
                    ["opsPerSec", bResult.opsPerSec],
                    ["memoryUsed", bResult.memoryUsed ?? 0],
                ]);
            }
            // bench-compare: (bench-compare $fn1 $fn2 :runs 50) → ComparisonResult
            if (op === "bench-compare") {
                const bcFn1 = args[0];
                const bcFn2 = args[1];
                let bcRuns = 50;
                for (let i = 2; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    if (k === "runs")
                        bcRuns = Number(args[i + 1]);
                }
                const bcCallable1 = () => typeof bcFn1 === 'function' ? bcFn1() : callFnVal(bcFn1, []);
                const bcCallable2 = () => typeof bcFn2 === 'function' ? bcFn2() : callFnVal(bcFn2, []);
                const bcResult = benchmark_self_1.globalBenchmark.compare("fn1", bcCallable1, "fn2", bcCallable2, bcRuns);
                const bcToMap = (r) => new Map([
                    ["name", r.name], ["runs", r.runs], ["avgMs", r.avgMs],
                    ["minMs", r.minMs], ["maxMs", r.maxMs], ["p50", r.p50],
                    ["p95", r.p95], ["p99", r.p99], ["opsPerSec", r.opsPerSec],
                ]);
                return new Map([
                    ["baseline", bcToMap(bcResult.baseline)],
                    ["target", bcToMap(bcResult.target)],
                    ["speedup", bcResult.speedup],
                    ["winner", bcResult.winner],
                    ["significant", bcResult.significant],
                ]);
            }
            // bench-suite: (bench-suite "suite-name") → 새 SelfBenchmark 인스턴스
            if (op === "bench-suite") {
                const bsName = String(args[0] ?? "suite");
                return new benchmark_self_1.SelfBenchmark(bsName);
            }
            // bench-add: (bench-add $suite "test" $fn) → suite에 추가
            if (op === "bench-add") {
                const baSuite = args[0];
                const baName = String(args[1] ?? "test");
                const baFn = args[2];
                if (baSuite instanceof benchmark_self_1.SelfBenchmark) {
                    const baCallable = () => typeof baFn === 'function' ? baFn() : callFnVal(baFn, []);
                    baSuite.add(baName, baCallable);
                    return baSuite;
                }
                return null;
            }
            // bench-run: (bench-run $suite :runs 100) → BenchmarkSuite (실행 완료)
            if (op === "bench-run") {
                const brSuite = args[0];
                let brRuns = 100;
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    if (k === "runs")
                        brRuns = Number(args[i + 1]);
                }
                if (brSuite instanceof benchmark_self_1.SelfBenchmark) {
                    const brResult = brSuite.run(brRuns);
                    const brToMap = (r) => new Map([
                        ["name", r.name], ["runs", r.runs], ["avgMs", r.avgMs],
                        ["minMs", r.minMs], ["maxMs", r.maxMs], ["opsPerSec", r.opsPerSec],
                    ]);
                    return new Map([
                        ["name", brResult.name],
                        ["results", brResult.results.map(brToMap)],
                        ["startTime", brResult.startTime.toISOString()],
                        ["endTime", brResult.endTime?.toISOString() ?? ""],
                        ["summary", new Map([
                                ["total", brResult.summary.total],
                                ["fastest", brResult.summary.fastest ? brToMap(brResult.summary.fastest) : null],
                                ["slowest", brResult.summary.slowest ? brToMap(brResult.summary.slowest) : null],
                                ["avgOpsPerSec", brResult.summary.avgOpsPerSec],
                            ])],
                    ]);
                }
                return null;
            }
            // bench-report: (bench-report $result) → 텍스트 리포트
            if (op === "bench-report") {
                const rpResult = args[0];
                if (rpResult instanceof Map) {
                    const r = {
                        name: String(rpResult.get("name") ?? ""),
                        runs: Number(rpResult.get("runs") ?? 0),
                        totalMs: Number(rpResult.get("totalMs") ?? 0),
                        avgMs: Number(rpResult.get("avgMs") ?? 0),
                        minMs: Number(rpResult.get("minMs") ?? 0),
                        maxMs: Number(rpResult.get("maxMs") ?? 0),
                        p50: Number(rpResult.get("p50") ?? 0),
                        p95: Number(rpResult.get("p95") ?? 0),
                        p99: Number(rpResult.get("p99") ?? 0),
                        opsPerSec: Number(rpResult.get("opsPerSec") ?? 0),
                        memoryUsed: Number(rpResult.get("memoryUsed") ?? 0),
                    };
                    return benchmark_self_1.globalBenchmark.report(r);
                }
                return "No benchmark result provided";
            }
            // bench-speedup: (bench-speedup $comparison) → speedup 배수
            if (op === "bench-speedup") {
                const spComp = args[0];
                if (spComp instanceof Map) {
                    return Number(spComp.get("speedup") ?? 1);
                }
                return 1;
            }
            // bench-stats: (bench-stats $result) → {avg, min, max, p95, p99, opsPerSec}
            if (op === "bench-stats") {
                const stResult = args[0];
                if (stResult instanceof Map) {
                    return new Map([
                        ["avg", stResult.get("avgMs")],
                        ["min", stResult.get("minMs")],
                        ["max", stResult.get("maxMs")],
                        ["p95", stResult.get("p95")],
                        ["p99", stResult.get("p99")],
                        ["opsPerSec", stResult.get("opsPerSec")],
                    ]);
                }
                return new Map([
                    ["avg", 0], ["min", 0], ["max", 0],
                    ["p95", 0], ["p99", 0], ["opsPerSec", 0],
                ]);
            }
            // === Phase 140: SELF-EVOLUTION HUB ===
            // (self-evolve $population $fitness $mutate $crossover :gens 50) → EvolutionCycleResult
            if (op === "self-evolve") {
                const [popArg, fitnessFnArg, mutateFnArg, crossoverFnArg, ...rest] = args;
                const population = Array.isArray(popArg) ? popArg : [];
                const cfg = {};
                for (let i = 0; i < rest.length - 1; i += 2) {
                    const k = String(rest[i]).replace(/^:/, "");
                    const v = rest[i + 1];
                    if (k === "gens" || k === "generations")
                        cfg.generations = Number(v);
                    else if (k === "pop" || k === "populationSize")
                        cfg.populationSize = Number(v);
                    else if (k === "rate" || k === "mutationRate")
                        cfg.mutationRate = Number(v);
                    else if (k === "elite" || k === "eliteRatio")
                        cfg.eliteRatio = Number(v);
                    else if (k === "prune" || k === "pruneThreshold")
                        cfg.pruneThreshold = Number(v);
                    else if (k === "versioning" || k === "enableVersioning")
                        cfg.enableVersioning = v === true || v === "true";
                    else if (k === "benchmark" || k === "enableBenchmark")
                        cfg.enableBenchmark = v === true || v === "true";
                    else if (k === "refactor" || k === "enableRefactor")
                        cfg.enableRefactor = v === true || v === "true";
                }
                const mkFn1 = (fnArg) => (item) => {
                    if (typeof fnArg === "function")
                        return fnArg(item);
                    if (fnArg?.kind === "function-value")
                        return callFn(fnArg, [item]);
                    return item;
                };
                const fitnessFunc140 = (item) => Number(mkFn1(fitnessFnArg)(item));
                const mutateFunc140 = (item) => mkFn1(mutateFnArg)(item);
                const crossoverFunc140 = (a, b) => {
                    if (typeof crossoverFnArg === "function")
                        return crossoverFnArg(a, b);
                    if (crossoverFnArg?.kind === "function-value")
                        return callFn(crossoverFnArg, [a, b]);
                    return a;
                };
                const r140 = self_evolution_hub_1.globalSelfEvolution.runCycle(population, fitnessFunc140, mutateFunc140, crossoverFunc140, cfg);
                return new Map([
                    ["best", r140.best],
                    ["bestFitness", r140.bestFitness],
                    ["generations", r140.generations],
                    ["improvements", r140.improvements],
                    ["prunedCount", r140.prunedCount],
                    ["benchmarkMs", r140.benchmarkMs ?? null],
                    ["versionId", r140.versionId ?? null],
                    ["report", r140.report],
                ]);
            }
            // (self-evolve-numbers [1 2 3 4 5] :gens 30) → EvolutionCycleResult
            if (op === "self-evolve-numbers") {
                const target140 = Array.isArray(args[0]) ? args[0].map(Number) : [1, 2, 3];
                const cfg140 = {};
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "gens" || k === "generations")
                        cfg140.generations = Number(v);
                    else if (k === "pop" || k === "populationSize")
                        cfg140.populationSize = Number(v);
                    else if (k === "rate" || k === "mutationRate")
                        cfg140.mutationRate = Number(v);
                    else if (k === "versioning" || k === "enableVersioning")
                        cfg140.enableVersioning = v === true || v === "true";
                    else if (k === "benchmark" || k === "enableBenchmark")
                        cfg140.enableBenchmark = v === true || v === "true";
                    else if (k === "refactor" || k === "enableRefactor")
                        cfg140.enableRefactor = v === true || v === "true";
                }
                const r140n = self_evolution_hub_1.globalSelfEvolution.evolveNumbers(target140, cfg140);
                return new Map([
                    ["best", r140n.best],
                    ["bestFitness", r140n.bestFitness],
                    ["generations", r140n.generations],
                    ["improvements", r140n.improvements],
                    ["prunedCount", r140n.prunedCount],
                    ["benchmarkMs", r140n.benchmarkMs ?? null],
                    ["versionId", r140n.versionId ?? null],
                    ["report", r140n.report],
                ]);
            }
            // (self-evolve-string "target" :gens 50) → EvolutionCycleResult
            if (op === "self-evolve-string") {
                const target140s = String(args[0] ?? "hello");
                const cfg140s = {};
                for (let i = 1; i < args.length - 1; i += 2) {
                    const k = String(args[i]).replace(/^:/, "");
                    const v = args[i + 1];
                    if (k === "gens" || k === "generations")
                        cfg140s.generations = Number(v);
                    else if (k === "pop" || k === "populationSize")
                        cfg140s.populationSize = Number(v);
                    else if (k === "rate" || k === "mutationRate")
                        cfg140s.mutationRate = Number(v);
                    else if (k === "versioning" || k === "enableVersioning")
                        cfg140s.enableVersioning = v === true || v === "true";
                    else if (k === "benchmark" || k === "enableBenchmark")
                        cfg140s.enableBenchmark = v === true || v === "true";
                }
                const r140s = self_evolution_hub_1.globalSelfEvolution.evolveString(target140s, cfg140s);
                return new Map([
                    ["best", r140s.best],
                    ["bestFitness", r140s.bestFitness],
                    ["generations", r140s.generations],
                    ["improvements", r140s.improvements],
                    ["prunedCount", r140s.prunedCount],
                    ["benchmarkMs", r140s.benchmarkMs ?? null],
                    ["versionId", r140s.versionId ?? null],
                    ["report", r140s.report],
                ]);
            }
            // (evolution-report $results) → SelfEvolutionReport
            if (op === "evolution-report") {
                const rawResults140 = Array.isArray(args[0]) ? args[0] : [args[0]].filter(Boolean);
                const results140 = rawResults140.map((r) => {
                    if (r instanceof Map) {
                        return {
                            best: r.get("best"),
                            bestFitness: Number(r.get("bestFitness") ?? 0),
                            generations: Number(r.get("generations") ?? 0),
                            improvements: Number(r.get("improvements") ?? 0),
                            prunedCount: Number(r.get("prunedCount") ?? 0),
                            benchmarkMs: r.get("benchmarkMs") ?? undefined,
                            versionId: r.get("versionId") ?? undefined,
                            report: String(r.get("report") ?? ""),
                        };
                    }
                    return r;
                });
                const rep140 = self_evolution_hub_1.globalSelfEvolution.generateReport(results140);
                return new Map([
                    ["timestamp", rep140.timestamp.toISOString()],
                    ["cycles", rep140.cycles],
                    ["totalGenerations", rep140.totalGenerations],
                    ["fitnessProgress", rep140.fitnessProgress],
                    ["refactorSuggestions", rep140.refactorSuggestions],
                    ["versions", rep140.versions],
                    ["summary", rep140.summary],
                ]);
            }
            // (self-improve $config) → {optimized, improvement}
            if (op === "self-improve") {
                const rawCfg140 = args[0];
                const cfg140i = {};
                if (rawCfg140 instanceof Map) {
                    const gens = rawCfg140.get("generations") ?? rawCfg140.get("gens");
                    const pop = rawCfg140.get("populationSize") ?? rawCfg140.get("pop");
                    const rate = rawCfg140.get("mutationRate") ?? rawCfg140.get("rate");
                    if (gens !== undefined)
                        cfg140i.generations = Number(gens);
                    if (pop !== undefined)
                        cfg140i.populationSize = Number(pop);
                    if (rate !== undefined)
                        cfg140i.mutationRate = Number(rate);
                }
                const imp140 = self_evolution_hub_1.globalSelfEvolution.selfImprove(cfg140i);
                return new Map([
                    ["optimized", new Map(Object.entries(imp140.optimized))],
                    ["improvement", imp140.improvement],
                ]);
            }
            // (evolve-cycle $pop $fitness) → 기본 설정으로 진화 실행
            if (op === "evolve-cycle") {
                const [popArg140, fitnessFnArg140] = args;
                const population140 = Array.isArray(popArg140) ? popArg140 : [];
                const fitnessFunc140c = (item) => {
                    if (typeof fitnessFnArg140 === "function")
                        return Number(fitnessFnArg140(item));
                    if (fitnessFnArg140?.kind === "function-value")
                        return Number(callFn(fitnessFnArg140, [item]));
                    return typeof item === "number" ? item : 0;
                };
                const mutateFunc140c = (item) => {
                    if (Array.isArray(item)) {
                        const arr = [...item];
                        const idx = Math.floor(Math.random() * arr.length);
                        arr[idx] += (Math.random() - 0.5) * 0.2;
                        return arr;
                    }
                    return item;
                };
                const crossoverFunc140c = (a, b) => {
                    if (Array.isArray(a) && Array.isArray(b)) {
                        const point = Math.floor(Math.random() * a.length);
                        return [...a.slice(0, point), ...b.slice(point)];
                    }
                    return a;
                };
                const rc140 = self_evolution_hub_1.globalSelfEvolution.runCycle(population140, fitnessFunc140c, mutateFunc140c, crossoverFunc140c);
                return new Map([
                    ["best", rc140.best],
                    ["bestFitness", rc140.bestFitness],
                    ["generations", rc140.generations],
                    ["improvements", rc140.improvements],
                    ["prunedCount", rc140.prunedCount],
                    ["report", rc140.report],
                ]);
            }
            // (evolution-best $result) → best 솔루션
            if (op === "evolution-best") {
                const [arg140] = args;
                if (arg140 instanceof Map)
                    return arg140.get("best") ?? null;
                return null;
            }
            // (evolution-fitness $result) → bestFitness
            if (op === "evolution-fitness") {
                const [arg140f] = args;
                if (arg140f instanceof Map)
                    return arg140f.get("bestFitness") ?? 0;
                return 0;
            }
            // === Phase 141: WORLD-MODEL ===
            if (op.startsWith("world-")) {
                const r141 = evalWorldModel141(op, args);
                if (r141 !== undefined)
                    return r141;
            }
            // === Phase 143: COUNTERFACTUAL ===
            if (op.startsWith("cf-")) {
                const r143 = evalCounterfactual(op, args, callFn);
                if (r143 !== null)
                    return r143;
            }
            // === Phase 146: ALIGN ===
            if (op.startsWith("align-")) {
                const r146 = evalAlign(op, args);
                if (r146 !== null)
                    return r146;
            }
            // === Phase 142: CAUSAL (inline) ===
            if (op === 'causal-add-node') {
                const kw142 = {};
                for (let i = 0; i < args.length - 1; i += 2) {
                    const key = String(args[i]).replace(/^:/, '');
                    kw142[key] = args[i + 1];
                }
                const node142 = { id: String(kw142['id'] ?? ''), name: String(kw142['name'] ?? kw142['id'] ?? ''), description: String(kw142['desc'] ?? kw142['description'] ?? ''), value: kw142['value'] !== undefined ? Number(kw142['value']) : undefined };
                causal_1.globalCausal.addNode(node142);
                return new Map([['id', node142.id], ['name', node142.name], ['description', node142.description]]);
            }
            if (op === 'causal-add-edge') {
                const kw142e = {};
                for (let i = 0; i < args.length - 1; i += 2) {
                    const key = String(args[i]).replace(/^:/, '');
                    kw142e[key] = args[i + 1];
                }
                const edge142 = { from: String(kw142e['from'] ?? ''), to: String(kw142e['to'] ?? ''), strength: Number(kw142e['strength'] ?? 1), confidence: Number(kw142e['confidence'] ?? 1), delay: kw142e['delay'] !== undefined ? Number(kw142e['delay']) : undefined, mechanism: kw142e['mechanism'] !== undefined ? String(kw142e['mechanism']) : undefined };
                causal_1.globalCausal.addEdge(edge142);
                return new Map([['from', edge142.from], ['to', edge142.to], ['strength', edge142.strength], ['confidence', edge142.confidence]]);
            }
            if (op === 'causal-explain') {
                const expl142 = causal_1.globalCausal.explain(String(args[0] ?? ''));
                return new Map([
                    ['effect', expl142.effect], ['primaryCause', expl142.primaryCause],
                    ['explanation', expl142.explanation], ['confidence', expl142.confidence],
                    ['causes', expl142.causes.map((c) => new Map([
                            ['cause', c.cause], ['contribution', c.contribution],
                            ['chain', new Map([
                                    ['path', c.chain.path], ['totalStrength', c.chain.totalStrength],
                                    ['explanation', c.chain.explanation], ['confidence', c.chain.confidence],
                                ])],
                        ]))],
                ]);
            }
            if (op === 'causal-chains') {
                const ch142 = causal_1.globalCausal.findCausalChains(String(args[0] ?? ''), String(args[1] ?? ''));
                return ch142.map((c) => new Map([['path', c.path], ['totalStrength', c.totalStrength], ['explanation', c.explanation], ['confidence', c.confidence]]));
            }
            if (op === 'causal-causes') {
                return causal_1.globalCausal.getDirectCauses(String(args[0] ?? '')).map((e) => new Map([['from', e.from], ['to', e.to], ['strength', e.strength], ['confidence', e.confidence]]));
            }
            if (op === 'causal-effects') {
                return causal_1.globalCausal.getDirectEffects(String(args[0] ?? '')).map((e) => new Map([['from', e.from], ['to', e.to], ['strength', e.strength], ['confidence', e.confidence]]));
            }
            if (op === 'causal-roots') {
                return causal_1.globalCausal.findRootCauses(String(args[0] ?? ''));
            }
            if (op === 'causal-simulate') {
                const arg142 = args[0];
                const iv142 = {};
                if (arg142 instanceof Map) {
                    for (const [k, v] of arg142.entries())
                        iv142[String(k)] = Number(v);
                }
                return new Map(Object.entries(causal_1.globalCausal.simulate(iv142)));
            }
            if (op === 'causal-why') {
                const chain142 = (0, causal_1.whyCaused)(String(args[0] ?? ''), String(args[1] ?? ''));
                if (chain142 === null)
                    return null;
                return new Map([['path', chain142.path], ['totalStrength', chain142.totalStrength], ['explanation', chain142.explanation], ['confidence', chain142.confidence]]);
            }
            if (op === 'causal-summary') {
                return causal_1.globalCausal.summarize(String(args[0] ?? ''));
            }
            // === Phase 144: PREDICT ===
            if (op.startsWith("predict-")) {
                const r144 = evalPredict_PHASE144(op, args);
                if (r144 !== null)
                    return r144;
            }
            // === Phase 148: CURIOSITY ===
            if (op.startsWith("curiosity-")) {
                const r148 = evalCuriosity(op, args, callFn);
                if (r148 !== null)
                    return r148;
            }
            // === Phase 149: WISDOM ===
            if (op.startsWith("wisdom-")) {
                const r149 = evalWisdom(op, args);
                if (r149 !== null)
                    return r149;
            }
            // === Phase 145: EXPLAIN ===
            if (op.startsWith("explain-")) {
                const r145 = evalExplain_PHASE145(op, args, callFnVal);
                if (r145 !== null)
                    return r145;
            }
            // Phase 59: callUserFunction을 통해 FunctionNotFoundError(유사 함수 힌트 포함) 발생
            return callUser(op, args);
        }
    }
}
// Phase 136: PruneResult → Map 변환 헬퍼
function pruneResultToMap(result) {
    const statsMap = new Map([
        ["originalCount", result.stats.originalCount],
        ["keptCount", result.stats.keptCount],
        ["removedCount", result.stats.removedCount],
        ["avgFitnessKept", result.stats.avgFitnessKept],
        ["avgFitnessRemoved", result.stats.avgFitnessRemoved],
    ]);
    return new Map([
        ["kept", result.kept],
        ["removed", result.removed],
        ["keptRatio", result.keptRatio],
        ["strategy", result.strategy],
        ["stats", statsMap],
    ]);
}
// === Phase 137: REFACTOR-SELF 독립 헬퍼 ===
// (eval-builtins.ts 내 switch 블록 외부에서 refactor-* op 처리를 위해 export)
function evalRefactorSelf(op, args) {
    if (op === "refactor-analyze") {
        const code = String(args[0] ?? "");
        const result = refactor_self_1.globalRefactorer.refactor(code, true);
        return new Map([
            ["suggestions", result.suggestions.map((s) => new Map([
                    ["pattern", s.pattern], ["location", s.location], ["original", s.original],
                    ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
                ]))],
            ["applied", result.applied],
            ["skipped", result.skipped],
            ["score", new Map([
                    ["before", result.score.before], ["after", result.score.after], ["improvement", result.score.improvement],
                ])],
        ]);
    }
    if (op === "refactor-suggest") {
        const code = String(args[0] ?? "");
        return refactor_self_1.globalRefactorer.suggest(code).map((s) => new Map([
            ["pattern", s.pattern], ["location", s.location], ["original", s.original],
            ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
        ]));
    }
    if (op === "refactor-apply") {
        const code = String(args[0] ?? "");
        const rawSuggestions = Array.isArray(args[1]) ? args[1] : [];
        const suggestions = rawSuggestions.map((s) => {
            if (s instanceof Map)
                return {
                    pattern: s.get("pattern") ?? "extract-duplicate", location: s.get("location") ?? "",
                    original: s.get("original") ?? "", suggested: s.get("suggested") ?? "",
                    reason: s.get("reason") ?? "", impact: s.get("impact") ?? "low",
                };
            return s;
        });
        const applyResult = refactor_self_1.globalRefactorer.apply(code, suggestions);
        return new Map([
            ["code", applyResult.code],
            ["applied", applyResult.applied.map((s) => new Map([
                    ["pattern", s.pattern], ["location", s.location], ["impact", s.impact],
                ]))],
        ]);
    }
    if (op === "refactor-complexity") {
        const code = String(args[0] ?? "");
        const c = refactor_self_1.globalRefactorer.analyzeComplexity(code);
        return new Map([["lines", c.lines], ["depth", c.depth], ["conditions", c.conditions], ["score", c.score]]);
    }
    if (op === "refactor-quality") {
        const code = String(args[0] ?? "");
        return refactor_self_1.globalRefactorer.qualityScore(code);
    }
    if (op === "refactor-naming") {
        const code = String(args[0] ?? "");
        const n = refactor_self_1.globalRefactorer.analyzeNaming(code);
        return new Map([
            ["issues", n.issues.map((i) => new Map([
                    ["name", i.name], ["suggestion", i.suggestion], ["reason", i.reason],
                ]))],
            ["score", n.score],
        ]);
    }
    if (op === "refactor-duplicates") {
        const code = String(args[0] ?? "");
        return refactor_self_1.globalRefactorer.findDuplicates(code).map((s) => new Map([
            ["pattern", s.pattern], ["location", s.location], ["original", s.original],
            ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
        ]));
    }
    if (op === "refactor-score") {
        const r = args[0];
        if (r instanceof Map) {
            const score = r.get("score");
            if (score instanceof Map)
                return new Map([
                    ["before", score.get("before") ?? 0], ["after", score.get("after") ?? 0], ["improvement", score.get("improvement") ?? 0],
                ]);
        }
        return new Map([["before", 0], ["after", 0], ["improvement", 0]]);
    }
    // === Phase 142: CAUSAL ===
    // (causal-add-node :id "rain" :name "비" :desc "강수")
    if (op === "causal-add-node") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const node = {
            id: String(kw["id"] ?? ""),
            name: String(kw["name"] ?? kw["id"] ?? ""),
            description: String(kw["desc"] ?? kw["description"] ?? ""),
            value: kw["value"] !== undefined ? Number(kw["value"]) : undefined,
        };
        causal_1.globalCausal.addNode(node);
        return new Map([["id", node.id], ["name", node.name], ["description", node.description]]);
    }
    // (causal-add-edge :from "rain" :to "wet-road" :strength 0.9 :confidence 0.95)
    if (op === "causal-add-edge") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const edge = {
            from: String(kw["from"] ?? ""),
            to: String(kw["to"] ?? ""),
            strength: Number(kw["strength"] ?? 1),
            confidence: Number(kw["confidence"] ?? 1),
            delay: kw["delay"] !== undefined ? Number(kw["delay"]) : undefined,
            mechanism: kw["mechanism"] !== undefined ? String(kw["mechanism"]) : undefined,
        };
        causal_1.globalCausal.addEdge(edge);
        return new Map([["from", edge.from], ["to", edge.to], ["strength", edge.strength], ["confidence", edge.confidence]]);
    }
    // (causal-explain "wet-road") → CausalExplanation
    if (op === "causal-explain") {
        const effectId = String(args[0] ?? "");
        const expl = causal_1.globalCausal.explain(effectId);
        return new Map([
            ["effect", expl.effect],
            ["primaryCause", expl.primaryCause],
            ["explanation", expl.explanation],
            ["confidence", expl.confidence],
            ["causes", expl.causes.map(c => new Map([
                    ["cause", c.cause], ["contribution", c.contribution],
                    ["chain", new Map([
                            ["path", c.chain.path], ["totalStrength", c.chain.totalStrength],
                            ["explanation", c.chain.explanation], ["confidence", c.chain.confidence],
                        ])],
                ]))],
        ]);
    }
    // (causal-chains "rain" "accident") → CausalChain[]
    if (op === "causal-chains") {
        const causeId = String(args[0] ?? "");
        const effectId = String(args[1] ?? "");
        const chains = causal_1.globalCausal.findCausalChains(causeId, effectId);
        return chains.map(c => new Map([
            ["path", c.path], ["totalStrength", c.totalStrength],
            ["explanation", c.explanation], ["confidence", c.confidence],
        ]));
    }
    // (causal-causes "wet-road") → 직접 원인들
    if (op === "causal-causes") {
        const nodeId = String(args[0] ?? "");
        const causes = causal_1.globalCausal.getDirectCauses(nodeId);
        return causes.map(e => new Map([
            ["from", e.from], ["to", e.to], ["strength", e.strength], ["confidence", e.confidence],
        ]));
    }
    // (causal-effects "rain") → 직접 결과들
    if (op === "causal-effects") {
        const nodeId = String(args[0] ?? "");
        const effects = causal_1.globalCausal.getDirectEffects(nodeId);
        return effects.map(e => new Map([
            ["from", e.from], ["to", e.to], ["strength", e.strength], ["confidence", e.confidence],
        ]));
    }
    // (causal-roots "accident") → 루트 원인들
    if (op === "causal-roots") {
        const nodeId = String(args[0] ?? "");
        return causal_1.globalCausal.findRootCauses(nodeId);
    }
    // (causal-simulate {:rain 1.0}) → 파급효과 맵
    if (op === "causal-simulate") {
        const arg = args[0];
        const interventions = {};
        if (arg instanceof Map) {
            for (const [k, v] of arg.entries()) {
                interventions[String(k)] = Number(v);
            }
        }
        const result = causal_1.globalCausal.simulate(interventions);
        return new Map(Object.entries(result));
    }
    // (causal-why "effect-id" "cause-id") → CausalChain or nil
    if (op === "causal-why") {
        const effectId = String(args[0] ?? "");
        const causeId = String(args[1] ?? "");
        const chain = (0, causal_1.whyCaused)(effectId, causeId);
        if (chain === null)
            return null;
        return new Map([
            ["path", chain.path], ["totalStrength", chain.totalStrength],
            ["explanation", chain.explanation], ["confidence", chain.confidence],
        ]);
    }
    // (causal-summary "rain") → 요약 문자열
    if (op === "causal-summary") {
        const nodeId = String(args[0] ?? "");
        return causal_1.globalCausal.summarize(nodeId);
    }
    return null;
}
// === Phase 146: ALIGN ===
function evalAlign(op, args) {
    // (align-add-goal :id "g1" :desc "설명" :priority 9 :measurable true :metric "m" :target 100)
    if (op === "align-add-goal") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const goal = {
            id: String(kw["id"] ?? `goal_${Date.now()}`),
            description: String(kw["desc"] ?? kw["description"] ?? ""),
            priority: Number(kw["priority"] ?? 5),
            measurable: Boolean(kw["measurable"] ?? false),
            metric: kw["metric"] !== undefined ? String(kw["metric"]) : undefined,
            target: kw["target"] !== undefined ? Number(kw["target"]) : undefined,
        };
        align_1.globalAlignment.addGoal(goal);
        return new Map([
            ["id", goal.id], ["description", goal.description],
            ["priority", goal.priority], ["measurable", goal.measurable],
        ]);
    }
    // (align-add-value :id "v1" :name "정직" :desc "거짓말 안 함" :weight 0.9)
    if (op === "align-add-value") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const value = {
            id: String(kw["id"] ?? `value_${Date.now()}`),
            name: String(kw["name"] ?? ""),
            description: String(kw["desc"] ?? kw["description"] ?? ""),
            weight: Number(kw["weight"] ?? 0.5),
        };
        align_1.globalAlignment.addValue(value);
        return new Map([
            ["id", value.id], ["name", value.name],
            ["description", value.description], ["weight", value.weight],
        ]);
    }
    // (align-score $action) → AlignmentScore
    if (op === "align-score") {
        const actionRaw = args[0];
        // FL map은 Map 또는 일반 object를 반환할 수 있음
        const _getF = (obj, key) => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
        const _getEO = (obj) => {
            const eo = _getF(obj, "expectedOutcomes");
            if (eo instanceof Map)
                return Object.fromEntries(eo);
            if (eo && typeof eo === "object")
                return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
            return {};
        };
        const action = {
            id: String(_getF(actionRaw, "id") ?? ""),
            description: String(_getF(actionRaw, "description") ?? ""),
            expectedOutcomes: _getEO(actionRaw),
            risks: Array.isArray(_getF(actionRaw, "risks")) ? _getF(actionRaw, "risks") : [],
        };
        const result = align_1.globalAlignment.score(action);
        return new Map([
            ["action", actionRaw],
            ["goalAlignment", new Map(Object.entries(result.goalAlignment))],
            ["valueAlignment", new Map(Object.entries(result.valueAlignment))],
            ["overallScore", result.overallScore],
            ["conflicts", result.conflicts.map(c => new Map([["goal1", c.goal1], ["goal2", c.goal2], ["severity", c.severity]]))],
            ["recommendation", result.recommendation],
            ["reasons", result.reasons],
        ]);
    }
    // (align-best $actions) → 최적 Action
    if (op === "align-best") {
        const actionsList = Array.isArray(args[0]) ? args[0] : [];
        const _getF2 = (obj, key) => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
        const _getEO2 = (obj) => {
            const eo = _getF2(obj, "expectedOutcomes");
            if (eo instanceof Map)
                return Object.fromEntries(eo);
            if (eo && typeof eo === "object")
                return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
            return {};
        };
        const actions = actionsList.map((m) => ({
            id: String(_getF2(m, "id") ?? ""),
            description: String(_getF2(m, "description") ?? ""),
            expectedOutcomes: _getEO2(m),
            risks: Array.isArray(_getF2(m, "risks")) ? _getF2(m, "risks") : [],
        }));
        if (actions.length === 0)
            return null;
        const best = align_1.globalAlignment.selectBestAligned(actions);
        return new Map([
            ["id", best.id], ["description", best.description],
        ]);
    }
    // (align-conflicts) → 충돌 목록
    if (op === "align-conflicts") {
        const conflicts = align_1.globalAlignment.detectConflicts();
        return conflicts.map(c => new Map([
            ["goal1", c.goal1], ["goal2", c.goal2], ["description", c.description],
        ]));
    }
    // (align-plan $actions) → 계획 평가
    if (op === "align-plan") {
        const actionsList = Array.isArray(args[0]) ? args[0] : [];
        const _gFP = (obj, key) => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
        const _gEOP = (obj) => {
            const eo = _gFP(obj, "expectedOutcomes");
            if (eo instanceof Map)
                return Object.fromEntries(eo);
            if (eo && typeof eo === "object")
                return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
            return {};
        };
        const actions = actionsList.map((m) => ({
            id: String(_gFP(m, "id") ?? ""),
            description: String(_gFP(m, "description") ?? ""),
            expectedOutcomes: _gEOP(m),
            risks: Array.isArray(_gFP(m, "risks")) ? _gFP(m, "risks") : [],
        }));
        const result = align_1.globalAlignment.evaluatePlan(actions);
        return new Map([
            ["overallAlignment", result.overallAlignment],
            ["weakLinks", result.weakLinks.map(a => new Map([["id", a.id], ["description", a.description]]))],
            ["summary", result.summary],
        ]);
    }
    // (align-improve $action) → 개선 제안 목록
    if (op === "align-improve") {
        const actionRaw3 = args[0];
        const _getF3 = (obj, key) => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
        const _getEO3 = (obj) => {
            const eo = _getF3(obj, "expectedOutcomes");
            if (eo instanceof Map)
                return Object.fromEntries(eo);
            if (eo && typeof eo === "object")
                return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
            return {};
        };
        const action = {
            id: String(_getF3(actionRaw3, "id") ?? ""),
            description: String(_getF3(actionRaw3, "description") ?? ""),
            expectedOutcomes: _getEO3(actionRaw3),
            risks: Array.isArray(_getF3(actionRaw3, "risks")) ? _getF3(actionRaw3, "risks") : [],
        };
        return align_1.globalAlignment.suggestImprovements(action);
    }
    // (align-goals) → 우선순위 정렬된 Goal 목록
    if (op === "align-goals") {
        const goals = align_1.globalAlignment.prioritizeGoals();
        return goals.map(g => new Map([
            ["id", g.id], ["description", g.description],
            ["priority", g.priority], ["measurable", g.measurable],
        ]));
    }
    return null;
}
// NOTE: Phase 144 code below is in separate evalPredict (called by evalBuiltin)
function evalPredict_PHASE144(op, args) {
    // === Phase 144: PREDICT ===
    // (predict-linear [1 2 3 4 5] :horizon 3) → Prediction
    if (op === "predict-linear") {
        const data144 = Array.isArray(args[0]) ? args[0].map(Number) : [];
        let horizon144 = 1;
        for (let i = 1; i < args.length - 1; i += 2) {
            const k = String(args[i]).replace(/^:/, "");
            if (k === "horizon")
                horizon144 = Number(args[i + 1]);
        }
        const p144 = predict_1.globalPredictor.linearRegression(data144, horizon144);
        return new Map([
            ["value", p144.value], ["lower", p144.lower], ["upper", p144.upper],
            ["confidence", p144.confidence], ["method", p144.method], ["horizon", p144.horizon ?? 1],
        ]);
    }
    // (predict-ma [1 2 3 4 5] :window 3 :horizon 2) → Prediction
    if (op === "predict-ma") {
        const data144ma = Array.isArray(args[0]) ? args[0].map(Number) : [];
        let window144 = 3;
        let horizon144ma = 1;
        for (let i = 1; i < args.length - 1; i += 2) {
            const k = String(args[i]).replace(/^:/, "");
            if (k === "window")
                window144 = Number(args[i + 1]);
            else if (k === "horizon")
                horizon144ma = Number(args[i + 1]);
        }
        const pma = predict_1.globalPredictor.movingAverage(data144ma, window144, horizon144ma);
        return new Map([
            ["value", pma.value], ["lower", pma.lower], ["upper", pma.upper],
            ["confidence", pma.confidence], ["method", pma.method], ["horizon", pma.horizon ?? 1],
        ]);
    }
    // (predict-exp [1 2 3 4 5] :alpha 0.3 :horizon 2) → Prediction
    if (op === "predict-exp") {
        const data144exp = Array.isArray(args[0]) ? args[0].map(Number) : [];
        let alpha144 = 0.3;
        let horizon144exp = 1;
        for (let i = 1; i < args.length - 1; i += 2) {
            const k = String(args[i]).replace(/^:/, "");
            if (k === "alpha")
                alpha144 = Number(args[i + 1]);
            else if (k === "horizon")
                horizon144exp = Number(args[i + 1]);
        }
        const pexp = predict_1.globalPredictor.exponentialSmoothing(data144exp, alpha144, horizon144exp);
        return new Map([
            ["value", pexp.value], ["lower", pexp.lower], ["upper", pexp.upper],
            ["confidence", pexp.confidence], ["method", pexp.method], ["horizon", pexp.horizon ?? 1],
        ]);
    }
    // (predict-forecast [1 2 3 4 5 4 3 4 5] :steps 3) → TimeSeriesPrediction
    if (op === "predict-forecast") {
        const data144ts = Array.isArray(args[0]) ? args[0].map(Number) : [];
        let steps144 = 3;
        for (let i = 1; i < args.length - 1; i += 2) {
            const k = String(args[i]).replace(/^:/, "");
            if (k === "steps")
                steps144 = Number(args[i + 1]);
        }
        const tsResult = predict_1.globalPredictor.forecastTimeSeries(data144ts, steps144);
        return new Map([
            ["predictions", tsResult.predictions.map(p => new Map([
                    ["value", p.value], ["lower", p.lower], ["upper", p.upper],
                    ["confidence", p.confidence], ["method", p.method], ["horizon", p.horizon ?? 1],
                ]))],
            ["trend", tsResult.trend],
            ["seasonality", tsResult.seasonality ?? null],
            ["accuracy", tsResult.accuracy ?? null],
        ]);
    }
    // (predict-ci [1.1 1.2 0.9 1.0 1.3] :confidence 0.95) → {lower, upper}
    if (op === "predict-ci") {
        const samples144 = Array.isArray(args[0]) ? args[0].map(Number) : [];
        let conf144 = 0.95;
        for (let i = 1; i < args.length - 1; i += 2) {
            const k = String(args[i]).replace(/^:/, "");
            if (k === "confidence")
                conf144 = Number(args[i + 1]);
        }
        const ci = predict_1.globalPredictor.confidenceInterval(samples144, conf144);
        return new Map([["lower", ci.lower], ["upper", ci.upper]]);
    }
    // (predict-classify {:age 25 :income 50000} $training) → ClassificationPrediction
    if (op === "predict-classify") {
        const rawFeatures = args[0];
        const features144 = {};
        if (rawFeatures instanceof Map) {
            rawFeatures.forEach((v, k) => {
                features144[String(k).replace(/^:/, "")] = Number(v);
            });
        }
        else if (typeof rawFeatures === "object" && rawFeatures !== null) {
            Object.entries(rawFeatures).forEach(([k, v]) => {
                features144[k.replace(/^:/, "")] = Number(v);
            });
        }
        const rawTraining = Array.isArray(args[1]) ? args[1] : [];
        const trainingData144 = rawTraining.map((item) => {
            if (item instanceof Map) {
                const rawF = item.get("features") ?? item.get(":features");
                const label = String(item.get("label") ?? item.get(":label") ?? "unknown");
                const feats = {};
                if (rawF instanceof Map) {
                    rawF.forEach((v, k) => { feats[String(k).replace(/^:/, "")] = Number(v); });
                }
                return { features: feats, label };
            }
            return { features: {}, label: "unknown" };
        });
        const clf = predict_1.globalPredictor.classify(features144, trainingData144);
        return new Map([
            ["classes", clf.classes.map(c => new Map([["label", c.label], ["probability", c.probability]]))],
            ["predicted", clf.predicted],
            ["confidence", clf.confidence],
        ]);
    }
    // (predict-evaluate [1 2 3] [1.1 2.2 2.9]) → {mae, rmse, mape}
    if (op === "predict-evaluate") {
        const preds144 = Array.isArray(args[0]) ? args[0].map(Number) : [];
        const actuals144 = Array.isArray(args[1]) ? args[1].map(Number) : [];
        const evalResult = predict_1.globalPredictor.evaluate(preds144, actuals144);
        return new Map([
            ["mae", evalResult.mae], ["rmse", evalResult.rmse], ["mape", evalResult.mape],
        ]);
    }
    // (predict-trend [1 2 3 4 5]) → "up"/"down"/"flat"/"volatile"
    if (op === "predict-trend") {
        const data144tr = Array.isArray(args[0]) ? args[0].map(Number) : [];
        return predict_1.globalPredictor.detectTrend(data144tr);
    }
    return null;
}
// === Phase 148: CURIOSITY ===
function evalCuriosity(op, args, callFn) {
    // (curiosity-score "주제" ["알려진것1" "알려진것2"]) → 0~1 호기심 점수
    if (op === "curiosity-score") {
        const topic = String(args[0] ?? "");
        const knownFacts = Array.isArray(args[1])
            ? args[1].map((f) => String(f))
            : [];
        return curiosity_1.globalCuriosity.computeCuriosity(topic, knownFacts);
    }
    // (curiosity-next) → 다음 탐색 주제 or null
    if (op === "curiosity-next") {
        return curiosity_1.globalCuriosity.selectNextTopic();
    }
    // (curiosity-explore "주제" $explorer-fn) → ExplorationResult as Map
    if (op === "curiosity-explore") {
        const topic = String(args[0] ?? "");
        const fn = args[1];
        const explorerFunc = (t) => {
            const result = callFn ? callFn(fn, [t]) : (typeof fn === "function" ? fn(t) : null);
            if (result instanceof Map) {
                const facts = Array.isArray(result.get("facts")) ? result.get("facts").map(String) : [];
                const questions = Array.isArray(result.get("questions")) ? result.get("questions").map(String) : [];
                return { facts, questions };
            }
            return { facts: [], questions: [] };
        };
        const res = curiosity_1.globalCuriosity.explore(topic, explorerFunc);
        return new Map([
            ["topic", res.topic],
            ["discovered", res.discovered],
            ["newQuestions", res.newQuestions],
            ["informationGain", res.informationGain],
            ["surpriseLevel", res.surpriseLevel],
            ["relatedTopics", res.relatedTopics],
        ]);
    }
    // (curiosity-gaps ["알려진것들"] ["전체목록"]) → KnowledgeGap[] as Map[]
    if (op === "curiosity-gaps") {
        const known = Array.isArray(args[0]) ? args[0].map((s) => String(s)) : [];
        const all = Array.isArray(args[1]) ? args[1].map((s) => String(s)) : [];
        const gaps = curiosity_1.globalCuriosity.identifyGaps(known, all);
        return gaps.map((g) => new Map([
            ["topic", g.topic],
            ["unknownAspects", g.unknownAspects],
            ["priority", g.priority],
            ["explorationCost", g.explorationCost],
            ["expectedGain", g.expectedGain],
        ]));
    }
    // (curiosity-questions "주제" ["맥락1" "맥락2"]) → 질문 배열
    if (op === "curiosity-questions") {
        const topic = String(args[0] ?? "");
        const context = Array.isArray(args[1]) ? args[1].map((s) => String(s)) : [];
        return curiosity_1.globalCuriosity.generateQuestions(topic, context);
    }
    // (curiosity-prioritize ["주제1" "주제2" "주제3"]) → 우선순위 정렬된 배열
    if (op === "curiosity-prioritize") {
        const topics = Array.isArray(args[0]) ? args[0].map((s) => String(s)) : [];
        return curiosity_1.globalCuriosity.prioritize(topics);
    }
    // (curiosity-analyze) → 탐색 이력 분석 Map
    if (op === "curiosity-analyze") {
        const analysis = curiosity_1.globalCuriosity.analyzeExplorationHistory();
        return new Map([
            ["totalExplored", analysis.totalExplored],
            ["avgInfoGain", analysis.avgInfoGain],
            ["mostSurprising", analysis.mostSurprising],
            ["recommendations", analysis.recommendations],
        ]);
    }
    // (curiosity-state) → CuriosityState as Map
    if (op === "curiosity-state") {
        const st = curiosity_1.globalCuriosity.getState();
        return new Map([
            ["explored", Array.from(st.explored)],
            ["frontier", st.frontier],
            ["knowledgeGaps", st.knowledgeGaps.map((g) => new Map([
                    ["topic", g.topic],
                    ["unknownAspects", g.unknownAspects],
                    ["priority", g.priority],
                    ["explorationCost", g.explorationCost],
                    ["expectedGain", g.expectedGain],
                ]))],
            ["curiosityScore", st.curiosityScore],
            ["explorationHistory", st.explorationHistory.map(h => new Map([
                    ["topic", h.topic],
                    ["gain", h.gain],
                    ["timestamp", h.timestamp.toISOString()],
                ]))],
        ]);
    }
    // === Phase 149: WISDOM ===
    // (wisdom-add-exp :situation "..." :action "..." :outcome "..." :lesson "..." :success true :importance 0.8 :domain "engineering")
    if (op === "wisdom-add-exp") {
        const kwargs = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kwargs[key] = args[i + 1];
        }
        const exp = wisdom_1.globalWisdom.addExperience({
            situation: String(kwargs["situation"] ?? ""),
            action: String(kwargs["action"] ?? ""),
            outcome: String(kwargs["outcome"] ?? ""),
            lesson: String(kwargs["lesson"] ?? ""),
            success: kwargs["success"] === true || kwargs["success"] === "true",
            importance: typeof kwargs["importance"] === "number" ? kwargs["importance"] : 0.5,
            domain: String(kwargs["domain"] ?? "general"),
        });
        return new Map([
            ["id", exp.id],
            ["situation", exp.situation],
            ["action", exp.action],
            ["outcome", exp.outcome],
            ["lesson", exp.lesson],
            ["success", exp.success],
            ["importance", exp.importance],
            ["domain", exp.domain],
            ["timestamp", exp.timestamp.toISOString()],
        ]);
    }
    // (wisdom-judge "현재 상황 설명")
    if (op === "wisdom-judge") {
        const situation = String(args[0] ?? "");
        const judgment = wisdom_1.globalWisdom.judge(situation);
        return new Map([
            ["situation", judgment.situation],
            ["recommendation", judgment.recommendation],
            ["reasoning", judgment.reasoning],
            ["relevantExperiences", judgment.relevantExperiences.map(e => new Map([
                    ["id", e.id], ["situation", e.situation], ["lesson", e.lesson],
                    ["success", e.success], ["importance", e.importance], ["domain", e.domain],
                ]))],
            ["applicableHeuristics", judgment.applicableHeuristics.map(h => new Map([
                    ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
                    ["successCount", h.successCount], ["totalCount", h.totalCount], ["domain", h.domain],
                ]))],
            ["confidence", judgment.confidence],
            ["caveats", judgment.caveats],
            ["alternatives", judgment.alternatives],
        ]);
    }
    // (wisdom-heuristics)
    if (op === "wisdom-heuristics") {
        return wisdom_1.globalWisdom.getHeuristics().map(h => new Map([
            ["id", h.id],
            ["rule", h.rule],
            ["confidence", h.confidence],
            ["successCount", h.successCount],
            ["totalCount", h.totalCount],
            ["domain", h.domain],
            ["derivedFrom", h.derivedFrom],
        ]));
    }
    // (wisdom-extract)
    if (op === "wisdom-extract") {
        const heuristics = wisdom_1.globalWisdom.extractHeuristics();
        return heuristics.map(h => new Map([
            ["id", h.id],
            ["rule", h.rule],
            ["confidence", h.confidence],
            ["successCount", h.successCount],
            ["totalCount", h.totalCount],
            ["domain", h.domain],
            ["derivedFrom", h.derivedFrom],
        ]));
    }
    // (wisdom-relevant "상황")
    if (op === "wisdom-relevant") {
        const situation = String(args[0] ?? "");
        const limit = typeof args[1] === "number" ? args[1] : 5;
        return wisdom_1.globalWisdom.findRelevantExperiences(situation, limit).map(e => new Map([
            ["id", e.id],
            ["situation", e.situation],
            ["action", e.action],
            ["outcome", e.outcome],
            ["lesson", e.lesson],
            ["success", e.success],
            ["importance", e.importance],
            ["domain", e.domain],
        ]));
    }
    // (wisdom-lessons :domain "engineering")
    if (op === "wisdom-lessons") {
        let domain;
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            if (key === "domain")
                domain = String(args[i + 1]);
        }
        return wisdom_1.globalWisdom.getLessons(domain);
    }
    // (wisdom-score)
    if (op === "wisdom-score") {
        return wisdom_1.globalWisdom.wisdomScore();
    }
    // (wisdom-domain "engineering")
    if (op === "wisdom-domain") {
        const domain = String(args[0] ?? "general");
        const summary = wisdom_1.globalWisdom.summarizeDomain(domain);
        return new Map([
            ["topLessons", summary.topLessons],
            ["bestHeuristics", summary.bestHeuristics.map(h => new Map([
                    ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
                    ["successCount", h.successCount], ["totalCount", h.totalCount],
                ]))],
            ["successRate", summary.successRate],
        ]);
    }
    // (wisdom-valid? $experience)
    if (op === "wisdom-valid?") {
        const expMap = args[0];
        if (!(expMap instanceof Map))
            return false;
        const exp = {
            id: String(expMap.get("id") ?? ""),
            situation: String(expMap.get("situation") ?? ""),
            action: String(expMap.get("action") ?? ""),
            outcome: String(expMap.get("outcome") ?? ""),
            lesson: String(expMap.get("lesson") ?? ""),
            success: expMap.get("success") === true,
            importance: Number(expMap.get("importance") ?? 0.5),
            timestamp: new Date(String(expMap.get("timestamp") ?? new Date().toISOString())),
            domain: String(expMap.get("domain") ?? "general"),
        };
        return wisdom_1.globalWisdom.isStillValid(exp);
    }
    // (wisdom-similar "상황")
    if (op === "wisdom-similar") {
        const situation = String(args[0] ?? "");
        return wisdom_1.globalWisdom.findSimilarCases(situation).map(e => new Map([
            ["id", e.id],
            ["situation", e.situation],
            ["action", e.action],
            ["outcome", e.outcome],
            ["lesson", e.lesson],
            ["success", e.success],
            ["importance", e.importance],
            ["domain", e.domain],
        ]));
    }
    return null;
}
// === Phase 147: ETHICS-CHECK ===
function evalEthicsCheck(interp, op, args) {
    const callFnVal = (fn, a) => interp.callFunctionValue(fn, a);
    // (ethics-check "내용" {:context "의료 AI"}) → EthicsCheckResult Map
    if (op === "ethics-check") {
        const subject = String(args[0] ?? "");
        const ctx = {};
        if (args[1] instanceof Map) {
            for (const [k, v] of args[1].entries()) {
                ctx[String(k)] = v;
            }
        }
        else if (args[1] && typeof args[1] === 'object') {
            Object.assign(ctx, args[1]);
        }
        const result = ethics_check_1.globalEthics.check(subject, ctx);
        const fwMap = new Map();
        for (const [fw, data] of Object.entries(result.frameworks)) {
            fwMap.set(fw, new Map([["passed", data.passed], ["score", data.score]]));
        }
        return new Map([
            ["subject", result.subject],
            ["passed", result.passed],
            ["violations", result.violations.map((v) => new Map([
                    ["principle", v.principle], ["severity", v.severity],
                    ["description", v.description], ["suggestion", v.suggestion],
                    ["framework", v.framework],
                ]))],
            ["score", result.score],
            ["frameworks", fwMap],
            ["recommendation", result.recommendation],
            ["requiresHumanReview", result.requiresHumanReview],
        ]);
    }
    // (ethics-check-framework "내용" "utilitarian") → {passed, score, violations}
    if (op === "ethics-check-framework") {
        const subject = String(args[0] ?? "");
        const framework = String(args[1] ?? "utilitarian");
        const result = ethics_check_1.globalEthics.checkByFramework(subject, framework);
        return new Map([
            ["passed", result.passed],
            ["score", result.score],
            ["violations", result.violations.map((v) => new Map([
                    ["principle", v.principle], ["severity", v.severity],
                    ["description", v.description], ["suggestion", v.suggestion],
                    ["framework", v.framework],
                ]))],
        ]);
    }
    // (ethics-is-ethical "내용") → boolean
    if (op === "ethics-is-ethical") {
        const subject = String(args[0] ?? "");
        const ctx = {};
        if (args[1] instanceof Map) {
            for (const [k, v] of args[1].entries()) {
                ctx[String(k)] = v;
            }
        }
        return ethics_check_1.globalEthics.isEthical(subject, ctx);
    }
    // (ethics-add-principle :id "p1" :name "해악금지" :framework "deontological")
    if (op === "ethics-add-principle") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const principle = {
            id: String(kw["id"] ?? "custom-principle"),
            name: String(kw["name"] ?? "커스텀 원칙"),
            description: String(kw["description"] ?? kw["desc"] ?? ""),
            framework: (String(kw["framework"] ?? "virtue")),
            check: typeof kw["check-fn"] === "function"
                ? (subject, ctx) => {
                    const r = callFnVal(kw["check-fn"], [subject, ctx]);
                    if (r instanceof Map) {
                        return { passed: Boolean(r.get("passed")), reason: String(r.get("reason") ?? "") };
                    }
                    return { passed: Boolean(r), reason: "" };
                }
                : (_subject, _ctx) => ({ passed: true, reason: "커스텀 원칙 통과" }),
        };
        ethics_check_1.globalEthics.addPrinciple(principle);
        return new Map([
            ["id", principle.id], ["name", principle.name],
            ["framework", principle.framework], ["description", principle.description],
        ]);
    }
    // (ethics-suggest "내용" $violations) → 윤리적 대안 문자열
    if (op === "ethics-suggest") {
        const subject = String(args[0] ?? "");
        const rawViolations = args[1];
        const violations = [];
        if (Array.isArray(rawViolations)) {
            for (const rv of rawViolations) {
                if (rv instanceof Map) {
                    violations.push({
                        principle: String(rv.get("principle") ?? ""),
                        severity: (rv.get("severity") ?? "low"),
                        description: String(rv.get("description") ?? ""),
                        suggestion: String(rv.get("suggestion") ?? ""),
                        framework: (rv.get("framework") ?? "virtue"),
                    });
                }
            }
        }
        return ethics_check_1.globalEthics.suggestEthicalAlternative(subject, violations);
    }
    // (ethics-risk $result) → "none"/"low"/"medium"/"high"/"critical"
    if (op === "ethics-risk") {
        const rawResult = args[0];
        if (rawResult instanceof Map) {
            const violations = [];
            const rawViolations = rawResult.get("violations") ?? [];
            if (Array.isArray(rawViolations)) {
                for (const rv of rawViolations) {
                    if (rv instanceof Map) {
                        violations.push({
                            principle: String(rv.get("principle") ?? ""),
                            severity: (rv.get("severity") ?? "low"),
                            description: String(rv.get("description") ?? ""),
                            suggestion: String(rv.get("suggestion") ?? ""),
                            framework: (rv.get("framework") ?? "virtue"),
                        });
                    }
                }
            }
            const result = {
                subject: String(rawResult.get("subject") ?? ""),
                passed: Boolean(rawResult.get("passed")),
                violations,
                score: Number(rawResult.get("score") ?? 1),
                frameworks: {},
                recommendation: String(rawResult.get("recommendation") ?? ""),
                requiresHumanReview: Boolean(rawResult.get("requiresHumanReview")),
            };
            return ethics_check_1.globalEthics.riskLevel(result);
        }
        return "none";
    }
    // (ethics-violations $result) → EthicsViolation[]
    if (op === "ethics-violations") {
        const rawResult = args[0];
        if (rawResult instanceof Map) {
            return rawResult.get("violations") ?? [];
        }
        return [];
    }
    // (ethics-score $result) → 0~1 점수
    if (op === "ethics-score") {
        const rawResult = args[0];
        if (rawResult instanceof Map) {
            return Number(rawResult.get("score") ?? 1);
        }
        return 1;
    }
    return null;
}
// === Phase 145: EXPLAIN (appended) ===
// These functions are registered inside evalBuiltin via the module-level append pattern.
// See explain.ts for the Explainer class.
// NOTE: Phase 145 EXPLAIN functions are added as patches below.
// The evalBuiltin function above handles them via the explain-* op prefix.
// Due to the multi-function file structure, we use a separate registration approach.
// === Phase 143: COUNTERFACTUAL 빌트인 헬퍼 ===
function evalCounterfactual(op, args, callFn) {
    // (cf-scenario :id "s1" :name "비오는날" :vars {:rain true :speed 60} :outcome "accident")
    if (op === "cf-scenario") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kw[key] = args[i + 1];
        }
        const id = String(kw["id"] ?? `s-${Date.now()}`);
        const name = String(kw["name"] ?? id);
        let variables = {};
        if (kw["vars"] instanceof Map) {
            for (const [k, v] of kw["vars"])
                variables[String(k).replace(/^:/, "")] = v;
        }
        else if (kw["vars"] && typeof kw["vars"] === "object") {
            variables = kw["vars"];
        }
        const outcome = kw["outcome"] ?? null;
        const scenario = { id, name, variables, outcome };
        counterfactual_1.globalCounterfactual.registerScenario(scenario);
        return new Map([
            ["id", id], ["name", name],
            ["variables", new Map(Object.entries(variables))],
            ["outcome", outcome],
        ]);
    }
    // (cf-what-if $vars $change $outcome-fn)
    if (op === "cf-what-if") {
        let variables = {};
        let change = {};
        if (args[0] instanceof Map) {
            for (const [k, v] of args[0])
                variables[String(k).replace(/^:/, "")] = v;
        }
        if (args[1] instanceof Map) {
            for (const [k, v] of args[1])
                change[String(k).replace(/^:/, "")] = v;
        }
        const fn = args[2];
        const outcomeFunc = (vars) => callFn(fn, [new Map(Object.entries(vars))]);
        const cf = counterfactual_1.globalCounterfactual.whatIf(variables, change, outcomeFunc);
        return new Map([
            ["id", cf.id],
            ["intervention", new Map(Object.entries(cf.intervention))],
            ["counterfactualOutcome", cf.counterfactualOutcome],
            ["delta", new Map(Object.entries(cf.delta))],
            ["probability", cf.probability],
            ["explanation", cf.explanation],
        ]);
    }
    // (cf-analyze "s1" $interventions $outcome-fn)
    if (op === "cf-analyze") {
        const scenarioId = String(args[0] ?? "");
        const interventionsList = [];
        if (Array.isArray(args[1])) {
            for (const iv of args[1]) {
                const obj = {};
                if (iv instanceof Map) {
                    for (const [k, v] of iv)
                        obj[String(k).replace(/^:/, "")] = v;
                }
                interventionsList.push(obj);
            }
        }
        const fn = args[2];
        const outcomeFunc = (vars) => callFn(fn, [new Map(Object.entries(vars))]);
        const analysis = counterfactual_1.globalCounterfactual.analyze(scenarioId, interventionsList, outcomeFunc);
        return new Map([
            ["original", new Map([
                    ["id", analysis.original.id], ["name", analysis.original.name], ["outcome", analysis.original.outcome],
                ])],
            ["counterfactuals", analysis.counterfactuals.map(cf => new Map([
                    ["id", cf.id], ["probability", cf.probability], ["counterfactualOutcome", cf.counterfactualOutcome],
                    ["explanation", cf.explanation],
                ]))],
            ["mostLikelyAlternative", new Map([
                    ["id", analysis.mostLikelyAlternative.id],
                    ["probability", analysis.mostLikelyAlternative.probability],
                    ["counterfactualOutcome", analysis.mostLikelyAlternative.counterfactualOutcome],
                    ["explanation", analysis.mostLikelyAlternative.explanation],
                ])],
            ["keyFactors", analysis.keyFactors],
            ["sensitivity", new Map(Object.entries(analysis.sensitivity))],
        ]);
    }
    // (cf-minimal "s1" "no-accident" $outcome-fn)
    if (op === "cf-minimal") {
        const scenarioId = String(args[0] ?? "");
        const targetOutcome = args[1];
        const fn = args[2];
        const outcomeFunc = (vars) => callFn(fn, [new Map(Object.entries(vars))]);
        const minimal = counterfactual_1.globalCounterfactual.findMinimalIntervention(scenarioId, targetOutcome, outcomeFunc);
        if (minimal === null)
            return null;
        return new Map(Object.entries(minimal));
    }
    // (cf-sensitivity $vars $fn)
    if (op === "cf-sensitivity") {
        let variables = {};
        const rawVars = args[0];
        if (rawVars instanceof Map) {
            for (const [k, v] of rawVars)
                variables[String(k).replace(/^:/, "")] = v;
        }
        else if (rawVars && typeof rawVars === "object" && !Array.isArray(rawVars)) {
            // FL {: } map literal은 plain object로 평가됨
            for (const [k, v] of Object.entries(rawVars))
                variables[String(k).replace(/^:/, "")] = v;
        }
        const fn = args[1];
        // FL imm-get은 plain object m[k]를 사용하므로 plain object로 전달
        const outcomeFunc = (vars) => {
            try {
                return Number(callFn(fn, [vars]));
            }
            catch {
                return 0;
            }
        };
        const sens = counterfactual_1.globalCounterfactual.sensitivityAnalysis(variables, outcomeFunc);
        return new Map(Object.entries(sens));
    }
    // (cf-key-factors $analysis)
    if (op === "cf-key-factors") {
        const analysis = args[0];
        if (analysis instanceof Map) {
            const factors = analysis.get("keyFactors");
            if (Array.isArray(factors))
                return factors;
        }
        return [];
    }
    // (cf-best-alt $analysis)
    if (op === "cf-best-alt") {
        const analysis = args[0];
        if (analysis instanceof Map) {
            return analysis.get("mostLikelyAlternative") ?? null;
        }
        return null;
    }
    // (cf-explain $counterfactual)
    if (op === "cf-explain") {
        const cf = args[0];
        if (cf instanceof Map) {
            return cf.get("explanation") ?? "";
        }
        return "";
    }
    // === Phase 145: EXPLAIN ===
    // (explain-decision $decision {:accuracy 0.9 :speed 0.7} "context")
    if (op === "explain-decision") {
        const decision = args[0];
        const rawFactors = args[1];
        const context = args[2] !== undefined ? String(args[2]) : undefined;
        const factors = {};
        if (rawFactors instanceof Map) {
            for (const [k, v] of rawFactors.entries())
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        else if (rawFactors && typeof rawFactors === "object") {
            for (const [k, v] of Object.entries(rawFactors))
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        const explanation = explain_1.globalExplainer.explain(decision, factors, context);
        return new Map([
            ["decision", explanation.decision],
            ["reasoning", explanation.reasoning],
            ["features", explanation.features.map((f) => new Map([
                    ["feature", f.feature], ["importance", f.importance],
                    ["direction", f.direction], ["description", f.description],
                ]))],
            ["confidence", explanation.confidence],
            ["alternatives", explanation.alternatives.map((a) => new Map([
                    ["decision", a.decision], ["reason", a.reason], ["probability", a.probability],
                ]))],
            ["summary", explanation.summary],
            ["audience", explanation.audience],
        ]);
    }
    // (explain-features {:x 1 :y 2} {:out 0.8})
    if (op === "explain-features") {
        const toRecord145 = (v) => {
            const result = {};
            if (v instanceof Map) {
                for (const [k, val] of v.entries())
                    result[String(k).replace(/^:/, "")] = Number(val);
            }
            else if (v && typeof v === "object") {
                for (const [k, val] of Object.entries(v))
                    result[String(k).replace(/^:/, "")] = Number(val);
            }
            return result;
        };
        const inputs145 = toRecord145(args[0]);
        const outputs145 = toRecord145(args[1]);
        const baseline145 = args[2] !== undefined ? toRecord145(args[2]) : undefined;
        const features145 = explain_1.globalExplainer.featureImportance(inputs145, outputs145, baseline145);
        return features145.map((f) => new Map([
            ["feature", f.feature], ["importance", f.importance],
            ["direction", f.direction], ["description", f.description],
        ]));
    }
    // (explain-local {:age 25} "approved" $model)
    if (op === "explain-local") {
        const rawInput145 = args[0];
        const output145 = args[1];
        const modelFn145 = args[2];
        const input145 = {};
        if (rawInput145 instanceof Map) {
            for (const [k, v] of rawInput145.entries())
                input145[String(k).replace(/^:/, "")] = v;
        }
        else if (rawInput145 && typeof rawInput145 === "object") {
            for (const [k, v] of Object.entries(rawInput145))
                input145[String(k).replace(/^:/, "")] = v;
        }
        const model145 = (inp) => {
            if (modelFn145) {
                try {
                    return callFn(modelFn145, [new Map(Object.entries(inp))]);
                }
                catch {
                    return output145;
                }
            }
            return output145;
        };
        const local145 = explain_1.globalExplainer.localExplain(input145, output145, model145);
        return new Map([
            ["input", new Map(Object.entries(local145.input))],
            ["output", local145.output],
            ["topFactors", local145.topFactors.map((f) => new Map([
                    ["feature", f.feature], ["importance", f.importance],
                    ["direction", f.direction], ["description", f.description],
                ]))],
            ["counterfactual", local145.counterfactual],
            ["confidence", local145.confidence],
        ]);
    }
    // (explain-natural $explanation :audience "general")
    if (op === "explain-natural") {
        const rawExpl145 = args[0];
        let audience145 = 'technical';
        for (let i = 1; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            if (key === "audience")
                audience145 = String(args[i + 1]);
        }
        if (!(rawExpl145 instanceof Map))
            return "설명을 변환할 수 없습니다";
        const featuresRaw145 = rawExpl145.get("features") ?? [];
        const features145n = (Array.isArray(featuresRaw145) ? featuresRaw145 : []).map((f) => {
            if (f instanceof Map) {
                return {
                    feature: String(f.get("feature") ?? ""),
                    importance: Number(f.get("importance") ?? 0),
                    direction: String(f.get("direction") ?? "positive"),
                    description: String(f.get("description") ?? ""),
                };
            }
            return { feature: "", importance: 0, direction: "positive", description: "" };
        });
        const altsRaw145 = rawExpl145.get("alternatives") ?? [];
        const alternatives145 = (Array.isArray(altsRaw145) ? altsRaw145 : []).map((a) => {
            if (a instanceof Map)
                return { decision: a.get("decision"), reason: String(a.get("reason") ?? ""), probability: Number(a.get("probability") ?? 0) };
            return { decision: null, reason: "", probability: 0 };
        });
        const explanation145n = {
            decision: rawExpl145.get("decision"),
            reasoning: rawExpl145.get("reasoning") ?? [],
            features: features145n,
            confidence: Number(rawExpl145.get("confidence") ?? 0.5),
            alternatives: alternatives145,
            summary: String(rawExpl145.get("summary") ?? ""),
            audience: (rawExpl145.get("audience") ?? "technical"),
        };
        return explain_1.globalExplainer.toNaturalLanguage(explanation145n, audience145);
    }
    // (explain-contrast "approved" "denied" {:score 0.8})
    if (op === "explain-contrast") {
        const decision145c = args[0];
        const alternative145c = args[1];
        const rawFactors145c = args[2];
        const factors145c = {};
        if (rawFactors145c instanceof Map) {
            for (const [k, v] of rawFactors145c.entries())
                factors145c[String(k).replace(/^:/, "")] = Number(v);
        }
        else if (rawFactors145c && typeof rawFactors145c === "object") {
            for (const [k, v] of Object.entries(rawFactors145c))
                factors145c[String(k).replace(/^:/, "")] = Number(v);
        }
        return explain_1.globalExplainer.contrastiveExplain(decision145c, alternative145c, factors145c);
    }
    // (explain-rules $examples)
    if (op === "explain-rules") {
        const rawExamples145 = args[0];
        const examples145 = [];
        const toRecord145r = (v) => {
            const result = {};
            if (v instanceof Map) {
                for (const [k, val] of v.entries())
                    result[String(k).replace(/^:/, "")] = val;
            }
            else if (v && typeof v === "object") {
                Object.assign(result, v);
            }
            return result;
        };
        if (Array.isArray(rawExamples145)) {
            for (const ex of rawExamples145) {
                if (ex instanceof Map) {
                    examples145.push({ input: toRecord145r(ex.get("input")), output: ex.get("output") });
                }
                else if (ex && typeof ex === "object") {
                    examples145.push({ input: toRecord145r(ex.input), output: ex.output });
                }
            }
        }
        const rules145 = explain_1.globalExplainer.extractRules(examples145);
        return rules145.map((r) => new Map([
            ["condition", r.condition], ["outcome", r.outcome], ["support", r.support],
        ]));
    }
    // (explain-top-factors $explanation :n 3)
    if (op === "explain-top-factors") {
        const rawExpl145tf = args[0];
        let n145 = 3;
        for (let i = 1; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            if (key === "n")
                n145 = Number(args[i + 1]);
        }
        let features145tf = [];
        if (rawExpl145tf instanceof Map)
            features145tf = rawExpl145tf.get("features") ?? [];
        if (!Array.isArray(features145tf))
            features145tf = [];
        return features145tf.slice(0, n145);
    }
    // (explain-summary $explanation)
    if (op === "explain-summary") {
        const rawExpl145s = args[0];
        if (rawExpl145s instanceof Map)
            return String(rawExpl145s.get("summary") ?? "");
        return "";
    }
    return null;
}
// === Phase 149: WISDOM ===
function evalWisdom(op, args) {
    if (op === "wisdom-add-exp") {
        const kwargs = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            kwargs[key] = args[i + 1];
        }
        const exp = wisdom_1.globalWisdom.addExperience({
            situation: String(kwargs["situation"] ?? ""),
            action: String(kwargs["action"] ?? ""),
            outcome: String(kwargs["outcome"] ?? ""),
            lesson: String(kwargs["lesson"] ?? ""),
            success: kwargs["success"] === true || kwargs["success"] === "true",
            importance: typeof kwargs["importance"] === "number" ? kwargs["importance"] : 0.5,
            domain: String(kwargs["domain"] ?? "general"),
        });
        return new Map([
            ["id", exp.id], ["situation", exp.situation], ["action", exp.action],
            ["outcome", exp.outcome], ["lesson", exp.lesson], ["success", exp.success],
            ["importance", exp.importance], ["domain", exp.domain],
            ["timestamp", exp.timestamp.toISOString()],
        ]);
    }
    if (op === "wisdom-judge") {
        const situation = String(args[0] ?? "");
        const judgment = wisdom_1.globalWisdom.judge(situation);
        return new Map([
            ["situation", judgment.situation],
            ["recommendation", judgment.recommendation],
            ["reasoning", judgment.reasoning],
            ["relevantExperiences", judgment.relevantExperiences.map((e) => new Map([
                    ["id", e.id], ["situation", e.situation], ["lesson", e.lesson],
                    ["success", e.success], ["importance", e.importance], ["domain", e.domain],
                ]))],
            ["applicableHeuristics", judgment.applicableHeuristics.map((h) => new Map([
                    ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
                    ["successCount", h.successCount], ["totalCount", h.totalCount], ["domain", h.domain],
                ]))],
            ["confidence", judgment.confidence],
            ["caveats", judgment.caveats],
            ["alternatives", judgment.alternatives],
        ]);
    }
    if (op === "wisdom-heuristics") {
        return wisdom_1.globalWisdom.getHeuristics().map((h) => new Map([
            ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
            ["successCount", h.successCount], ["totalCount", h.totalCount],
            ["domain", h.domain], ["derivedFrom", h.derivedFrom],
        ]));
    }
    if (op === "wisdom-extract") {
        const heuristics = wisdom_1.globalWisdom.extractHeuristics();
        return heuristics.map((h) => new Map([
            ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
            ["successCount", h.successCount], ["totalCount", h.totalCount],
            ["domain", h.domain], ["derivedFrom", h.derivedFrom],
        ]));
    }
    if (op === "wisdom-relevant") {
        const situation = String(args[0] ?? "");
        const limit = typeof args[1] === "number" ? args[1] : 5;
        return wisdom_1.globalWisdom.findRelevantExperiences(situation, limit).map((e) => new Map([
            ["id", e.id], ["situation", e.situation], ["action", e.action],
            ["outcome", e.outcome], ["lesson", e.lesson], ["success", e.success],
            ["importance", e.importance], ["domain", e.domain],
        ]));
    }
    if (op === "wisdom-lessons") {
        let domain;
        for (let i = 0; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            if (key === "domain")
                domain = String(args[i + 1]);
        }
        return wisdom_1.globalWisdom.getLessons(domain);
    }
    if (op === "wisdom-score") {
        return wisdom_1.globalWisdom.wisdomScore();
    }
    if (op === "wisdom-domain") {
        const domain = String(args[0] ?? "general");
        const summary = wisdom_1.globalWisdom.summarizeDomain(domain);
        return new Map([
            ["topLessons", summary.topLessons],
            ["bestHeuristics", summary.bestHeuristics.map((h) => new Map([
                    ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
                    ["successCount", h.successCount], ["totalCount", h.totalCount],
                ]))],
            ["successRate", summary.successRate],
        ]);
    }
    if (op === "wisdom-valid?") {
        const expMap = args[0];
        if (!(expMap instanceof Map))
            return false;
        const exp = {
            id: String(expMap.get("id") ?? ""),
            situation: String(expMap.get("situation") ?? ""),
            action: String(expMap.get("action") ?? ""),
            outcome: String(expMap.get("outcome") ?? ""),
            lesson: String(expMap.get("lesson") ?? ""),
            success: expMap.get("success") === true,
            importance: Number(expMap.get("importance") ?? 0.5),
            timestamp: new Date(String(expMap.get("timestamp") ?? new Date().toISOString())),
            domain: String(expMap.get("domain") ?? "general"),
        };
        return wisdom_1.globalWisdom.isStillValid(exp);
    }
    if (op === "wisdom-similar") {
        const situation = String(args[0] ?? "");
        return wisdom_1.globalWisdom.findSimilarCases(situation).map((e) => new Map([
            ["id", e.id], ["situation", e.situation], ["action", e.action],
            ["outcome", e.outcome], ["lesson", e.lesson], ["success", e.success],
            ["importance", e.importance], ["domain", e.domain],
        ]));
    }
    return null;
}
// === Phase 145: EXPLAIN ===
function evalExplain_PHASE145(op, args, callFnVal) {
    if (op === "explain-decision") {
        const decision = args[0];
        const rawFactors = args[1];
        const context = args[2] !== undefined ? String(args[2]) : undefined;
        const factors = {};
        if (rawFactors instanceof Map) {
            for (const [k, v] of rawFactors.entries())
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        else if (rawFactors && typeof rawFactors === "object") {
            for (const [k, v] of Object.entries(rawFactors))
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        const explanation = explain_1.globalExplainer.explain(decision, factors, context);
        return new Map([
            ["decision", explanation.decision],
            ["reasoning", explanation.reasoning],
            ["features", explanation.features.map((f) => new Map([
                    ["feature", f.feature], ["importance", f.importance],
                    ["direction", f.direction], ["description", f.description],
                ]))],
            ["confidence", explanation.confidence],
            ["alternatives", explanation.alternatives.map((a) => new Map([
                    ["decision", a.decision], ["reason", a.reason], ["probability", a.probability],
                ]))],
            ["summary", explanation.summary],
            ["audience", explanation.audience],
        ]);
    }
    if (op === "explain-features") {
        const toRecord = (v) => {
            const result = {};
            if (v instanceof Map) {
                for (const [k, val] of v.entries())
                    result[String(k).replace(/^:/, "")] = Number(val);
            }
            else if (v && typeof v === "object") {
                for (const [k, val] of Object.entries(v))
                    result[String(k).replace(/^:/, "")] = Number(val);
            }
            return result;
        };
        const features = explain_1.globalExplainer.featureImportance(toRecord(args[0]), toRecord(args[1]), args[2] !== undefined ? toRecord(args[2]) : undefined);
        return features.map((f) => new Map([
            ["feature", f.feature], ["importance", f.importance],
            ["direction", f.direction], ["description", f.description],
        ]));
    }
    if (op === "explain-local") {
        const rawInput = args[0];
        const output = args[1];
        const modelFn = args[2];
        const input = {};
        if (rawInput instanceof Map) {
            for (const [k, v] of rawInput.entries())
                input[String(k).replace(/^:/, "")] = v;
        }
        else if (rawInput && typeof rawInput === "object") {
            for (const [k, v] of Object.entries(rawInput))
                input[String(k).replace(/^:/, "")] = v;
        }
        const model = (inp) => {
            if (modelFn && callFnVal) {
                try {
                    return callFnVal(modelFn, [new Map(Object.entries(inp))]);
                }
                catch {
                    return output;
                }
            }
            return output;
        };
        const local = explain_1.globalExplainer.localExplain(input, output, model);
        return new Map([
            ["input", new Map(Object.entries(local.input))],
            ["output", local.output],
            ["topFactors", local.topFactors.map((f) => new Map([
                    ["feature", f.feature], ["importance", f.importance],
                    ["direction", f.direction], ["description", f.description],
                ]))],
            ["counterfactual", local.counterfactual],
            ["confidence", local.confidence],
        ]);
    }
    if (op === "explain-natural") {
        const rawExpl = args[0];
        let audience = 'technical';
        for (let i = 1; i < args.length - 1; i += 2) {
            const key = String(args[i]).replace(/^:/, "");
            if (key === "audience")
                audience = String(args[i + 1]);
        }
        if (!(rawExpl instanceof Map))
            return "설명을 변환할 수 없습니다";
        const featuresRaw = rawExpl.get("features") ?? [];
        const features = (Array.isArray(featuresRaw) ? featuresRaw : []).map((f) => {
            if (f instanceof Map) {
                return {
                    feature: String(f.get("feature") ?? ""),
                    importance: Number(f.get("importance") ?? 0),
                    direction: String(f.get("direction") ?? "positive"),
                    description: String(f.get("description") ?? ""),
                };
            }
            return { feature: "", importance: 0, direction: "positive", description: "" };
        });
        const altsRaw = rawExpl.get("alternatives") ?? [];
        const alternatives = (Array.isArray(altsRaw) ? altsRaw : []).map((a) => {
            if (a instanceof Map)
                return { decision: a.get("decision"), reason: String(a.get("reason") ?? ""), probability: Number(a.get("probability") ?? 0) };
            return { decision: null, reason: "", probability: 0 };
        });
        const explanation = {
            decision: rawExpl.get("decision"),
            reasoning: rawExpl.get("reasoning") ?? [],
            features,
            confidence: Number(rawExpl.get("confidence") ?? 0.5),
            alternatives,
            summary: String(rawExpl.get("summary") ?? ""),
            audience: (rawExpl.get("audience") ?? "technical"),
        };
        return explain_1.globalExplainer.toNaturalLanguage(explanation, audience);
    }
    if (op === "explain-contrast") {
        const factors = {};
        const rawF = args[2];
        if (rawF instanceof Map) {
            for (const [k, v] of rawF.entries())
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        else if (rawF && typeof rawF === "object") {
            for (const [k, v] of Object.entries(rawF))
                factors[String(k).replace(/^:/, "")] = Number(v);
        }
        return explain_1.globalExplainer.contrastiveExplain(args[0], args[1], factors);
    }
    if (op === "explain-rules") {
        const examples = [];
        const toRec = (v) => {
            const r = {};
            if (v instanceof Map) {
                for (const [k, val] of v.entries())
                    r[String(k).replace(/^:/, "")] = val;
            }
            else if (v && typeof v === "object") {
                Object.assign(r, v);
            }
            return r;
        };
        if (Array.isArray(args[0])) {
            for (const ex of args[0]) {
                if (ex instanceof Map)
                    examples.push({ input: toRec(ex.get("input")), output: ex.get("output") });
                else if (ex && typeof ex === "object")
                    examples.push({ input: toRec(ex.input), output: ex.output });
            }
        }
        return explain_1.globalExplainer.extractRules(examples).map((r) => new Map([
            ["condition", r.condition], ["outcome", r.outcome], ["support", r.support],
        ]));
    }
    if (op === "explain-top-factors") {
        let n = 3;
        for (let i = 1; i < args.length - 1; i += 2) {
            if (String(args[i]).replace(/^:/, "") === "n")
                n = Number(args[i + 1]);
        }
        const rawExpl = args[0];
        let features = [];
        if (rawExpl instanceof Map)
            features = rawExpl.get("features") ?? [];
        if (!Array.isArray(features))
            features = [];
        return features.slice(0, n);
    }
    if (op === "explain-summary") {
        const rawExpl = args[0];
        if (rawExpl instanceof Map)
            return String(rawExpl.get("summary") ?? "");
        return "";
    }
    return null;
}
// === Phase 141: WORLD-MODEL ===
function evalWorldModel141(op, args) {
    if (op === "world-add-entity") {
        const kw = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            kw[String(args[i]).replace(/^:/, "")] = args[i + 1];
        }
        const rawP = kw["props"] ?? kw["properties"] ?? {};
        const props = rawP instanceof Map ? Object.fromEntries(rawP.entries()) : (typeof rawP === "object" && rawP !== null ? rawP : {});
        const e = world_model_1.globalWorldModel.addEntity({ id: String(kw["id"] ?? `entity-${Date.now()}`), type: String(kw["type"] ?? "unknown"), confidence: typeof kw["confidence"] === "number" ? kw["confidence"] : 1.0, properties: props });
        return new Map([["id", e.id], ["type", e.type], ["properties", new Map(Object.entries(e.properties))], ["confidence", e.confidence], ["lastUpdated", e.lastUpdated.toISOString()]]);
    }
    if (op === "world-update-entity") {
        const rawPu = args[1] ?? {};
        const propsu = rawPu instanceof Map ? Object.fromEntries(rawPu.entries()) : (typeof rawPu === "object" && rawPu !== null ? rawPu : {});
        const eu = world_model_1.globalWorldModel.updateEntity(String(args[0] ?? ""), propsu);
        if (!eu)
            return null;
        return new Map([["id", eu.id], ["type", eu.type], ["properties", new Map(Object.entries(eu.properties))], ["confidence", eu.confidence], ["lastUpdated", eu.lastUpdated.toISOString()]]);
    }
    if (op === "world-get-entity") {
        const eg = world_model_1.globalWorldModel.getEntity(String(args[0] ?? ""));
        if (!eg)
            return null;
        return new Map([["id", eg.id], ["type", eg.type], ["properties", new Map(Object.entries(eg.properties))], ["confidence", eg.confidence], ["lastUpdated", eg.lastUpdated.toISOString()]]);
    }
    if (op === "world-remove-entity") {
        return world_model_1.globalWorldModel.removeEntity(String(args[0] ?? ""));
    }
    if (op === "world-add-relation") {
        const kwr = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            kwr[String(args[i]).replace(/^:/, "")] = args[i + 1];
        }
        const rel = world_model_1.globalWorldModel.addRelation({ from: String(kwr["from"] ?? ""), to: String(kwr["to"] ?? ""), type: String(kwr["type"] ?? "related"), strength: typeof kwr["strength"] === "number" ? kwr["strength"] : 1.0, bidirectional: kwr["bidirectional"] === true });
        return new Map([["id", rel.id], ["from", rel.from], ["to", rel.to], ["type", rel.type], ["strength", rel.strength], ["bidirectional", rel.bidirectional]]);
    }
    if (op === "world-get-relations") {
        return world_model_1.globalWorldModel.getRelations(String(args[0] ?? "")).map(r => new Map([["id", r.id], ["from", r.from], ["to", r.to], ["type", r.type], ["strength", r.strength], ["bidirectional", r.bidirectional]]));
    }
    if (op === "world-find-path") {
        return world_model_1.globalWorldModel.findPath(String(args[0] ?? ""), String(args[1] ?? ""));
    }
    if (op === "world-set-fact") {
        world_model_1.globalWorldModel.setFact(String(args[0] ?? ""), args[1]);
        return null;
    }
    if (op === "world-get-fact") {
        return world_model_1.globalWorldModel.getFact(String(args[0] ?? ""));
    }
    if (op === "world-add-rule") {
        const kwrule = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            kwrule[String(args[i]).replace(/^:/, "")] = args[i + 1];
        }
        const rule = world_model_1.globalWorldModel.addRule({ condition: String(kwrule["condition"] ?? ""), consequence: String(kwrule["consequence"] ?? ""), confidence: typeof kwrule["confidence"] === "number" ? kwrule["confidence"] : 0.8 });
        return new Map([["id", rule.id], ["condition", rule.condition], ["consequence", rule.consequence], ["confidence", rule.confidence]]);
    }
    if (op === "world-apply-rules") {
        return world_model_1.globalWorldModel.applyRules().map(u => new Map([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]]));
    }
    if (op === "world-query") {
        const kwq = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            kwq[String(args[i]).replace(/^:/, "")] = args[i + 1];
        }
        return world_model_1.globalWorldModel.query(kwq["type"] !== undefined ? String(kwq["type"]) : undefined, kwq["min-confidence"] !== undefined ? Number(kwq["min-confidence"]) : undefined).map(e => new Map([["id", e.id], ["type", e.type], ["properties", new Map(Object.entries(e.properties))], ["confidence", e.confidence], ["lastUpdated", e.lastUpdated.toISOString()]]));
    }
    if (op === "world-snapshot") {
        const snap = world_model_1.globalWorldModel.snapshot();
        return new Map([["entityCount", snap.entities.size], ["relationCount", snap.relations.length], ["factCount", snap.facts.size], ["ruleCount", snap.rules.length], ["version", snap.version], ["timestamp", snap.timestamp.toISOString()]]);
    }
    if (op === "world-summarize") {
        return world_model_1.globalWorldModel.summarize();
    }
    if (op === "world-history") {
        return world_model_1.globalWorldModel.getHistory().map(u => new Map([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]]));
    }
    return undefined;
}
//# sourceMappingURL=eval-builtins.js.map