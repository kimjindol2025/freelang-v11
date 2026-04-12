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

import { Interpreter } from "./interpreter";
import { SExpr, Literal } from "./ast";
import { FreeLangPromise } from "./async-runtime";
import {
  lazySeq, isLazySeq, lazyHead, lazyTail,
  take, drop, iterate, rangeSeq, filterLazy, mapLazy, zipWithLazy, takeWhile,
  type LazySeq,
} from "./lazy-seq";
import { ContextManager } from "./context-window"; // Phase 95
import {
  ok, err, isOk, isErr, unwrap, unwrapOr,
  mapOk, mapErr, flatMap, recover, fromThrown,
  ErrorCategory,
} from "./result-type"; // Phase 96
import { defaultErrorSystem, AIErrorSystem } from "./error-system"; // Phase 96
import { globalToolRegistry } from "./tool-registry"; // Phase 97: Tool DSL
import { globalMemory } from "./memory-system"; // Phase 101: Memory System
import { globalRAG } from "./rag"; // Phase 102: RAG
import { globalBus, MessageBus, AgentMessage } from "./multi-agent"; // Phase 103: Multi-Agent
import { tryReasonBuiltin, tryWithFallback } from "./try-reason"; // Phase 104: TRY-REASON
import { createStream, getStream, deleteStream, streamText, FLStream } from "./streaming"; // Phase 105: Streaming
import { evaluateQuality, defaultCriteria } from "./quality-loop"; // Phase 106: Quality Loop
import { globalTutor } from "./fl-tutor"; // Phase 107: FL Self-Teaching
import { createTrace, getTrace, TraceNodeType } from "./reasoning-debugger"; // Phase 108: Reasoning Debugger
import { globalCompiler, PromptCompiler } from "./prompt-compiler"; // Phase 109: Prompt Compiler
import { sdk as flSDK } from "./fl-sdk"; // Phase 110: External AI SDK
import { globalTester, HypothesisConfig } from "./hypothesis"; // Phase 111: Hypothesis
import { maybeMap, maybeBind, maybeChain, maybeFilter, maybeCombine, maybeSelect } from "./maybe-chain"; // Phase 112: Maybe Chain
import { globalDebater, Argument } from "./debate"; // Phase 113: Debate
import { globalCheckpoint } from "./checkpoint"; // Phase 114: Checkpoint
import { globalMetaReasoner } from "./meta-reason"; // Phase 115: Meta-Reason
import { globalBeliefs, BeliefSystem } from "./belief"; // Phase 116: Belief System
import { globalAnalogy } from "./analogy"; // Phase 117: Analogy
import { globalCritique, defaultFinders, severityWeight } from "./critique"; // Phase 118: Critique Agent
import { globalComposer, ReasonStep } from "./compose-reason"; // Phase 119: Compose-Reason
import { globalCognition } from "./cognitive"; // Phase 120: Cognitive Architecture
import { globalConsensus, AgentVote, ConsensusEngine } from "./consensus"; // Phase 121: Consensus
import { globalDelegation, DelegateAgent, DelegateTask } from "./delegate"; // Phase 122: Delegation
import { globalNegotiator, NegotiationPosition } from "./negotiate"; // Phase 124: Negotiate
import { globalVoting, VotingSystem, Ballot } from "./vote"; // Phase 123: VOTE
import { globalSwarm, Swarm } from "./swarm"; // Phase 125: Swarm Intelligence
import { globalPeerReview, Reviewer, ReviewComment } from "./peer-review"; // Phase 127: Peer-Review
import { globalCompetition, Competition, Competitor } from "./compete"; // Phase 129: Compete
import { AgentChain, ChainAgent, ChainResult } from "./chain-agents"; // Phase 128: Chain-Agents

export function evalBuiltin(interp: Interpreter, op: string, args: any[], expr: SExpr): any {
  // interp.eval은 public이어야 하므로 (실제로는 public)
  const ev = (node: any) => (interp as any).eval(node);
  const callFn = (fn: any, a: any[]) => (interp as any).callFunction(fn, a);
  const callUser = (name: string, a: any[]) => (interp as any).callUserFunction(name, a);
  const callFnVal = (fn: any, a: any[]) => (interp as any).callFunctionValue(fn, a);
  const toDisplay = (val: any) => (interp as any).toDisplayString(val);

  switch (op) {
    // Arithmetic
    case "+":
      return args.reduce((a: number, b: number) => a + b, 0);
    case "-":
      return args.length === 1 ? -args[0] : args.reduce((a: number, b: number) => a - b);
    case "*":
      return args.reduce((a: number, b: number) => a * b, 1);
    case "/":
      return args.length === 1 ? 1 / args[0] : args.reduce((a: number, b: number) => a / b);
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
      return args.every((a: any) => a);
    case "or":
      return args.some((a: any) => a);
    case "not":
      return !args[0];

    // Output
    case "print":
      process.stdout.write(args.map((a: any) => toDisplay(a)).join(" "));
      return null;
    case "println":
    case "echo":
      console.log(...args.map((a: any) => toDisplay(a)));
      return null;
    case "print-err":
      process.stderr.write(args.map((a: any) => toDisplay(a)).join(" ") + "\n");
      return null;
    case "str":
      return args.map((a: any) => toDisplay(a)).join("");
    case "repr":
      return JSON.stringify(args[0], null, 2);
    case "inspect": {
      const inspected = toDisplay(args[0]);
      console.log(inspected);
      return args[0];
    }

    // String basic
    case "concat":
      if (!Array.isArray(args[0])) return args.join("");
      // fall through to array concat below
      if (!Array.isArray(args[1])) return args[0] || [];
      return (args[0] as any[]).concat(args[1]);
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
      if (Array.isArray(args[0])) return [...args[0]].reverse();
      return [...(args[0] || [])].reverse();
    case "map": {
      const mapFn = args[0];
      const mapArr = Array.isArray(args[1]) ? args[1] : [];
      if (typeof mapFn === "function") {
        return mapArr.map(mapFn);
      } else if (mapFn && ((mapFn as any).kind === "function-value" || (mapFn as any).kind === "async-function-value")) {
        return mapArr.map((item: any) => callFnVal(mapFn, [item]));
      }
      return mapArr;
    }

    // Phase 7: Async functions
    case "set-timeout": {
      if (expr.args.length < 2) throw new Error(`set-timeout requires callback and delay`);
      const callback = ev(expr.args[0]);
      const delay = ev(expr.args[1]) as number;
      return new FreeLangPromise((resolve, reject) => {
        setTimeout(() => {
          try {
            if (typeof callback === "function") {
              resolve(callback());
            } else if ((callback as any).kind === "function-value") {
              resolve(callFnVal(callback, []));
            } else {
              reject(new Error("set-timeout callback must be a function"));
            }
          } catch (e) {
            reject(e as Error);
          }
        }, delay);
      });
    }

    case "promise": {
      if (expr.args.length < 1) throw new Error(`promise requires executor function`);
      const executor = ev(expr.args[0]);
      if ((executor as any).kind === "function-value") {
        return new FreeLangPromise((resolve, reject) => {
          try {
            const resolveWrapper = { kind: "builtin-function", fn: (a: any[]) => resolve(a[0]) };
            const rejectWrapper = {
              kind: "builtin-function",
              fn: (a: any[]) => reject(a[0] instanceof Error ? a[0] : new Error(String(a[0]))),
            };
            callFnVal(executor, [resolveWrapper, rejectWrapper]);
          } catch (e) {
            reject(e as Error);
          }
        });
      } else {
        throw new Error("promise executor must be a function");
      }
    }

    case "fn": {
      // This case shouldn't normally reach here (handled earlier), but keep as fallback
      let params: string[] = [];
      const paramNode = expr.args[0];
      if (paramNode && typeof paramNode === "object" && "kind" in paramNode && paramNode.kind === "literal" && Array.isArray((paramNode as any).value)) {
        params = ((paramNode as any).value as any[]).map((p: any) => {
          if (p && typeof p === "object" && "kind" in p && p.kind === "variable") return (p as any).name;
          throw new Error(`fn parameter must be a variable`);
        });
      } else if (paramNode && typeof paramNode === "object" && "kind" in paramNode && paramNode.kind === "variable") {
        params = [(paramNode as any).name];
      } else if (Array.isArray(paramNode)) {
        params = (paramNode as any[]).map((p: any) => (typeof p === "string" ? p : String(p)));
      } else {
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
      let reduceFn: any, accumulator: any, arr: any[];
      if (Array.isArray(args[0])) {
        // 구형: (reduce arr init fn)
        arr = args[0]; accumulator = args[1]; reduceFn = args[2];
      } else {
        // 표준: (reduce fn init arr)
        reduceFn = args[0]; accumulator = args[1]; arr = args[2] || [];
      }
      if (!Array.isArray(arr)) throw new Error(`reduce: 배열 인자가 필요합니다`);
      for (const item of arr) {
        accumulator = callFn(reduceFn, [accumulator, item]);
      }
      return accumulator;
    }

    // HTTP responses
    case "json-response":
      if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) return args[0];
      if (Array.isArray(args[0])) {
        const obj: Record<string, any> = {};
        for (let i = 0; i < args[0].length; i += 2) {
          let key = args[0][i];
          const value = args[0][i + 1];
          if (typeof key === "string" && key.startsWith(":")) key = key.substring(1);
          if (typeof key === "string") obj[key] = value;
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
      if (typeof args[0] === "string" && args[0].length > 0) return args[0].charCodeAt(0);
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
      if (Array.isArray(args[0])) return args[0].slice(args[1], args[2]);
      if (typeof args[0] === "string") return args[0].slice(args[1], args[2]);
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
      if (typeof args[0] === "string" && typeof args[1] === "string") return args[0].includes(args[1]);
      if (Array.isArray(args[0])) return args[0].includes(args[1]);
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
      if (!Array.isArray(args[0])) return [];
      const filterFn = args[1];
      if (typeof filterFn === "function") return args[0].filter(filterFn);
      if (filterFn && (filterFn as any).kind === "function-value") {
        return args[0].filter((item: any) => callFnVal(filterFn, [item]));
      }
      return args[0];
    }
    case "find":
      if (Array.isArray(args[0])) {
        const findFn = args[1];
        if (typeof findFn === "function") return args[0].find(findFn) ?? null;
        if (findFn && (findFn as any).kind === "function-value") {
          return args[0].find((item: any) => callFnVal(findFn, [item])) ?? null;
        }
        return args[0].indexOf(findFn);
      }
      return -1;
    case "last":
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
    case "get":
      if (Array.isArray(args[0])) return typeof args[1] === "number" ? (args[0][args[1]] ?? null) : null;
      if (typeof args[0] === "string") return typeof args[1] === "number" ? (args[0][args[1]] ?? null) : null;
      if (args[0] !== null && typeof args[0] === "object") return args[0][args[1]] ?? null;
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
      if (!Array.isArray(args[0])) return [];
      const flatten = (arr: any[]): any[] => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
      return flatten(args[0]);
    }
    case "unique":
      return Array.isArray(args[0]) ? [...new Set(args[0])] : [];
    case "sort":
      if (!Array.isArray(args[0])) return [];
      return [...args[0]].sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") return a - b;
        return String(a).localeCompare(String(b));
      });
    case "push":
      if (!Array.isArray(args[0])) return [args[1]];
      return [...args[0], args[1]];
    case "pop":
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
    case "shift":
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
    case "unshift":
      if (!Array.isArray(args[0])) return [args[1]];
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
      return ok(args[0]);
    case "err": {
      // (err code message) / (err code message category) — Phase 96 형식
      // 하위 호환: (err value) → {_tag: "Err", code: "ERR", message: String(value)}
      if (args.length >= 2) {
        const code96 = String(args[0] ?? 'ERR');
        const message96 = String(args[1] ?? '');
        const category96 = args[2] as ErrorCategory | undefined;
        return err(code96, message96, category96 ? { category: category96 } : undefined);
      }
      // 하위 호환: (err value) → Err
      return err("ERR", String(args[0] ?? ''));
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
      if (expr.args.length < 2) throw new Error(`bind requires monad and transform function`);
      const monad = ev(expr.args[0]);
      const transformFn = ev(expr.args[1]);
      if ((monad as any).kind === "Result") {
        return (monad as any).tag === "Ok" ? callFn(transformFn, [(monad as any).value]) : monad;
      }
      if ((monad as any).kind === "Option") {
        return (monad as any).tag === "Some" ? callFn(transformFn, [(monad as any).value]) : monad;
      }
      if (Array.isArray(monad)) {
        let result: any[] = [];
        for (const item of monad) {
          const transformed = callFn(transformFn, [item]);
          if (Array.isArray(transformed)) result = result.concat(transformed);
          else result.push(transformed);
        }
        return result;
      }
      if ((monad as any).kind === "Either") {
        return (monad as any).tag === "Right" ? callFn(transformFn, [(monad as any).value]) : monad;
      }
      if ((monad as any).kind === "Validation") {
        if ((monad as any).tag === "Success") {
          const result = callFn(transformFn, [(monad as any).value]);
          if ((result as any).kind === "Validation" && (result as any).tag === "Failure") return result;
          return result;
        }
        return monad;
      }
      if ((monad as any).kind === "Writer") {
        const result = callFn(transformFn, [(monad as any).value]);
        if ((result as any).kind === "Writer") {
          return { kind: "Writer", value: (result as any).value, log: (monad as any).log + (result as any).log };
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
      return lazySeq(() => hVal, () => isLazySeq(tVal) ? tVal : null);
    }

    // (iterate f init) — 무한 시퀀스: init, f(init), f(f(init)), ...
    case "iterate": {
      const fn = args[0];
      const initVal = args[1];
      const applyFn = (v: any) => callFn(fn, [v]);
      const makeIter = (cur: any): LazySeq =>
        lazySeq(() => cur, () => makeIter(applyFn(cur)));
      return makeIter(initVal);
    }

    // (range n) → lazy [0..n-1], (range start end) → lazy [start..end-1]
    case "range": {
      if (args.length === 0) {
        // 무한 자연수
        return rangeSeq(0);
      } else if (args.length === 1) {
        return rangeSeq(0, args[0]);
      } else {
        return rangeSeq(args[0], args[1]);
      }
    }

    // (take n seq) — lazy or array에서 n개 꺼냄
    case "take": {
      const n = args[0] as number;
      const seq = args[1];
      return take(n, isLazySeq(seq) ? seq : Array.isArray(seq) ? seq : null);
    }

    // (drop n seq) — lazy seq에서 n개 버리고 나머지 반환
    case "drop": {
      const n = args[0] as number;
      const seq = args[1];
      if (Array.isArray(seq)) return seq.slice(n);
      return drop(n, isLazySeq(seq) ? seq : null);
    }

    // (filter-lazy pred seq) — 레이지 필터
    case "filter-lazy": {
      const pred = args[0];
      const seq = args[1];
      const applyPred = (v: any): boolean => Boolean(callFn(pred, [v]));
      const doFilter = (s: LazySeq | null): LazySeq | null => {
        if (!s) return null;
        // pred가 false인 앞부분 건너뜀 (eager skip)
        let cur: LazySeq | null = s;
        while (cur && !applyPred(lazyHead(cur))) cur = lazyTail(cur);
        if (!cur) return null;
        const h = lazyHead(cur);
        const t = lazyTail(cur);
        return lazySeq(() => h, () => doFilter(t));
      };
      return doFilter(isLazySeq(seq) ? seq : null);
    }

    // (map-lazy f seq) — 레이지 맵 (단항)
    case "map-lazy": {
      const f2 = args[0];
      const seq2 = args[1];
      const doMap = (s: LazySeq | null): LazySeq | null => {
        if (!s) return null;
        const h = lazyHead(s);
        return lazySeq(() => callFn(f2, [h]), () => doMap(lazyTail(s!)));
      };
      return doMap(isLazySeq(seq2) ? seq2 : null);
    }

    // (take-while pred seq) — pred가 true인 동안만 꺼냄 (배열 반환)
    case "take-while": {
      const pred = args[0];
      const seq = args[1];
      if (Array.isArray(seq)) {
        const result: any[] = [];
        for (const v of seq) {
          if (!callFn(pred, [v])) break;
          result.push(v);
        }
        return result;
      }
      const doTakeWhile = (s: LazySeq | null): any[] => {
        const result: any[] = [];
        let cur = s;
        while (cur) {
          const h = lazyHead(cur);
          if (!callFn(pred, [h])) break;
          result.push(h);
          cur = lazyTail(cur);
        }
        return result;
      };
      return doTakeWhile(isLazySeq(seq) ? seq : null);
    }

    // (lazy-head seq) / (lazy-tail seq) — 직접 접근
    case "lazy-head": {
      return isLazySeq(args[0]) ? lazyHead(args[0]) : null;
    }
    case "lazy-tail": {
      return isLazySeq(args[0]) ? lazyTail(args[0]) : null;
    }

    // (lazy? v) — 레이지 시퀀스 여부 확인
    case "lazy?": {
      return isLazySeq(args[0]);
    }

    // ── Phase 95: Context Window 관리 함수 ─────────────────────────────
    // (ctx-new max-tokens?) → ContextManager
    case "ctx-new": {
      const maxTokens = typeof args[0] === "number" ? args[0] : 4096;
      return new ContextManager(maxTokens);
    }

    // (ctx-add ctx content :priority p :tags [...] :tokens n) → id
    case "ctx-add": {
      const ctx = args[0] as ContextManager;
      const content = args[1];
      const opts: { priority?: number; tags?: string[]; tokens?: number } = {};
      for (let i = 2; i < expr.args.length - 1; i++) {
        const raw = expr.args[i];
        if ((raw as any).kind === "keyword") {
          const kw = (raw as any).name as string;
          const val = args[i];
          if (kw === "priority") opts.priority = Number(val);
          else if (kw === "tags") opts.tags = Array.isArray(val) ? val : [String(val)];
          else if (kw === "tokens") opts.tokens = Number(val);
        }
      }
      return ctx.add(content, opts);
    }

    // (ctx-get ctx id) → ContextEntry | undefined
    case "ctx-get": {
      const ctx = args[0] as ContextManager;
      return ctx.get(String(args[1])) ?? null;
    }

    // (ctx-remove ctx id) → void
    case "ctx-remove": {
      const ctx = args[0] as ContextManager;
      ctx.remove(String(args[1]));
      return null;
    }

    // (ctx-trim ctx) → removed entries
    case "ctx-trim": {
      const ctx = args[0] as ContextManager;
      return ctx.trim();
    }

    // (ctx-stats ctx) → {used, max, percent, count}
    case "ctx-stats": {
      const ctx = args[0] as ContextManager;
      return ctx.stats();
    }

    // (ctx-has-room? ctx tokens) → bool
    case "ctx-has-room?": {
      const ctx = args[0] as ContextManager;
      return ctx.hasRoom(Number(args[1]));
    }

    // (ctx-all ctx) / (ctx-all ctx tag) → entries
    case "ctx-all": {
      const ctx = args[0] as ContextManager;
      const tag = args.length > 1 ? String(args[1]) : undefined;
      return ctx.getAll(tag);
    }

    // ── Phase 96: Result 타입 추가 함수 ─────────────────────────────────────

    // (ok? result) → bool
    case "ok?":
      return isOk(args[0]);

    // (err? result) → bool
    case "err?":
      return isErr(args[0]);

    // (unwrap result) → value or throw
    case "unwrap":
      return unwrap(args[0]);

    // (unwrap-or result default) → value
    case "unwrap-or":
      return unwrapOr(args[0], args[1]);

    // (map-ok result fn) → Result
    case "map-ok": {
      const r = args[0];
      const fn = args[1];
      return mapOk(r, (v: any) => callFn(fn, [v]));
    }

    // (map-err result fn) → Result
    case "map-err": {
      const r = args[0];
      const fn = args[1];
      return mapErr(r, (e: any) => callFn(fn, [e]));
    }

    // (flat-map result fn) → Result
    case "flat-map": {
      const r = args[0];
      const fn = args[1];
      return flatMap(r, (v: any) => callFn(fn, [v]));
    }

    // (recover result fn) → value (Ok값 또는 fn(err) 반환)
    case "recover": {
      const r = args[0];
      const fn = args[1];
      return recover(r, (e: any) => callFn(fn, [e]));
    }

    // (result-explain err) → 한국어 설명 문자열
    case "result-explain": {
      const e = args[0];
      if (!isErr(e)) return '(Ok 값 — 에러 없음)';
      return defaultErrorSystem.explain(e);
    }

    // (result-classify err-obj) → Err 구조체
    case "result-classify": {
      const raw = args[0];
      if (raw instanceof Error) return defaultErrorSystem.classify(raw);
      if (typeof raw === 'string') return defaultErrorSystem.classify(new Error(raw));
      return raw;
    }

    // Phase 101: Memory System
    // (mem-remember "key" value) — 장기 저장
    case "mem-remember": {
      const key = String(args[0]);
      const value = args[1];
      globalMemory.remember(key, value, { scope: 'long-term', ttl: 'forever' });
      return null;
    }

    // (mem-remember-short "key" value ttl-ms) — 단기 저장
    case "mem-remember-short": {
      const key = String(args[0]);
      const value = args[1];
      const ttl = typeof args[2] === 'number' ? args[2] : 60000;
      globalMemory.remember(key, value, { scope: 'short-term', ttl });
      return null;
    }

    // (mem-recall "key") / (mem-recall "key" fallback) — 조회
    case "mem-recall": {
      const key = String(args[0]);
      const fallback = args.length > 1 ? args[1] : null;
      return globalMemory.recall(key, fallback);
    }

    // (mem-forget "key") — 삭제
    case "mem-forget": {
      const key = String(args[0]);
      return globalMemory.forget(key);
    }

    // (mem-episode "id" "what") / (mem-episode "id" "what" context outcome)
    case "mem-episode": {
      const id = String(args[0]);
      const what = String(args[1]);
      const context = args[2] ?? {};
      const outcome = args[3];
      return globalMemory.recordEpisode(id, what, context, outcome);
    }

    // (mem-search-episodes "query") — 에피소드 검색
    case "mem-search-episodes": {
      const query = String(args[0]);
      return globalMemory.searchEpisodes(query);
    }

    // (mem-working-set value) — 작업 메모리 저장
    case "mem-working-set": {
      globalMemory.setWorking(args[0]);
      return null;
    }

    // (mem-working-get) — 작업 메모리 조회
    case "mem-working-get": {
      return globalMemory.getWorking();
    }

    // (mem-working-clear) — 작업 메모리 초기화
    case "mem-working-clear": {
      globalMemory.clearWorking();
      return null;
    }

    // (mem-keys) / (mem-keys "scope") — 모든 키 목록
    case "mem-keys": {
      const scope = args.length > 0 ? String(args[0]) as any : undefined;
      return globalMemory.keys(scope);
    }

    // (mem-stats) — 통계
    case "mem-stats": {
      return globalMemory.stats();
    }

    // (mem-purge) — 만료 정리
    case "mem-purge": {
      return globalMemory.purgeExpired();
    }

    // (mem-search-tag "tag") — 태그 검색
    case "mem-search-tag": {
      const tag = String(args[0]);
      return globalMemory.searchByTag(tag);
    }

    // Phase 97: (use-tool "toolname" {key val ...}) — 도구 사용
    case "use-tool": {
      const toolName = String(args[0]);
      const toolArgs: Record<string, any> = (args[1] && typeof args[1] === 'object' && !Array.isArray(args[1]))
        ? args[1]
        : {};
      const result = globalToolRegistry.executeSync(toolName, toolArgs);
      if (!result.success) throw new Error(result.error || `Tool failed: ${toolName}`);
      return result.output;
    }

    // Phase 97: (list-tools) — 등록된 도구 목록
    case "list-tools": {
      return globalToolRegistry.listAll().map(t => t.name);
    }

    // Phase 102: RAG 내장 함수
    // (rag-add "id" "content") — 문서 추가
    case "rag-add": {
      const id = String(args[0]);
      const content = String(args[1]);
      const metadata = args[2] && typeof args[2] === 'object' ? args[2] : undefined;
      globalRAG.add({ id, content, metadata });
      return true;
    }

    // (rag-retrieve "query" topK) — 검색 → 리스트
    case "rag-retrieve": {
      const query = String(args[0]);
      const topK = typeof args[1] === 'number' ? args[1] : 3;
      const results = globalRAG.retrieve(query, topK);
      return results.map(d => ({ id: d.id, content: d.content, score: d.score ?? 0 }));
    }

    // (rag-query "query") — 검색 + 기본 augment → 문자열
    case "rag-query": {
      const query = String(args[0]);
      const topK = typeof args[1] === 'number' ? args[1] : 3;
      const result = globalRAG.query(query, { topK });
      return result.augmented;
    }

    // (rag-size) — 문서 수
    case "rag-size": {
      return globalRAG.size();
    }

    // (rag-remove "id") — 문서 삭제
    case "rag-remove": {
      const id = String(args[0]);
      return globalRAG.remove(id);
    }

    // Phase 103: 멀티 에이전트 통신

    // (agent-spawn "id" handler-fn) → AgentHandle
    case "agent-spawn": {
      const agentId = String(args[0]);
      const handlerFn = args[1];
      const handler = (msg: AgentMessage, bus: MessageBus) => {
        return callFn(handlerFn, [msg, bus]);
      };
      return globalBus.spawn(agentId, handler);
    }

    // (agent-send "from" "to" content) → AgentMessage
    case "agent-send": {
      const from = String(args[0]);
      const to = String(args[1]);
      const content = args[2];
      return globalBus.send(from, to, content);
    }

    // (agent-broadcast "from" content) → AgentMessage[]
    case "agent-broadcast": {
      const from = String(args[0]);
      const content = args[1];
      return globalBus.broadcast(from, content);
    }

    // (agent-recv "id") → AgentMessage | null
    case "agent-recv": {
      const agentId = String(args[0]);
      return globalBus.recv(agentId);
    }

    // (agent-process "id") → any[]
    case "agent-process": {
      const agentId = String(args[0]);
      return globalBus.process(agentId);
    }

    // (agent-list) → string[]
    case "agent-list": {
      return globalBus.list();
    }

    // (agent-history) → AgentMessage[]
    case "agent-history": {
      return globalBus.history();
    }

    // (agent-inbox-size "id") → number
    case "agent-inbox-size": {
      const agentId = String(args[0]);
      return globalBus.inboxSize(agentId);
    }

    // Phase 104: TRY-REASON
    // (try-reason [[strategy fn] ...]) → 첫 성공 값
    case "try-reason": {
      const attemptsList = args[0];
      if (!Array.isArray(attemptsList)) {
        throw new Error("try-reason: attempts must be a list");
      }
      const attempts: Array<[string, () => any]> = attemptsList.map((item: any) => {
        if (Array.isArray(item) && item.length === 2) {
          const [strategy, fn] = item;
          return [String(strategy), () => {
            if (typeof fn === "function") return fn();
            if (fn && fn.kind === "function-value") return callFn(fn, []);
            return fn;
          }] as [string, () => any];
        }
        throw new Error("try-reason: each attempt must be [strategy fn]");
      });
      return tryReasonBuiltin(attempts);
    }

    // Phase 106: Quality Loop 내장 함수
    // (quality-check output threshold?) → score (0.0~1.0)
    case "quality-check": {
      const output = args[0];
      const threshold = args.length > 1 ? Number(args[1]) : 0.7;
      const result = evaluateQuality(output, defaultCriteria, threshold);
      return result.score;
    }

    // (quality-passed? output threshold?) → boolean
    case "quality-passed?": {
      const output = args[0];
      const threshold = args.length > 1 ? Number(args[1]) : 0.7;
      const result = evaluateQuality(output, defaultCriteria, threshold);
      return result.passed;
    }

    // (quality-feedback output) → string[]
    case "quality-feedback": {
      const output = args[0];
      const result = evaluateQuality(output, defaultCriteria, 0.7);
      return result.feedback;
    }

    // Phase 105: Streaming Output
    // (stream-create) → stream-id 문자열
    case "stream-create": {
      const { id } = createStream();
      return id;
    }

    // (stream-write "id" "chunk") — 청크 쓰기
    case "stream-write": {
      const streamId = String(args[0]);
      const content = String(args[1] ?? "");
      const s105a = getStream(streamId);
      if (!s105a) throw new Error(`stream-write: stream not found: ${streamId}`);
      s105a.write(content);
      return null;
    }

    // (stream-end "id") — 스트림 종료
    case "stream-end": {
      const streamId = String(args[0]);
      const s105b = getStream(streamId);
      if (!s105b) throw new Error(`stream-end: stream not found: ${streamId}`);
      s105b.end();
      return null;
    }

    // (stream-collect "id") → 수집된 문자열 (Promise or string)
    case "stream-collect": {
      const streamId = String(args[0]);
      const s105c = getStream(streamId);
      if (!s105c) throw new Error(`stream-collect: stream not found: ${streamId}`);
      return s105c.collect();
    }

    // (stream-done? "id") → boolean
    case "stream-done?": {
      const streamId = String(args[0]);
      const s105d = getStream(streamId);
      if (!s105d) return true;
      return s105d.isDone();
    }

    // (stream-chunks "id") → StreamChunk[]
    case "stream-chunks": {
      const streamId = String(args[0]);
      const s105e = getStream(streamId);
      if (!s105e) throw new Error(`stream-chunks: stream not found: ${streamId}`);
      return s105e.getChunks();
    }

    // (stream-chunk-count "id") → number
    case "stream-chunk-count": {
      const streamId = String(args[0]);
      const s105f = getStream(streamId);
      if (!s105f) throw new Error(`stream-chunk-count: stream not found: ${streamId}`);
      return s105f.chunkCount();
    }

    // (stream-text "id" "text") — 텍스트를 단어 단위로 자동 스트리밍
    case "stream-text": {
      const streamId = String(args[0]);
      const text = String(args[1] ?? "");
      const s105g = getStream(streamId);
      if (!s105g) throw new Error(`stream-text: stream not found: ${streamId}`);
      return streamText(s105g, text, 0);
    }

    // (stream-delete "id") → boolean
    case "stream-delete": {
      const streamId = String(args[0]);
      return deleteStream(streamId);
    }

    // (try-with-fallback fn fallback) → fn() 실패 시 fallback
    case "try-with-fallback": {
      const fn = args[0];
      const fallback = args[1];
      const wrappedFn = () => {
        if (typeof fn === "function") return fn();
        if (fn && fn.kind === "function-value") return callFn(fn, []);
        return fn;
      };
      return tryWithFallback(wrappedFn, fallback);
    }

    // Phase 107: FL 자기 교육 시스템 내장 함수
    // (fl-learn "concept") → 레슨 마크다운 문자열
    case "fl-learn": {
      const concept = String(args[0] ?? "");
      return globalTutor.lessonMarkdown(concept);
    }

    // (fl-examples "tag") → 태그별 예제 리스트 (JSON 문자열)
    case "fl-examples": {
      const tag = String(args[0] ?? "");
      const examples = globalTutor.findByTag(tag);
      return examples.map(e => `${e.concept}: ${e.description}`).join("\n");
    }

    // (fl-example-count) → 총 예제 수
    case "fl-example-count": {
      return globalTutor.size();
    }

    // (fl-concepts) → 개념 목록 (공백 구분 문자열)
    case "fl-concepts": {
      return globalTutor.concepts().join(" ");
    }

    // Phase 108: AI 추론 시각화 디버거 내장 함수
    // (trace-create "label") → trace-id 문자열
    case "trace-create": {
      const label = String(args[0] ?? "trace");
      const { id } = createTrace(label);
      return id;
    }

    // (trace-add id "type" "label") → null
    // (trace-add id "type" "label" value) → null
    case "trace-add": {
      const traceId = String(args[0] ?? "");
      const nodeType = String(args[1] ?? "thought") as TraceNodeType;
      const nodeLabel = String(args[2] ?? "");
      const nodeValue = args.length >= 4 ? args[3] : undefined;
      const trace = getTrace(traceId);
      if (!trace) return null;
      trace.add(nodeType, nodeLabel, nodeValue);
      return null;
    }

    // (trace-enter id "type" "label") → null
    case "trace-enter": {
      const traceId = String(args[0] ?? "");
      const nodeType = String(args[1] ?? "thought") as TraceNodeType;
      const nodeLabel = String(args[2] ?? "");
      const nodeValue = args.length >= 4 ? args[3] : undefined;
      const trace = getTrace(traceId);
      if (!trace) return null;
      trace.enter(nodeType, nodeLabel, nodeValue);
      return null;
    }

    // (trace-exit id) → null
    // (trace-exit id result) → null
    case "trace-exit": {
      const traceId = String(args[0] ?? "");
      const result = args.length >= 2 ? args[1] : undefined;
      const trace = getTrace(traceId);
      if (!trace) return null;
      trace.exit(result);
      return null;
    }

    // (trace-markdown id) → 마크다운 문자열
    case "trace-markdown": {
      const traceId = String(args[0] ?? "");
      const trace = getTrace(traceId);
      if (!trace) return "";
      return trace.toMarkdown();
    }

    // (trace-tree id) → 텍스트 트리 문자열
    case "trace-tree": {
      const traceId = String(args[0] ?? "");
      const trace = getTrace(traceId);
      if (!trace) return "";
      return trace.toTree();
    }

    // (trace-node-count id) → 노드 수 (숫자)
    case "trace-node-count": {
      const traceId = String(args[0] ?? "");
      const trace = getTrace(traceId);
      if (!trace) return 0;
      return trace.nodeCount();
    }

    // Phase 109: FL → 최적 프롬프트 컴파일러 내장 함수
    // (prompt-compile "blockType" "instruction") → 프롬프트 문자열
    case "prompt-compile": {
      const blockType = String(args[0] ?? "COT");
      const instruction = String(args[1] ?? "");
      const section = globalCompiler.compileBlock(blockType, {});
      const sections = section ? [section] : [{ name: 'default', content: '', priority: 0.5 as number }];
      const result = globalCompiler.compile(sections, instruction);
      return result.prompt;
    }

    // (prompt-tokens "text") → 추정 토큰 수 (숫자)
    case "prompt-tokens": {
      const text = String(args[0] ?? "");
      return Math.ceil(text.length / 4);
    }

    // (prompt-target "claude"|"gpt"|"generic") → 타겟 설정 후 현재 타겟 반환
    case "prompt-target": {
      const target = String(args[0] ?? "claude") as 'claude' | 'gpt' | 'generic';
      globalCompiler.setTarget(target);
      return target;
    }

    // (prompt-from-code "fl-code" "instruction") → FL 코드에서 자동 컴파일된 프롬프트
    case "prompt-from-code": {
      const flCode = String(args[0] ?? "");
      const instruction = String(args[1] ?? "");
      const result = globalCompiler.compileFromCode(flCode, instruction);
      return result.prompt;
    }

    // Phase 110: External AI SDK 내장 함수
    // (sdk-version) → "9.0.0"
    case "sdk-version": {
      return flSDK.version;
    }

    // (sdk-features) → 피처 리스트 (배열)
    case "sdk-features": {
      return [...flSDK.features];
    }

    // (sdk-supports "feature") → boolean
    case "sdk-supports": {
      const feature = String(args[0] ?? "");
      return flSDK.supports(feature);
    }

    // (sdk-snippet "concept") → 코드 문자열
    case "sdk-snippet": {
      const concept = String(args[0] ?? "");
      return flSDK.snippet(concept);
    }

    // (sdk-validate "code") → boolean
    case "sdk-validate": {
      const code = String(args[0] ?? "");
      const result = flSDK.validate(code);
      return result.valid;
    }

    // ── Phase 112: maybe-chain 확률 자동 전파 ────────────────────────────

    // (maybe-map $m fn) → maybe(same-confidence, fn(value))
    case "maybe-map": {
      const [m, fn] = args;
      return maybeMap(m, (v: any) => callFnVal(fn, [v]));
    }

    // (maybe-bind $m fn) → fn(value) 결과 maybe와 확률 곱
    case "maybe-bind": {
      const [m, fn] = args;
      return maybeBind(m, (v: any) => callFnVal(fn, [v]));
    }

    // (maybe-chain maybe-list fn) → 확률 곱 + 값 합성
    case "maybe-chain": {
      const [maybes, fn] = args;
      const list = Array.isArray(maybes) ? maybes : [maybes];
      return maybeChain(list, (...vals: any[]) => callFnVal(fn, vals));
    }

    // (maybe-filter $m pred) → 조건 불만족 시 none
    case "maybe-filter": {
      const [m, pred] = args;
      return maybeFilter(m, (v: any) => callFnVal(pred, [v]));
    }

    // (maybe-combine $a $b fn) → 두 maybe 결합 (확률 곱)
    case "maybe-combine": {
      const [a, b, fn] = args;
      return maybeCombine(a, b, (x: any, y: any) => callFnVal(fn, [x, y]));
    }

    // (maybe-select maybe-list) → 최고 신뢰도 선택
    case "maybe-select": {
      const list = Array.isArray(args[0]) ? args[0] : args;
      return maybeSelect(list);
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
        if ((fn as any).kind === "builtin-function") {
          return (fn as any).fn(args.map((arg: any) => ev(arg)));
        } else if (typeof fn === "function" || (fn as any).kind === "function-value") {
          return callFn(fn, args);
        }
      }
      // Phase 111: Hypothesis 내장 함수
      if (op === "hypothesis") {
        // (hypothesis claim test-fn eval-fn) → verdict string
        const [claim, testFn, evalFn] = args;
        const config: HypothesisConfig = {
          claim: String(claim),
          test: (attempt: number) => {
            if (typeof testFn === "function") return testFn(attempt);
            if ((testFn as any)?.kind === "function-value") return callFn(testFn, [attempt]);
            return null;
          },
          evaluate: (evidence: any[]) => {
            if (typeof evalFn === "function") return evalFn(evidence);
            if ((evalFn as any)?.kind === "function-value") return callFn(evalFn, [evidence]);
            return 0;
          },
        };
        const result = globalTester.test(config);
        return result.verdict;
      }
      if (op === "hypothesis-confidence") {
        // (hypothesis-confidence claim test-fn eval-fn) → confidence number
        const [claim, testFn, evalFn] = args;
        const config: HypothesisConfig = {
          claim: String(claim),
          test: (attempt: number) => {
            if (typeof testFn === "function") return testFn(attempt);
            if ((testFn as any)?.kind === "function-value") return callFn(testFn, [attempt]);
            return null;
          },
          evaluate: (evidence: any[]) => {
            if (typeof evalFn === "function") return evalFn(evidence);
            if ((evalFn as any)?.kind === "function-value") return callFn(evalFn, [evidence]);
            return 0;
          },
        };
        const result = globalTester.test(config);
        return result.confidence;
      }
      if (op === "hypothesis-compete") {
        // (hypothesis-compete hypotheses-list) → winner claim string
        // hypotheses-list: array of [claim, test-fn, eval-fn]
        const hypoList: any[] = args[0];
        if (!Array.isArray(hypoList) || hypoList.length === 0) return null;
        const configs: HypothesisConfig[] = hypoList.map((h: any) => {
          const [claim, testFn, evalFn] = Array.isArray(h) ? h : [h, () => null, () => 0];
          return {
            claim: String(claim),
            test: (attempt: number) => {
              if (typeof testFn === "function") return testFn(attempt);
              if ((testFn as any)?.kind === "function-value") return callFn(testFn, [attempt]);
              return null;
            },
            evaluate: (evidence: any[]) => {
              if (typeof evalFn === "function") return evalFn(evidence);
              if ((evalFn as any)?.kind === "function-value") return callFn(evalFn, [evidence]);
              return 0;
            },
          };
        });
        const winner = globalTester.compete(configs);
        return winner.claim;
      }

      // Phase 113: Debate 내장 함수
      if (op === "debate") {
        // (debate proposition pro-fn con-fn) → winner string
        const [proposition, proFn, conFn] = args;
        const result = globalDebater.debate({
          proposition: String(proposition),
          pro: (round: number, conArgs: Argument[]) => {
            if (typeof proFn === "function") return proFn(round, conArgs);
            if ((proFn as any)?.kind === "function-value") return callFn(proFn, [round, conArgs]);
            return { side: 'pro', point: String(proFn), strength: 0.5 };
          },
          con: (round: number, proArgs: Argument[]) => {
            if (typeof conFn === "function") return conFn(round, proArgs);
            if ((conFn as any)?.kind === "function-value") return callFn(conFn, [round, proArgs]);
            return { side: 'con', point: String(conFn), strength: 0.5 };
          },
        });
        return result.winner;
      }
      if (op === "debate-score") {
        // (debate-score proposition pro-fn con-fn) → { pro: number; con: number }
        const [proposition, proFn, conFn] = args;
        const result = globalDebater.debate({
          proposition: String(proposition),
          pro: (round: number, conArgs: Argument[]) => {
            if (typeof proFn === "function") return proFn(round, conArgs);
            if ((proFn as any)?.kind === "function-value") return callFn(proFn, [round, conArgs]);
            return { side: 'pro', point: String(proFn), strength: 0.5 };
          },
          con: (round: number, proArgs: Argument[]) => {
            if (typeof conFn === "function") return conFn(round, proArgs);
            if ((conFn as any)?.kind === "function-value") return callFn(conFn, [round, proArgs]);
            return { side: 'con', point: String(conFn), strength: 0.5 };
          },
        });
        return { pro: result.proScore, con: result.conScore };
      }
      if (op === "debate-conclusion") {
        // (debate-conclusion proposition pro-fn con-fn) → conclusion string
        const [proposition, proFn, conFn] = args;
        const result = globalDebater.debate({
          proposition: String(proposition),
          pro: (round: number, conArgs: Argument[]) => {
            if (typeof proFn === "function") return proFn(round, conArgs);
            if ((proFn as any)?.kind === "function-value") return callFn(proFn, [round, conArgs]);
            return { side: 'pro', point: String(proFn), strength: 0.5 };
          },
          con: (round: number, proArgs: Argument[]) => {
            if (typeof conFn === "function") return conFn(round, proArgs);
            if ((conFn as any)?.kind === "function-value") return callFn(conFn, [round, proArgs]);
            return { side: 'con', point: String(conFn), strength: 0.5 };
          },
        });
        return result.conclusion;
      }

      // Phase 114: Checkpoint — AI 추론 세이브포인트 저장/복원
      if (op === "cp-save") {
        // (cp-save "name" state)
        const [name, state] = args;
        globalCheckpoint.save(String(name), state);
        return null;
      }
      if (op === "cp-restore") {
        // (cp-restore "name") → 최신 state 또는 null
        const [name] = args;
        return globalCheckpoint.restore(String(name));
      }
      if (op === "cp-branch") {
        // (cp-branch "name" state fn) → 성공 시 결과, 실패 시 복원된 state
        // fn: function-value (인라인 fn), string (함수이름), 또는 JS function
        const [name, state, fn] = args;
        const result = globalCheckpoint.branch(String(name), state, (s: any) => {
          if (typeof fn === "function") return fn(s);
          if (typeof fn === "string") return callUser(fn, [s]);
          if ((fn as any)?.kind === "function-value" || (fn as any)?.kind === "async-function-value") {
            return callFnVal(fn, [s]);
          }
          // fn이 함수 정의 객체(params+body)인 경우
          if ((fn as any)?.params && (fn as any)?.body) return callFnVal({ kind: "function-value", ...(fn as any) }, [s]);
          throw new Error(`cp-branch: fn must be callable, got ${typeof fn} ${(fn as any)?.kind ?? ""}`);
        });
        if (result.success) return result.result;
        return result.restored;
      }
      if (op === "cp-drop") {
        // (cp-drop "name") → boolean
        const [name] = args;
        return globalCheckpoint.drop(String(name));
      }
      if (op === "cp-list") {
        // (cp-list) → 이름 목록 (배열)
        return globalCheckpoint.list();
      }
      if (op === "cp-versions") {
        // (cp-versions "name") → 버전 수 (number)
        const [name] = args;
        return globalCheckpoint.versions(String(name));
      }

      // Phase 115: Meta-Reason — AI 추론 방법 자동 선택
      if (op === "meta-reason") {
        // (meta-reason "problem") → 선택된 전략 이름 문자열
        const problem = String(args[0] ?? "");
        const result = globalMetaReasoner.analyze(problem);
        return result.selected;
      }
      if (op === "meta-reason-scores") {
        // (meta-reason-scores "problem") → 전략별 점수 맵 [{strategy, score, reason}]
        const problem = String(args[0] ?? "");
        const result = globalMetaReasoner.analyze(problem);
        // Map으로 변환: { COT: 0.9, TOT: 0.4, ... }
        const scoreMap: Record<string, number> = {};
        for (const s of result.scores) {
          scoreMap[s.strategy] = s.score;
        }
        return scoreMap;
      }
      if (op === "meta-reason-rationale") {
        // (meta-reason-rationale "problem") → 선택 이유 문자열
        const problem = String(args[0] ?? "");
        const result = globalMetaReasoner.analyze(problem);
        return result.rationale;
      }

      // Phase 116: Belief System — AI 신념 + 베이즈 업데이트
      if (op === "belief-set") {
        // (belief-set "claim" confidence) → null
        const [claim, confidence] = args;
        globalBeliefs.set(String(claim), Number(confidence));
        return null;
      }
      if (op === "belief-get") {
        // (belief-get "claim") → confidence 숫자 또는 null
        const [claim] = args;
        return globalBeliefs.get(String(claim));
      }
      if (op === "belief-update") {
        // (belief-update "claim" evidence) → 업데이트된 confidence
        const [claim, evidence] = args;
        return globalBeliefs.update(String(claim), Number(evidence));
      }
      if (op === "belief-negate") {
        // (belief-negate "claim") → 약화된 confidence
        const [claim] = args;
        return globalBeliefs.negate(String(claim));
      }
      if (op === "belief-list") {
        // (belief-list) → 신념 리스트 배열
        return globalBeliefs.list();
      }
      if (op === "belief-certain") {
        // (belief-certain threshold) → 임계값 이상 신념들
        const threshold = args.length > 0 ? Number(args[0]) : 0.8;
        return globalBeliefs.certain(threshold);
      }
      if (op === "belief-strongest") {
        // (belief-strongest) → 가장 강한 신념의 claim 문자열 또는 null
        const b = globalBeliefs.strongest();
        return b ? b.claim : null;
      }
      if (op === "belief-forget") {
        // (belief-forget "claim") → boolean
        const [claim] = args;
        return globalBeliefs.forget(String(claim));
      }
      if (op === "belief-size") {
        // (belief-size) → 신념 개수
        return globalBeliefs.size();
      }

      // Phase 117: Analogy — 유사 패턴 추론
      if (op === "analogy-store") {
        // (analogy-store "description" solution tags?) → 패턴 저장, id 반환
        const [desc, solution, tagsRaw] = args;
        const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];
        const p = globalAnalogy.store(String(desc), solution, tags);
        return p.id;
      }
      if (op === "analogy-find") {
        // (analogy-find "problem" topK?) → 유사 패턴 description 리스트
        const [problem, topK] = args;
        const results = globalAnalogy.find(String(problem), topK != null ? Number(topK) : 3);
        return results.map(p => p.description);
      }
      if (op === "analogy-best") {
        // (analogy-best "problem") → 가장 유사한 패턴의 solution, 없으면 null
        const [problem] = args;
        const p = globalAnalogy.best(String(problem));
        return p ? p.solution : null;
      }
      if (op === "analogy-by-tag") {
        // (analogy-by-tag "tag") → 태그별 패턴 description 리스트
        const [tag] = args;
        const results = globalAnalogy.byTag(String(tag));
        return results.map(p => p.description);
      }
      if (op === "analogy-popular") {
        // (analogy-popular n?) → 자주 쓰인 패턴 description 리스트
        const [n] = args;
        const results = globalAnalogy.popular(n != null ? Number(n) : 3);
        return results.map(p => p.description);
      }
      if (op === "analogy-size") {
        // (analogy-size) → 저장된 패턴 수
        return globalAnalogy.size();
      }
      if (op === "analogy-all") {
        // (analogy-all) → 전체 패턴 description 리스트
        return globalAnalogy.all().map(p => p.description);
      }

      // Phase 118: Critique Agent — 자기 출력 비판
      if (op === "critique") {
        // (critique output) → approved? boolean (defaultFinders 사용)
        const [output] = args;
        const result = globalCritique.run(output, { finders: defaultFinders });
        return result.approved;
      }
      if (op === "critique-points") {
        // (critique-points output) → 문제점 리스트 (descriptions)
        const [output] = args;
        const result = globalCritique.run(output, { finders: defaultFinders });
        return result.points.map(p => p.description);
      }
      if (op === "critique-risk") {
        // (critique-risk output) → 위험도 숫자
        const [output] = args;
        const result = globalCritique.run(output, { finders: defaultFinders });
        return result.overallRisk;
      }
      if (op === "critique-summary") {
        // (critique-summary output) → 요약 문자열
        const [output] = args;
        const result = globalCritique.run(output, { finders: defaultFinders });
        return result.summary;
      }

      // Phase 119: Compose-Reason — 추론 블록 파이프라인 조합기
      if (op === "compose-reason") {
        // (compose-reason steps-list input) → 최종 출력값
        // steps-list: [[name fn], ...] 또는 [[name fn condition], ...]
        const [stepsList, input] = args;
        if (!Array.isArray(stepsList)) return input;
        const steps: ReasonStep[] = stepsList.map((s: any) => {
          if (!Array.isArray(s)) return { name: String(s), fn: (x: any) => x };
          const [name, fn, condition] = s;
          const step: ReasonStep = {
            name: String(name),
            fn: typeof fn === "function" ? fn : (x: any) => x,
          };
          if (typeof condition === "function") step.condition = condition;
          return step;
        });
        const result = globalComposer.compose(steps, input);
        return result.output;
      }
      if (op === "compose-history") {
        // (compose-history steps-list input) → 단계별 이름 리스트
        const [stepsList, input] = args;
        if (!Array.isArray(stepsList)) return [];
        const steps: ReasonStep[] = stepsList.map((s: any) => {
          if (!Array.isArray(s)) return { name: String(s), fn: (x: any) => x };
          const [name, fn, condition] = s;
          const step: ReasonStep = {
            name: String(name),
            fn: typeof fn === "function" ? fn : (x: any) => x,
          };
          if (typeof condition === "function") step.condition = condition;
          return step;
        });
        const result = globalComposer.compose(steps, input);
        return result.history.map(h => h.name);
      }
      if (op === "compose-steps") {
        // (compose-steps steps-list input) → 실행된 단계 수
        const [stepsList, input] = args;
        if (!Array.isArray(stepsList)) return 0;
        const steps: ReasonStep[] = stepsList.map((s: any) => {
          if (!Array.isArray(s)) return { name: String(s), fn: (x: any) => x };
          const [name, fn, condition] = s;
          const step: ReasonStep = {
            name: String(name),
            fn: typeof fn === "function" ? fn : (x: any) => x,
          };
          if (typeof condition === "function") step.condition = condition;
          return step;
        });
        const result = globalComposer.compose(steps, input);
        return result.steps;
      }

      // Phase 120: Cognitive Architecture — 인지 아키텍처 통합
      if (op === "cognition-solve") {
        // (cognition-solve "problem" solver-fn) → { strategy, output, approved, risk }
        const [problem, solverFn] = args;
        const result = globalCognition.solve(String(problem), (strategy: string, prob: string) => {
          if (typeof solverFn === "function") return solverFn(strategy, prob);
          if ((solverFn as any)?.kind === "function-value") return callFn(solverFn, [strategy, prob]);
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
        const s = globalCognition.stats();
        return new Map([
          ["beliefs", s.beliefs],
          ["analogies", s.analogies],
          ["checkpoints", s.checkpoints]
        ]);
      }
      if (op === "cognition-meta") {
        // (cognition-meta "problem") → 전략 문자열
        const [problem] = args;
        const result = globalCognition.meta.analyze(String(problem));
        return result.selected;
      }
      if (op === "cognition-believe") {
        // (cognition-believe "claim" confidence) → void
        const [claim, confidence] = args;
        globalCognition.beliefs.set(String(claim), Number(confidence));
        return null;
      }
      if (op === "cognition-recall") {
        // (cognition-recall "pattern") → 유사 패턴 solution or null
        const [pattern] = args;
        const p = globalCognition.analogies.best(String(pattern));
        return p ? p.solution : null;
      }

      // Phase 121: Consensus — 여러 에이전트 합의
      // votes-list 형식: [[agentId answer confidence], ...]
      {
        function parseVotes(raw: any): AgentVote<any>[] {
          if (!Array.isArray(raw)) return [];
          return raw.map((item: any) => {
            if (Array.isArray(item)) {
              return { agentId: String(item[0]), answer: item[1], confidence: Number(item[2]) };
            }
            return item as AgentVote<any>;
          });
        }
        if (op === "consensus-majority") {
          // (consensus-majority votes-list) → answer
          const votes = parseVotes(args[0]);
          const result = globalConsensus.majority(votes);
          return result.answer;
        }
        if (op === "consensus-weighted") {
          // (consensus-weighted votes-list) → 숫자
          const votes = parseVotes(args[0]) as AgentVote<number>[];
          const result = globalConsensus.weighted(votes);
          return result.answer;
        }
        if (op === "consensus-threshold") {
          // (consensus-threshold votes-list threshold) → answer or null
          const votes = parseVotes(args[0]);
          const threshold = args[1] !== undefined ? Number(args[1]) : 0.7;
          const result = globalConsensus.threshold(votes, threshold);
          return result ? result.answer : null;
        }
        if (op === "consensus-agreement") {
          // (consensus-agreement votes-list) → agreement 숫자
          const votes = parseVotes(args[0]);
          return globalConsensus.agreement(votes);
        }
      }

      // Phase 123: VOTE — 에이전트 투표 결정
      // ballots 형식: [[voterId [choice1 choice2 ...] {scores}], ...]
      {
        function parseBallots(raw: any): Ballot[] {
          if (!Array.isArray(raw)) return [];
          return raw.map((item: any) => {
            if (Array.isArray(item)) {
              const voterId = String(item[0]);
              const choices = Array.isArray(item[1]) ? item[1].map(String) : [];
              const scores = item[2] && typeof item[2] === "object" && !Array.isArray(item[2]) ? item[2] as Record<string, number> : undefined;
              return { voterId, choices, scores };
            }
            return item as Ballot;
          });
        }
        function parseCandidates(raw: any): string[] {
          if (Array.isArray(raw)) return raw.map(String);
          return [];
        }
        if (op === "vote-plurality") {
          const ballots = parseBallots(args[0]);
          const candidates = parseCandidates(args[1]);
          const result = globalVoting.plurality(ballots, candidates);
          return result.winner;
        }
        if (op === "vote-approval") {
          const ballots = parseBallots(args[0]);
          const candidates = parseCandidates(args[1]);
          const result = globalVoting.approval(ballots, candidates);
          return result.winner;
        }
        if (op === "vote-score") {
          const ballots = parseBallots(args[0]);
          const candidates = parseCandidates(args[1]);
          const result = globalVoting.score(ballots, candidates);
          return result.winner;
        }
        if (op === "vote-tally") {
          const ballots = parseBallots(args[0]);
          const candidates = parseCandidates(args[1]);
          const t = globalVoting.tally(ballots, candidates);
          return new Map(Object.entries(t));
        }
      }

      // Phase 124: Negotiate — 에이전트 협상 블록
      if (op === "negotiate") {
        // (negotiate positions-list) → agreed? boolean
        const [raw] = args;
        if (!Array.isArray(raw)) return false;
        const positions: NegotiationPosition[] = raw.map((p: any) => {
          if (Array.isArray(p)) {
            return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
          }
          return p as NegotiationPosition;
        });
        const result = globalNegotiator.negotiate(positions);
        return result.agreed;
      }
      if (op === "negotiate-value") {
        // (negotiate-value positions-list) → 합의 값 or null
        const [raw] = args;
        if (!Array.isArray(raw)) return null;
        const positions: NegotiationPosition[] = raw.map((p: any) => {
          if (Array.isArray(p)) {
            return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
          }
          return p as NegotiationPosition;
        });
        const result = globalNegotiator.negotiate(positions);
        return result.agreed ? (result.value ?? null) : null;
      }
      if (op === "negotiate-rounds") {
        // (negotiate-rounds positions-list) → 라운드 수
        const [raw] = args;
        if (!Array.isArray(raw)) return 0;
        const positions: NegotiationPosition[] = raw.map((p: any) => {
          if (Array.isArray(p)) {
            return { agentId: String(p[0]), offer: Number(p[1]), minAccept: Number(p[2]), maxOffer: Number(p[3]), flexibility: Number(p[4]) };
          }
          return p as NegotiationPosition;
        });
        const result = globalNegotiator.negotiate(positions);
        return result.rounds.length;
      }

      // Phase 125: Swarm Intelligence — PSO 기반 군집 지능
      if (op === "swarm-optimize") {
        // (swarm-optimize fn particles iterations) → bestPosition
        const [fnArg, nArg, iterArg] = args;
        const objective = typeof fnArg === "function"
          ? fnArg
          : (x: number) => callFnVal(fnArg, [x]);
        const result = globalSwarm.optimize({
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
          : (x: number) => callFnVal(fnArg, [x]);
        const result = globalSwarm.optimize({
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
          : (x: number) => callFnVal(fnArg, [x]);
        const result = globalSwarm.optimize({ objective });
        return result.converged;
      }

      // Phase 129: Compete — 에이전트 경쟁 최선 선택
      if (op === "compete-register") {
        // (compete-register id solve-fn) → void
        const [id, solveFn] = args;
        const competitor: Competitor = {
          id: String(id),
          solve: (problem: any) => callFn(solveFn, [problem]),
        };
        globalCompetition.register(competitor);
        return null;
      }
      if (op === "compete") {
        // (compete problem eval-fn) → winner agentId
        const [problem, evalFn] = args;
        const evaluate = (output: any) => Number(callFn(evalFn, [output]));
        const result = globalCompetition.run(problem, evaluate);
        return result.winner?.agentId ?? null;
      }
      if (op === "compete-score") {
        // (compete-score problem eval-fn) → winner score
        const [problem, evalFn] = args;
        const evaluate = (output: any) => Number(callFn(evalFn, [output]));
        const result = globalCompetition.run(problem, evaluate);
        return result.winner?.score ?? null;
      }
      if (op === "compete-all") {
        // (compete-all problem eval-fn) → 전체 순위 리스트 [[agentId score rank] ...]
        const [problem, evalFn] = args;
        const evaluate = (output: any) => Number(callFn(evalFn, [output]));
        const result = globalCompetition.run(problem, evaluate);
        return result.allResults.map(r => [r.agentId, r.score, r.rank]);
      }
      if (op === "compete-list") {
        // (compete-list) → 등록된 경쟁자 목록
        return globalCompetition.list();
      }

      // Phase 127: PEER-REVIEW — 에이전트 간 피어 리뷰
      if (op === "peer-review-add") {
        // (peer-review-add "id" review-fn) → void
        const [idArg, fnArg] = args;
        const reviewerId = String(idArg);
        const reviewer: Reviewer = {
          id: reviewerId,
          review: (output: any) => {
            const raw = callFnVal(fnArg, [output]);
            if (raw && typeof raw === "object") {
              return {
                reviewerId,
                aspect: String(raw.aspect ?? "quality"),
                score: Number(raw.score ?? 0.5),
                comment: String(raw.comment ?? ""),
                suggestion: raw.suggestion !== undefined ? String(raw.suggestion) : undefined,
              } as ReviewComment;
            }
            return { reviewerId, aspect: "quality", score: 0.5, comment: String(raw ?? "") };
          },
        };
        globalPeerReview.addReviewer(reviewer);
        return null;
      }
      if (op === "peer-review") {
        // (peer-review "targetId" output) → approved? boolean
        const [targetId, output] = args;
        const result = globalPeerReview.review(String(targetId), output);
        return result.approved;
      }
      if (op === "peer-review-score") {
        // (peer-review-score "targetId" output) → averageScore
        const [targetId, output] = args;
        const result = globalPeerReview.review(String(targetId), output);
        return result.averageScore;
      }
      if (op === "peer-review-comments") {
        // (peer-review-comments "targetId" output) → comments list
        const [targetId, output] = args;
        const result = globalPeerReview.review(String(targetId), output);
        return result.comments;
      }
      if (op === "peer-review-list") {
        // (peer-review-list) → reviewer ids
        return globalPeerReview.list();
      }

            // (export sym1 sym2 ...) — self-hosting 파일 호환
      if (op === "export") return null;
      // (call $fn arg...) — FL stdlib 고차 함수용
      if (op === "call" && args.length >= 1) {
        const fnRef = ev(args[0]);
        const callArgs = args.slice(1);
        if (typeof fnRef === "string") return callUser(fnRef, callArgs);
        if (typeof fnRef === "function" || (fnRef as any)?.kind === "function-value") return callFn(fnRef, callArgs);
        return null;
      }
      // Phase 59: callUserFunction을 통해 FunctionNotFoundError(유사 함수 힌트 포함) 발생
      return callUser(op, args);
    }
  }
}
