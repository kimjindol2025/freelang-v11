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
    case "map":
      if (typeof args[0] === "function") {
        return (args[1] || []).map(args[0]);
      }
      return args;

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
      if (!Array.isArray(args[0])) throw new Error(`reduce expects array as first argument`);
      let accumulator = args[1];
      const reduceFn = args[2];
      for (const item of args[0]) {
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
    case "filter":
      if (!Array.isArray(args[0]) || typeof args[1] !== "function") return args[0] || [];
      return args[0].filter(args[1]);
    case "find":
      if (Array.isArray(args[0])) {
        if (typeof args[1] === "function") return args[0].find(args[1]) || null;
        return args[0].indexOf(args[1]);
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
