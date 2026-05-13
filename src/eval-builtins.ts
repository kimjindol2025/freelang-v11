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
import { FLRuntimeError, ErrorCodes } from "./errors"; // Phase C: strict 모드

// Phase 후속: list/map 깊은 동등성 (T77 palindrome에서 발견된 한계 해결)
function flDeepEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!flDeepEq(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!flDeepEq(a[k], b[k])) return false;
    return true;
  }
  return false;
}

// Phase J: 에러 메시지용 FL 타입명 반환 헬퍼
function flTypeOf(v: any): string {
  if (v === null || v === undefined) return "nil";
  if (Array.isArray(v)) return "array";
  if (v instanceof Map) return "map";
  if (typeof v === "object" && (v.kind === "function-value" || v.kind === "closure" || v.kind === "builtin-fn")) return "function";
  if (typeof v === "object") return "map";
  return typeof v; // "number" | "string" | "boolean" | "function"
}

// Phase L1.5: Module Cache Layer (비활성화)
// NOTE: Global cache causes issues with multiple interpreter instances
// Each interpreter should manage its own module cache to avoid cross-interpreter conflicts
// TODO: Move MODULE_CACHE to per-interpreter context
const MODULE_CACHE_DISABLED = false; // per-interpreter __loadCache 사용 (watch 모드 자동 우회)
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
import { AgentChain, ChainAgent, ChainResult, ChainLink } from "./chain-agents"; // Phase 128: Chain-Agents
import { globalHub, MultiAgentHub } from "./multi-agent-hub"; // Phase 130: Multi-Agent Hub
import { globalOrchestrator, Orchestrator, OrchestrateTask } from "./orchestrate"; // Phase 126: Orchestrate
import { EvolutionEngine, EvolutionConfig, evolveNumbers, evolveStrings } from "./evolve"; // Phase 131: EVOLVE
import { Mutator, globalMutator, mutateNumbers as _mutateNumbers, mutateString as _mutateString, selectBest, MutationConfig, MutationType } from "./mutate"; // Phase 132: Mutate
import { Crossover, globalCrossover, crossoverNumbers as _crossoverNumbers, crossoverStrings as _crossoverStrings } from "./crossover"; // Phase 133: Crossover
import { FitnessEvaluator, globalFitness, fitnessScore, rankItems, FitnessConfig } from "./fitness"; // Phase 134: FITNESS
import { GenerationLoop, GenerationConfig, GenerationStats, GenerationResult, runGeneration } from "./generation"; // Phase 135: GENERATION
import { Pruner, globalPruner, keepBest as _keepBest, removeWeak as _removeWeak, PruneResult } from "./prune"; // Phase 136: PRUNE
import { SelfBenchmark, globalBenchmark, bench as _bench, benchCompare as _benchCompare, BenchmarkResult, ComparisonResult, BenchmarkSuite } from "./benchmark-self"; // Phase 138: BENCHMARK-SELF
import { SelfRefactorer, globalRefactorer, RefactorSuggestion, RefactorResult } from "./refactor-self"; // Phase 137: REFACTOR-SELF
import { SelfVersioning, globalVersioning, Snapshot, RollbackResult } from "./version-self"; // Phase 139: VERSION-SELF
import { SelfEvolutionHub, globalSelfEvolution, EvolutionCycleConfig, EvolutionCycleResult, SelfEvolutionReport } from "./self-evolution-hub"; // Phase 140: SELF-EVOLUTION HUB
import { AlignmentSystem, globalAlignment, Goal, Value, Action } from "./align"; // Phase 146: ALIGN
import { globalEthics, EthicsChecker, EthicsViolation, EthicsCheckResult, EthicsPrinciple, EthicsFramework } from "./ethics-check"; // Phase 147: ETHICS-CHECK
import { CuriosityEngine, globalCuriosity, KnowledgeGap, ExplorationResult, CuriosityState } from "./curiosity"; // Phase 148: CURIOSITY
import { WisdomEngine, globalWisdom, Experience, Heuristic, WisdomJudgment } from "./wisdom"; // Phase 149: WISDOM
import { CausalGraph, globalCausal, CausalNode, CausalEdge, CausalChain, CausalExplanation, whyCaused } from "./causal"; // Phase 142: CAUSAL
import { globalExplainer, DecisionExplanation, FeatureImportance, LocalExplanation } from "./explain"; // Phase 145: EXPLAIN
import { globalWorldModel } from "./world-model"; // Phase 141: WORLD-MODEL
import { globalCounterfactual, CounterfactualReasoner, Scenario } from "./counterfactual"; // Phase 143: COUNTERFACTUAL
import { globalPredictor } from "./predict"; // Phase 144: PREDICT
import { FreeLangV9, freelangV9, FREELANG_V9_MANIFEST } from "./freelang-v9-complete"; // Phase 150: COMPLETE
import { evalRefactorSelf, evalAlign, evalPredict_PHASE144, evalCuriosity, evalEthicsCheck, evalCounterfactual, evalWisdom, evalExplain_PHASE145, evalWorldModel141 } from "./eval-builtins-ai";

// ── FL 파서 접근 ─────────────────────────────────────────────────────────
// fl-parse: FL 소스 문자열 → AST 배열 (셀프 호스팅용)
import { lex as _flLex } from "./lexer";
import { parse as _flParse } from "./parser";

// ── Native FL Interpreter Helpers ─────────────────────────────────────────
// fl-interp 네이티브 빌트인용 헬퍼. TS 스택 오버플로우 없이 FL 코드 평가.

function flEnvGet(env: any, name: string): any {
  let e = env;
  while (e !== null && e !== undefined) {
    const vars = e.vars;
    if (Array.isArray(vars)) {
      for (let i = 0; i < vars.length; i++) {
        const pair = vars[i];
        if (Array.isArray(pair) && pair[0] === name) return pair[1];
      }
    }
    e = e.parent;
  }
  return null;
}

function flEnvBind(env: any, name: string, val: any): any {
  return { vars: [[name, val], ...(env.vars || [])], parent: env.parent };
}

function flBlockItems(block: any): any[] {
  if (!block) return [];
  if (block.kind === "block" && block.type === "Array") {
    if (block.fields instanceof Map) return block.fields.get("items") ?? [];
    if (block.fields && Array.isArray(block.fields.items)) return block.fields.items;
    return block.items ?? [];
  }
  if (Array.isArray(block.items)) return block.items;
  if (Array.isArray(block)) return block;
  return [];
}

function flGetParamNames(paramsNode: any): string[] {
  const items = flBlockItems(paramsNode);
  const names: string[] = [];
  for (const p of items) {
    if (p.kind === "literal" && p.value === "&") break;
    if (p.kind === "variable") names.push(p.name);
    else if (p.kind === "literal") names.push(String(p.value));
  }
  return names;
}

function flExecOpNative(op: string, vals: any[]): any {
  const v0 = vals[0], v1 = vals[1], v2 = vals[2];
  switch (normalizedOp) {
    case "+": {
      const badIdx = vals.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (badIdx >= 0) {
        const actual = flTypeOf(vals[badIdx]);
        const hint = actual === "nil" ? `(nil? 값인지 확인 후 기본값을 사용하세요)` : `(str-to-num 등으로 변환하세요)`;
        throw new Error(`[E_TYPE_MISMATCH] +: 인자 ${badIdx + 1}번에 ${actual} 전달됨 — number 필요 ${hint}`);
      }
      return vals.reduce((a: number, b: number) => a + b, 0);
    }
    case "-": {
      const badIdx = vals.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (badIdx >= 0) {
        const actual = flTypeOf(vals[badIdx]);
        const hint = actual === "nil" ? `(nil? 확인 후 기본값 사용)` : `(str-to-num 변환 확인)`;
        throw new Error(`[E_TYPE_MISMATCH] -: 인자 ${badIdx + 1}번에 ${actual} 전달됨 — number 필요 ${hint}`);
      }
      return vals.length === 1 ? -v0 : vals.reduce((a: number, b: number) => a - b);
    }
    case "*": {
      const badIdx = vals.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (badIdx >= 0) {
        const actual = flTypeOf(vals[badIdx]);
        const hint = actual === "nil" ? `(nil? 확인 후 기본값 사용)` : `(str-to-num 변환 확인)`;
        throw new Error(`[E_TYPE_MISMATCH] *: 인자 ${badIdx + 1}번에 ${actual} 전달됨 — number 필요 ${hint}`);
      }
      return vals.reduce((a: number, b: number) => a * b, 1);
    }
    case "/": {
      const badIdx = vals.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (badIdx >= 0) {
        const actual = flTypeOf(vals[badIdx]);
        const hint = actual === "nil" ? `(nil? 확인 후 기본값 사용)` : `(str-to-num 변환 확인)`;
        throw new Error(`[E_TYPE_MISMATCH] /: 인자 ${badIdx + 1}번에 ${actual} 전달됨 — number 필요 ${hint}`);
      }
      return vals.length === 1 ? 1 / v0 : vals.reduce((a: number, b: number) => a / b);
    }
    case "%": return v0 % v1;
    case "=": {
      const n0 = v0 === null || v0 === undefined;
      const n1 = v1 === null || v1 === undefined;
      if (n0 && n1) return true;
      if (n0 || n1) return false;
      return v0 === v1;
    }
    case "!=": case "not=": return v0 !== v1;
    case "<": return v0 < v1;
    case ">": return v0 > v1;
    case "<=": return v0 <= v1;
    case ">=": return v0 >= v1;
    case "not": return !v0;
    case "nil?": case "null?": return v0 === null || v0 === undefined;
    case "empty?": {
      if (v0 === null || v0 === undefined) return true;
      if (typeof v0 === "string") return v0.length === 0;
      if (Array.isArray(v0)) return v0.length === 0;
      if (typeof v0 === "object") return Object.keys(v0).length === 0;
      return false;
    }
    case "has-key?": {
      if (v0 === null || v0 === undefined || typeof v0 !== "object" || Array.isArray(v0)) return false;
      const k = typeof v1 === "string" && v1.startsWith(":") ? v1.slice(1) : v1;
      return Object.prototype.hasOwnProperty.call(v0, k);
    }
    case "nil-or-empty?": return v0 === null || v0 === undefined || (v0 && v0.length === 0);
    case "true?": return v0 === true;
    case "false?": return v0 === false;
    case "and": return !!(v0 && v1);
    case "or": {
      // Lisp 표준: nil/false만 falsy. 0/""/[]/{} 는 truthy
      const flFalsy = (v: any) => v === null || v === undefined || v === false;
      if (!flFalsy(v0)) return v0;
      if (!flFalsy(v1)) return v1;
      return v1; // 마지막 값 반환 (모두 falsy인 경우)
    }
    case "length": return Array.isArray(v0) ? v0.length : typeof v0 === "string" ? v0.length : 0;
    case "get": {
      // v11.2 규칙 (get obj key):
      //   - key가 :name (keyword) → obj["name"] (콜론 제거 후)
      //   - key가 "name" (string) → obj["name"] (그대로)
      //   - 둘 다 동일 결과. 사용자 편의대로 선택 가능.
      //   - key가 keyword AST 노드면 name 필드 추출.
      // Phase C: FL_STRICT=1이면 nil 접근을 명시적 에러로 throw
      if ((v0 === null || v0 === undefined) && process.env.FL_STRICT === "1") {
        throw new FLRuntimeError(
          ErrorCodes.TYPE_NIL,
          `(get nil ${typeof v1 === "string" ? '"' + v1 + '"' : String(v1)}) — cannot access key on nil. Use (get-or coll key default).`,
          { fn: "get", arg: 0, expected: "non-nil", got: "nil" }
        );
      }
      let k: any = v1;
      if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;
      const _def = v2 !== undefined ? v2 : null;
      if (Array.isArray(v0)) return v0[k as any] !== undefined ? v0[k as any] : _def;
      if (v0 instanceof Map) return v0.has(String(k).replace(/^:/, "")) ? v0.get(String(k).replace(/^:/, "")) : _def;
      if (v0 !== null && typeof v0 === "object") {
        const normalized = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (v0[normalized] !== undefined) return v0[normalized];
        if (typeof k === "string" && v0[k] !== undefined) return v0[k];
        return _def;
      }
      return _def;
    }
    case "get-in": {
      // (get-in obj [k1 k2 k3]) → (get (get (get obj k1) k2) k3)
      // (get-in obj [k1 k2] default) → default if any step is nil
      if (!Array.isArray(v1)) throw new Error(`get-in: 두 번째 인자는 키 배열이어야 합니다`);
      const defaultVal = v2 !== undefined ? v2 : null;
      let cur: any = v0;
      for (const k of v1) {
        if (cur === null || cur === undefined) return defaultVal;
        const key = typeof k === "string" && k.startsWith(":") ? k.slice(1) : k;
        if (Array.isArray(cur)) cur = cur[key] !== undefined ? cur[key] : null;
        else if (cur !== null && typeof cur === "object") cur = cur[key] !== undefined ? cur[key] : null;
        else return defaultVal;
      }
      return cur !== undefined ? cur : defaultVal;
    }
    case "append": return Array.isArray(v0) && Array.isArray(v1) ? [...v0, ...v1] : Array.isArray(v0) ? [...v0, v1] : [v0, v1];
    case "slice": return Array.isArray(v0) ? v0.slice(v1, v2) : typeof v0 === "string" ? v0.slice(v1, v2) : [];
    case "str": case "concat": return vals.map((v: any) => {
      if (v === null || v === undefined) return "null";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      // plain object 또는 Array → JSON.stringify (#97 해결)
      // Map / function-value / closure 는 toDisplay 유지
      const isPlainObj = typeof v === "object" && !Array.isArray(v)
        && !(v instanceof Map)
        && v?.kind !== "function-value"
        && v?.kind !== "closure";
      if (Array.isArray(v) || isPlainObj) {
        try { return JSON.stringify(v); } catch { return toDisplay(v); }
      }
      return toDisplay(v);
    }).join("");
    case "str-to-num": { const n = parseFloat(String(v0)); return isNaN(n) ? null : n; }
    case "num-to-str": return String(v0 ?? "");
    case "replace": return typeof v0 === "string" ? v0.split(String(v1)).join(String(v2)) : v0;
    case "type-of": {
      if (v0 === null || v0 === undefined) return "nil";
      if (Array.isArray(v0)) return "array";
      if (v0 instanceof Map || (typeof v0 === "object" && v0 !== null && !Array.isArray(v0) && typeof v0 !== "function")) return "map";
      if (typeof v0 === "function" || v0?.kind === "function-value" || v0?.kind === "closure" || v0?.kind === "builtin-fn") return "function";
      return typeof v0; // "number", "string", "boolean"
    }
    case "print": process.stdout.write(vals.map((v: any) => toDisplay(v)).join("")); return null;
    case "println": process.stdout.write(vals.map((v: any) => v === null ? "null" : String(v)).join(" ") + "\n"); return null;

    case "substring": return typeof v0 === "string" ? v0.slice(Number(v1), v2 !== undefined ? Number(v2) : undefined) : "";
    case "char-at": return typeof v0 === "string" ? (v0[Number(v1)] ?? "") : "";
    case "index-of": return typeof v0 === "string" && typeof v1 === "string" ? v0.indexOf(v1) : -1;
    case "split": return typeof v0 === "string" ? v0.split(String(v1 ?? "")) : [];
    case "trim": return typeof v0 === "string" ? v0.trim() : "";
    case "upper-case": return typeof v0 === "string" ? v0.toUpperCase() : v0;
    case "lower-case": return typeof v0 === "string" ? v0.toLowerCase() : v0;
    case "strlen": return typeof v0 === "string" ? v0.length : 0;
    case "includes?": case "includes-item": return typeof v0 === "string" ? v0.includes(String(v1)) : Array.isArray(v0) ? v0.includes(v1) : false;
    case "starts-with?": return typeof v0 === "string" ? v0.startsWith(String(v1)) : false;
    case "ends-with?": return typeof v0 === "string" ? v0.endsWith(String(v1)) : false;
    case "empty?": { if (v0 === null || v0 === undefined) return true; if (typeof v0 === "string") return v0.length === 0; if (Array.isArray(v0)) return v0.length === 0; if (typeof v0 === "object") return Object.keys(v0).length === 0; return false; }
    case "first": return Array.isArray(v0) ? (v0[0] !== undefined ? v0[0] : null) : null;
    case "second": return Array.isArray(v0) ? (v0[1] !== undefined ? v0[1] : null) : null;
    case "last": return Array.isArray(v0) && v0.length > 0 ? v0[v0.length - 1] : null;
    case "rest": return Array.isArray(v0) ? v0.slice(1) : [];
    case "nth": return Array.isArray(v0) && args[1] !== undefined ? (v0[Number(args[1])] !== undefined ? v0[Number(args[1])] : null) : null;
    case "not=": return args[0] !== args[1];
    // Phase C: nil-safe wrapper들 — default 값 반환 (Phase A의 E_TYPE_NIL 회피)
    case "get-or": {
      // (get-or coll key default) — coll이 nil이거나 key가 없으면 default 반환
      let k: any = v1;
      if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;
      if (v0 === null || v0 === undefined) return v2 !== undefined ? v2 : null;
      if (Array.isArray(v0)) return v0[k as any] !== undefined ? v0[k as any] : (v2 !== undefined ? v2 : null);
      if (v0 instanceof Map) { const r = v0.get(String(k).replace(/^:/, "")); return r === undefined ? (v2 !== undefined ? v2 : null) : r; }
      if (typeof v0 === "object") {
        const normalized = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (v0[normalized] !== undefined) return v0[normalized];
        if (typeof k === "string" && v0[k] !== undefined) return v0[k];
        return v2 !== undefined ? v2 : null;
      }
      return v2 !== undefined ? v2 : null;
    }
    case "first-or": case "first_or":
      // (first-or coll default)
      return Array.isArray(v0) && v0.length > 0 && v0[0] !== undefined ? v0[0] : (v1 !== undefined ? v1 : null);
    case "last-or": case "last_or":
      return Array.isArray(v0) && v0.length > 0 ? v0[v0.length - 1] : (v1 !== undefined ? v1 : null);
    case "cons": return [v0, ...(Array.isArray(v1) ? v1 : [v1])];
    case "reverse": return Array.isArray(v0) ? [...v0].reverse() : [];
    case "sort": return Array.isArray(v0) ? [...v0].sort((a: any, b: any) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))) : v0;
    case "keys": return v0 instanceof Map ? Array.from(v0.keys()) : (v0 && typeof v0 === "object" && !Array.isArray(v0) ? Object.keys(v0) : []);
    case "values": return v0 instanceof Map ? Array.from(v0.values()) : (v0 && typeof v0 === "object" && !Array.isArray(v0) ? Object.values(v0) : []);
    case "map-entries": case "map_entries": return v0 instanceof Map ? [...v0.entries()] : (v0 && typeof v0 === "object" && !Array.isArray(v0) ? Object.entries(v0) : []);
    case "floor": return Math.floor(v0);
    case "ceil": return Math.ceil(v0);
    case "round": return Math.round(v0);
    case "math-abs": case "math_abs":
    case "abs": return Math.abs(v0);
    case "max": return Math.max(...vals.filter((v: any) => typeof v === "number"));
    case "min": return Math.min(...vals.filter((v: any) => typeof v === "number"));
    case "pow": return Math.pow(v0, v1);
    case "math-sqrt": case "math_sqrt":
    case "sqrt": return Math.sqrt(v0);
    case "mod": return v0 % v1;
    case "closure?": return v0 !== null && v0 !== undefined && typeof v0 === "object" && v0.kind === "closure";
    case "block-items": return flBlockItems(v0);
    case "read-file": try { return require("fs").readFileSync(String(v0), "utf-8"); } catch { return null; }
    case "write-file": try { require("fs").writeFileSync(String(v0), String(v1 ?? "")); return true; } catch { return false; }
    case "file-exists?": try { return require("fs").existsSync(String(v0)); } catch { return false; }
    // ── 셀프 호스팅 native builtins (native fl-interp 내부에서 호출 가능) ──
    case "fl-interp": return flInterpNative(v0, v1);
    case "lex": try { return _flLex(String(v0 ?? "")); } catch { return []; }
    case "parse": try { return _flParse(Array.isArray(v0) ? v0 : []); } catch { return []; }
    case "fl-parse": try { return _flParse(_flLex(String(v0 ?? ""))); } catch { return []; }
    case "fl-fix-env": {
      // ⚠️ 뮤테이션: closure-env 직접 할당 — 함수형 아님!
      // fl-load-funcs가 클로저를 만들 때 env가 미완성이라 closure-env가 틀림.
      // 전체 로드 후 이걸 호출해서 모든 클로저를 최종 env로 패치함 (상호재귀 지원).
      // 이 순서 없으면 fact(5) 같은 자기재귀도 못 찾음.
      const fenv = v0;
      if (!fenv || !Array.isArray(fenv.vars)) return fenv;
      for (const pair of fenv.vars) {
        if (Array.isArray(pair) && pair[1] && typeof pair[1] === "object" && pair[1].kind === "closure")
          pair[1]["closure-env"] = fenv;
      }
      return fenv;
    }
    case "fl-env-get": return flEnvGet(v0, String(v1 ?? ""));
    case "fl-exec-op": return flExecOpNative(String(v0 ?? ""), Array.isArray(v1) ? v1 : []);
    case "fl-special-op?": {
      const sop = String(v0 ?? "");
      const specials = ["if","let","do","begin","fn","and","or","not","null?","match","call","export","define","set!"];
      return specials.includes(sop) ? sop : null;
    }
    // ── Phase L1: 모듈 시스템 + 파일 I/O ──
    case "load": {
      const filePath = String(v0 ?? "");
      const fs = require("fs");
      const path = require("path");
      try {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        const src = fs.readFileSync(resolvedPath, "utf-8");
        // Use lex and parse builtins that are already available
        const { lex } = require("./lexer");
        const { parse } = require("./parser");
        const tokens = lex(src, resolvedPath);
        const ast = parse(tokens);
        // Track call stack for module load
        if ((interp as any).callStack) {
          (interp as any).callStack.push({ fn: `(load "${filePath}")`, line: expr.line });
        }
        try {
          // Evaluate each top-level form in current interpreter context
          for (const node of ast) {
            interp.eval(node);
          }
        } finally {
          if ((interp as any).callStack) {
            (interp as any).callStack.pop();
          }
        }
        return null;
      } catch (e: any) {
        throw new Error(`load failed: '${filePath}': ${e.message}`);
      }
    }

    case "file-mkdir": case "file_mkdir": {
      const dirPath = String(v0 ?? "");
      const fs = require("fs");
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
    case "file-append": case "file_append": {
      const filePath = String(v0 ?? "");
      const content = String(v1 ?? "");
      const fs = require("fs");
      try {
        fs.appendFileSync(filePath, content);
        return true;
      } catch {
        return false;
      }
    }
    case "http-get": case "http_get": {
      // (http-get url) → {:status code :body string :headers map}
      const url = String(v0 ?? "");
      try {
        const { execSync } = require("child_process");
        const { writeFileSync, unlinkSync } = require("fs");
        const { randomUUID } = require("crypto");
        const tmpFile = `/tmp/fl-http-${randomUUID()}.js`;
        const nodeScript = `process.env.FL_URL=${JSON.stringify(url)};
const u=require('url').parse(process.env.FL_URL);
const mod=u.protocol==='https:'?require('https'):require('http');
const chunks=[];
const req=mod.request({hostname:u.hostname,port:u.port||undefined,path:u.path||'/',method:'GET'},res=>{
  res.on('data',d=>chunks.push(d));
  res.on('end',()=>{process.stdout.write(JSON.stringify({s:res.statusCode,b:Buffer.concat(chunks).toString()}))});
});
req.on('error',e=>process.stdout.write(JSON.stringify({s:0,b:'',e:e.message})));
req.setTimeout(10000,()=>{req.destroy();process.stdout.write(JSON.stringify({s:0,b:'',e:'timeout'}))});
req.end();`;
        writeFileSync(tmpFile, nodeScript, "utf-8");
        const result = execSync(`node ${tmpFile}`, { encoding: "utf-8", timeout: 15000 });
        try { unlinkSync(tmpFile); } catch {}
        const parsed = JSON.parse(result);
        return { status: parsed.s || 0, body: parsed.b || "", headers: {} };
      } catch (e: any) {
        return { status: 0, body: "", headers: {}, error: e.message };
      }
    }
    // atom: 변경 가능한 참조 컨테이너 (전역 상태 관리용)
    case "atom": {
      const ref = { value: v0 !== undefined ? v0 : null };
      return ref;
    }
    case "deref": {
      if (v0 && typeof v0 === "object" && "value" in v0) return v0.value;
      return v0;
    }
    case "reset!": {
      if (v0 && typeof v0 === "object" && "value" in v0) { v0.value = v1; return v1; }
      return v1;
    }
    case "swap!": {
      // (swap! atom-ref fn ...extra-args)
      if (v0 && typeof v0 === "object" && "value" in v0 && v1) {
        const extraArgs = args.slice(2);
        const newVal = flApplyNative(v1, [v0.value, ...extraArgs]);
        v0.value = newVal;
        return newVal;
      }
      return null;
    }
    default: return null;
  }
}

const FL_SPECIAL_FORMS = new Set(["if","let","do","begin","fn","and","or","not","null?","match","call","export","define","set!"]);

function flApplyNative(closure: any, vals: any[]): any {
  if (!closure || closure.kind !== "closure") return null;
  const params: string[] = closure.params || [];
  const closureEnv = closure["closure-env"] ?? { vars: [], parent: null };
  let callEnv: any = { vars: [], parent: closureEnv };
  for (let i = 0; i < params.length; i++) {
    callEnv = flEnvBind(callEnv, params[i], i < vals.length ? vals[i] : null);
  }
  const body: any[] = closure.body || [];
  let result: any = null;
  for (const node of body) {
    result = flInterpNative(node, callEnv);
  }
  return result;
}

function flInterpNative(node: any, env: any): any {
  if (node === null || node === undefined) return null;
  const kind = node.kind;
  if (kind === "literal") return node.value;
  if (kind === "variable") return flEnvGet(env, node.name);
  if (kind === "array") {
    const items: any[] = node.items || [];
    return items.map((item: any) => flInterpNative(item, env));
  }
  if (kind === "block") {
    if (node.type === "Array") {
      const items = flBlockItems(node);
      return items.map((item: any) => flInterpNative(item, env));
    }
    if (node.type === "Map") {
      // 맵 리터럴: {:key1 val1 :key2 val2} → JS 오브젝트
      // ⚠️ node.fields가 JS Map 인스턴스여야 함 — 아니면 조용히 {} 반환 (데이터 손실)
      // make-closure 같은 FL 함수가 맵 리터럴 반환할 때 이 경로 탐
      const result: Record<string, any> = {};
      if (node.fields instanceof Map) {
        for (const [key, valNode] of node.fields) {
          result[key] = flInterpNative(valNode, env);
        }
      }
      return result;
    }
    if (node.type === "FUNC") {
      const fields = node.fields;
      let paramsNode: any = null, bodyNode: any = null;
      // ⚠️ 이중 구조 지원: 파서 버전에 따라 Map 또는 plain object로 올 수 있음
      // Map이면 fields.get(), plain이면 fields.params 직접 접근
      if (fields instanceof Map) {
        paramsNode = fields.get("params");
        bodyNode = fields.get("body");
      } else if (fields) {
        paramsNode = fields.params;
        bodyNode = fields.body;
      }
      const names = flGetParamNames(paramsNode);
      return { kind: "closure", params: names, body: [bodyNode], "closure-env": env };
    }
    return null;
  }
  if (kind === "sexpr") {
    return flInterpSexpr(node.op, node.args || [], env);
  }
  return null;
}

function flInterpSexpr(op: any, rawArgs: any[], env: any): any {
  // op가 문자열이 아니면 AST 노드 — 평가 후 클로저로 호출
  if (typeof op !== "string") {
    const fn = flInterpNative(op, env);
    const vals = rawArgs.map((a: any) => flInterpNative(a, env));
    return fn && fn.kind === "closure" ? flApplyNative(fn, vals) : null;
  }

  if (!FL_SPECIAL_FORMS.has(op)) {
    // 일반 함수 호출: 먼저 FL env에서 찾고, 없으면 내장 연산
    const vals = rawArgs.map((a: any) => flInterpNative(a, env));
    const fn = flEnvGet(env, op);
    if (fn && fn.kind === "closure") return flApplyNative(fn, vals);
    return flExecOpNative(op, vals);
  }

  switch (normalizedOp) {
    case "if": {
      const cond = flInterpNative(rawArgs[0], env);
      if (cond) return flInterpNative(rawArgs[1], env);
      return rawArgs.length >= 3 ? flInterpNative(rawArgs[2], env) : null;
    }
    case "let": {
      const pairs = flBlockItems(rawArgs[0]);
      let newEnv = env;
      for (const pair of pairs) {
        const pairItems = flBlockItems(pair);
        if (pairItems.length < 2) continue;
        const nameNode = pairItems[0];
        const name = nameNode.kind === "variable" ? nameNode.name : String(nameNode.value ?? "");
        const val = flInterpNative(pairItems[1], newEnv);
        newEnv = flEnvBind(newEnv, name, val);
      }
      let result: any = null;
      for (let i = 1; i < rawArgs.length; i++) result = flInterpNative(rawArgs[i], newEnv);
      return result;
    }
    case "fn": {
      const names = flGetParamNames(rawArgs[0]);
      return { kind: "closure", params: names, body: rawArgs.slice(1), "closure-env": env };
    }
    case "do": case "begin": {
      let result: any = null;
      for (const node of rawArgs) result = flInterpNative(node, env);
      return result;
    }
    case "and": {
      for (const arg of rawArgs) { if (!flInterpNative(arg, env)) return false; }
      return true;
    }
    case "or": {
      // Lisp 표준: nil/false만 falsy, 0/""/[]/{} 는 truthy
      const flFalsy2 = (v: any) => v === null || v === undefined || v === false;
      let lastVal2: any = null;
      for (const arg of rawArgs) {
        lastVal2 = flInterpNative(arg, env);
        if (!flFalsy2(lastVal2)) return lastVal2;
      }
      return lastVal2;
    }
    case "not": return !flInterpNative(rawArgs[0], env);
    case "null?": { const v = flInterpNative(rawArgs[0], env); return v === null || v === undefined; }
    case "call": {
      // (call $fn arg1 arg2...) 또는 (call $fn [args])
      const fnRaw = flInterpNative(rawArgs[0], env);
      const fn = (fnRaw && fnRaw.kind === "closure") ? fnRaw
                 : (typeof fnRaw === "string" ? flEnvGet(env, fnRaw) : null);
      if (!fn || fn.kind !== "closure") return null;
      let vals: any[];
      if (rawArgs.length === 2) {
        const a = flInterpNative(rawArgs[1], env);
        vals = Array.isArray(a) ? a : [a];
      } else {
        vals = rawArgs.slice(1).map((a: any) => flInterpNative(a, env));
      }
      return flApplyNative(fn, vals);
    }
    case "match": {
      const subject = flInterpNative(rawArgs[0], env);
      for (let i = 1; i < rawArgs.length; i++) {
        const clause = rawArgs[i];
        const patOp = clause.op;
        const resultExpr = (clause.args || [])[0];
        let matched = false;
        if (patOp === "_") matched = true;
        else if (patOp === "null") matched = subject === null || subject === undefined;
        else if (patOp === "true") matched = subject === true;
        else if (patOp === "false") matched = subject === false;
        else { const n = parseFloat(patOp); matched = subject === patOp || (!isNaN(n) && subject === n); }
        if (matched) return flInterpNative(resultExpr, env);
      }
      return null;
    }
    case "export": return null;
    case "define": case "set!": {
      if (rawArgs.length >= 2) {
        const nameNode = rawArgs[0];
        const name = nameNode.kind === "variable" ? nameNode.name : String(nameNode.value ?? "");
        // ⚠️ 이름 추출 규칙: variable 노드면 .name ($x → "x"), literal이면 .value (x → "x")
        // 즉 (define $x 42)와 (define x 42) 둘 다 "x"로 바인딩됨
        // 하지만 참조는 $x로 해야 함 — x(심볼)로 참조하면 문자열 "x" 반환 (알려진 함정!)
        const val = flInterpNative(rawArgs[1], env);
        // ⚠️ 뮤테이션: env.vars 직접 수정 — 함수형 아님!
        // fl-run-nodes가 같은 env 참조를 다음 노드에도 재사용하므로 바인딩이 전파됨
        // env-bind처럼 새 객체 만들면 다음 노드에 안 보임 (참조가 끊어지기 때문)
        if (env && Array.isArray(env.vars)) env.vars.unshift([name, val]);
        return val;
      }
      return null;
    }
    default: return null;
  }
}

// ── End Native FL Interpreter Helpers ────────────────────────────────────────

// ── cache-* 내장 구현 (LRU + TTL) ────────────────────────────────────────────
interface CacheEntry { value: any; expires: number | null; }
interface CacheHandle {
  kind: "cache";
  maxSize: number;
  map: Map<string, CacheEntry>;
  hits: number;
  misses: number;
}
function makeCacheHandle(maxSize: number): CacheHandle {
  return { kind: "cache", maxSize, map: new Map(), hits: 0, misses: 0 };
}
function cacheEvict(ch: CacheHandle): void {
  if (ch.map.size >= ch.maxSize) {
    // LRU: Map 삽입 순서 기반 — 첫 번째 키 제거
    const firstKey = ch.map.keys().next().value;
    if (firstKey !== undefined) ch.map.delete(firstKey);
  }
}
// 글로벌 싱글톤 캐시 (핸들 없는 API용 — cache_set/cache_get/cache_has/cache_del)
const _globalCache = makeCacheHandle(10000);
// ─────────────────────────────────────────────────────────────────────────────

export function evalBuiltin(interp: Interpreter, op: string, args: any[], expr: SExpr): any {
  // AI-First #3: snake_case ↔ kebab-case 양방향 허용
  // 내부 구현은 kebab-case 기준 — snake_case 입력 시 자동 변환
  const normalizedOp = op.replace(/_/g, '-');

  // Phase X-2: Deprecation 경고 (snake_case 호출 시) — FL_NO_DEPRECATION_WARN=1 로 끄기 가능
  if (normalizedOp !== op && op !== 'server_start' && !process.env.FL_NO_DEPRECATION_WARN) {
    console.warn(`⚠️  [FreeLang v11.5.1] ${op}은 deprecated입니다. ${normalizedOp}을 사용하세요.`);
  }

  // interp.eval은 public이어야 하므로 (실제로는 public)
  const ev = (node: any) => (interp as any).eval(node);
  const callFn = (fn: any, a: any[]) => (interp as any).callFunction(fn, a);
  const callUser = (name: string, a: any[]) => (interp as any).callUserFunction(name, a);
  const callFnVal = (fn: any, a: any[]) => {
    if (typeof fn === "string") {
      try { return (interp as any).callUserFunction(fn, a); } catch (e: any) {
        if (e?.message?.includes("찾을 수 없습니다") || e?.message?.includes("not found") || e?.message?.includes("Function not found")) {
          return evalBuiltin(interp, fn, a, expr);
        }
        throw e;
      }
    }
    if (fn?.kind === "builtin-fn") return evalBuiltin(interp, fn.name, a, expr);
    if (fn?.kind === "function-value" || fn?.kind === "async-function-value") return (interp as any).callFunctionValue(fn, a);
    if (typeof fn?.body === "function") return fn.body(...a);  // native stdlib (inc, dec 등)
    if (fn?.params !== undefined && fn?.body !== undefined) return (interp as any).callUserFunction(fn.name ?? fn.id, a);
    if (typeof fn === "function") return fn(...a);
    return (interp as any).callFunctionValue(fn, a);
  };
  const toDisplay = (val: any) => (interp as any).toDisplayString(val);

  switch (normalizedOp) {
    // atom: 변경 가능한 참조 컨테이너
    case "atom": {
      return { value: args[0] !== undefined ? args[0] : null };
    }
    case "deref": {
      const ref = args[0];
      if (ref && typeof ref === "object" && "value" in ref) return ref.value;
      return ref;
    }
    case "reset!": {
      const ref = args[0];
      if (ref && typeof ref === "object" && "value" in ref) { ref.value = args[1]; return args[1]; }
      return args[1];
    }
    case "swap!": {
      const ref = args[0]; const fn = args[1]; const extra = args.slice(2);
      if (ref && typeof ref === "object" && "value" in ref && fn) {
        const newVal = callFnVal(fn, [ref.value, ...extra]);
        ref.value = newVal;
        return newVal;
      }
      return null;
    }

    // Phase L1: Module system

    case "load": {
      const filePath = String(args[0] ?? "");
      const nsPrefix = args[1] != null ? String(args[1]) : null; // L-07: optional namespace
      const fs = require("fs");
      const path = require("path");
      try {
        const resolvedPath = path.resolve(process.cwd(), filePath);

        // 모듈 캐시 — watch 모드(-w)가 아닐 때 재파싱 방지
        const isWatchMode = process.argv.includes("--watch") || process.argv.includes("-w") || process.argv.includes("watch");
        if (!MODULE_CACHE_DISABLED && !isWatchMode && !nsPrefix) {
          if (!(interp as any).__loadCache) (interp as any).__loadCache = new Set<string>();
          if ((interp as any).__loadCache.has(resolvedPath)) return null;
          (interp as any).__loadCache.add(resolvedPath);
        }

        const src = fs.readFileSync(resolvedPath, "utf-8");
        const { lex } = require("./lexer");
        const { parse } = require("./parser");
        const tokens = lex(src, resolvedPath);
        const ast = parse(tokens);

        // L-07: namespace 파라미터 있으면 로드 전 함수 목록 스냅샷
        const ctx = (interp as any).context;
        const fnsBefore: Set<string> = nsPrefix && ctx?.functions instanceof Map
          ? new Set(ctx.functions.keys())
          : new Set();

        // Evaluate module (control blocks like [FUNC] allowed)
        (interp as any).interpret(ast);

        // L-07: 새로 추가된 함수에 ns/ 접두사 별칭 등록 (수집 후 일괄 추가)
        if (nsPrefix && ctx?.functions instanceof Map) {
          const toAlias: [string, any][] = [];
          for (const [name, def] of ctx.functions.entries()) {
            if (!fnsBefore.has(name)) toAlias.push([`${nsPrefix}/${name}`, def]);
          }
          for (const [aliasName, def] of toAlias) ctx.functions.set(aliasName, def);
        }

        return null;
      } catch (e: any) {
        throw new Error(`load failed: '${filePath}': ${e.message}`);
      }
    }

    // ── v12 Hot Reload ─────────────────────────────────────────────────────────
    case "fl-reload": {
      // (fl-reload "path/to/file.fl") — 현재 인터프리터 컨텍스트에서 파일 재평가
      const frFilePath = String(args[0] ?? "");
      const frFs = require("fs");
      const frPath = require("path");
      try {
        const frResolved = frPath.resolve(process.cwd(), frFilePath);
        if ((interp as any).__loadCache) (interp as any).__loadCache.delete(frResolved);
        const frSrc = frFs.readFileSync(frResolved, "utf-8");
        const { lex: frLex } = require("./lexer");
        const { parse: frParse } = require("./parser");
        const frTokens = frLex(frSrc, frResolved);
        const frAst = frParse(frTokens);
        const frSavedPath = (interp as any).currentFilePath;
        (interp as any).currentFilePath = frResolved;
        // callFunctionValue는 fromSnapshot으로 스코프를 교체한다.
        // fl-reload는 항상 전역 스코프에 define해야 하므로 스택을 전역 전용으로 임시 교체.
        const frVars = (interp as any).context.variables;
        // 전역 Map 참조 — 최초 호출 시 저장 (top-level에서만 유효)
        if (!(interp as any).__hotReloadGlobalMap) {
          (interp as any).__hotReloadGlobalMap = frVars.stack ? frVars.stack[0] : null;
        }
        const frGlobal = (interp as any).__hotReloadGlobalMap;
        const frSavedStack = frVars.saveStack ? frVars.saveStack() : null;
        try {
          if (frGlobal && frVars.restoreStack) frVars.restoreStack([frGlobal]);
          (interp as any).interpret(frAst);
        } finally {
          // frGlobal은 interpret 중 새 define이 쓰여진 실제 Map 참조.
          // stack[0]을 frGlobal로 고정하고 나머지 클로저 스코프만 복원.
          if (frSavedStack && frVars.restoreStack) {
            frVars.restoreStack([frGlobal, ...frSavedStack.slice(1)]);
          }
          (interp as any).currentFilePath = frSavedPath;
        }
        return null;
      } catch (e: any) {
        throw new Error(`[fl-reload] '${frFilePath}': ${e.message}`);
      }
    }
    case "fl-watch": {
      // (fl-watch "path" callback-fn) or (fl-watch "path" callback-fn {:debounce 300})
      const fwPath = String(args[0] ?? "");
      const fwCb = args[1];
      const fwOpts = args[2];
      const fwDebounce: number = (fwOpts && typeof fwOpts === "object")
        ? ((fwOpts as any)[":debounce"] ?? (fwOpts as any)["debounce"] ?? 300)
        : 300;
      const fwFs = require("fs");
      const fwPathMod = require("path");
      const fwResolved = fwPathMod.resolve(process.cwd(), fwPath);
      let fwLastMtime = 0; let fwLastSize = -1;
      try { const st = fwFs.statSync(fwResolved); fwLastMtime = st.mtimeMs; fwLastSize = st.size; } catch (_e) {}
      let fwDebTimer: NodeJS.Timeout | null = null;
      const fwInterval = setInterval(() => {
        try {
          const st = fwFs.statSync(fwResolved);
          if (st.mtimeMs !== fwLastMtime || st.size !== fwLastSize) {
            fwLastMtime = st.mtimeMs; fwLastSize = st.size;
            if (fwDebTimer) clearTimeout(fwDebTimer);
            fwDebTimer = setTimeout(() => {
              fwDebTimer = null;
              try { callFnVal(fwCb, [fwResolved]); } catch (e: any) {
                process.stderr.write(`\x1b[33m[fl-watch]\x1b[0m ${e.message}\n`);
              }
            }, fwDebounce);
          }
        } catch (_e) {}
      }, 500);
      (fwInterval as any).unref?.();
      return null;
    }

    // Phase Step3: require function (module system)
    case "cli-args": {
      const args = process.argv.slice(2);
      // skip 'run' command and the script name if present
      if (args[0] === "run" || args[0] === "debug") {
        return args.slice(2);
      }
      return args;
    }
    case "shell-exec": {
      const { execSync } = require("child_process");
      const cmd = String(args[0] ?? "");
      try {
        return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      } catch (e: any) {
        return null;
      }
    }
    case "shell-exec-result": {
      // stdout + stderr + exit_code 모두 반환: {:stdout "..." :stderr "..." :exit 0 :ok true}
      const { spawnSync } = require("child_process");
      const cmd = String(args[0] ?? "");
      const res = spawnSync("sh", ["-c", cmd], { encoding: "utf-8" });
      return {
        stdout: res.stdout ?? "",
        stderr: res.stderr ?? "",
        exit: res.status ?? -1,
        ok: (res.status ?? -1) === 0,
      };
    }
    case "require": {
      const modulePath = String(args[0] ?? "");
      const fs = require("fs");
      const path = require("path");
      try {
        // Auto-add .fl extension if not present
        let filePath = modulePath;
        if (!filePath.endsWith(".fl") && !filePath.endsWith(".js")) {
          filePath = filePath + ".fl";
        }

        // Resolve path (relative to current working directory or absolute)
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        // Phase L1.5: Check module cache first (deterministic semantics)
        if (MODULE_CACHE.has(resolvedPath)) {
          return MODULE_CACHE.get(resolvedPath);
        }

        // Read and parse the module
        const src = fs.readFileSync(resolvedPath, "utf-8");
        const { lex } = require("./lexer");
        const { parse } = require("./parser");
        const tokens = lex(src, resolvedPath);
        const ast = parse(tokens);

        // Evaluate module and capture result
        const result = (interp as any).interpret(ast);

        // Cache the result for future requires of the same module
        MODULE_CACHE.set(resolvedPath, result);
        return result;
      } catch (e: any) {
        throw new Error(`require failed: '${modulePath}': ${e.message}`);
      }
    }

    // Phase TCP: TCP Socket Support (synchronous via spawnSync)
    case "net-sendrecv": {
      const host = String(args[0] ?? "localhost");
      const port = Number(args[1] ?? 27017);
      const hexData = String(args[2] ?? "");
      const timeout = Number(args[3] ?? 10000);

      const { spawnSync } = require("child_process");

      // Inline TCP script (동기식 처리, 외부 파일 불필요)
      const inlineScript = `
const net = require('net');
const req = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const { host, port, data, timeout } = req;
const buf = Buffer.from(data, 'hex');
const sock = net.createConnection({ host, port });
let chunks = [];
let done = false;

sock.on('connect', () => { sock.write(buf); });

// Frame by messageLength: MongoDB Wire Protocol messages start with 4-byte length (little-endian)
sock.on('data', c => {
  chunks.push(c);
  if (!done && chunks.length > 0) {
    const total = Buffer.concat(chunks);
    if (total.length >= 4) {
      const msgLen = total.readInt32LE(0);
      if (total.length >= msgLen) {
        done = true;
        sock.destroy();
        process.stdout.write(total.slice(0, msgLen).toString('hex'));
        process.exit(0);
      }
    }
  }
});

sock.on('end', () => {
  if (!done && chunks.length > 0) {
    process.stdout.write(Buffer.concat(chunks).toString('hex'));
  }
  process.exit(0);
});

sock.on('error', (e) => { process.exit(1); });

sock.setTimeout(timeout, () => {
  if (!done) {
    sock.destroy();
    if (chunks.length > 0) {
      process.stdout.write(Buffer.concat(chunks).toString('hex'));
    }
    process.exit(0);
  }
});
`;
      const reqJson = JSON.stringify({ host, port, data: hexData, timeout });
      try {
        const r = spawnSync(
          process.execPath,
          ['-e', inlineScript],
          { input: reqJson, timeout: timeout + 1000, encoding: 'utf-8' as any }
        );
        if (r.error || r.status !== 0) return null;
        const out = (r.stdout ?? '').trim();
        return out.length > 0 ? out : null;
      } catch (e: any) {
        return null;
      }
    }

    case "net-connect": {
      const host = String(args[0] ?? "localhost");
      const port = Number(args[1] ?? 27017);
      const timeout = Number(args[2] ?? 5000);

      const { spawnSync } = require("child_process");
      const inlineScript = `
const net = require('net');
const req = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const sock = net.createConnection({ host: req.host, port: req.port });
sock.on('connect', () => { sock.destroy(); process.stdout.write('ok'); process.exit(0); });
sock.on('error', () => { process.exit(1); });
sock.setTimeout(req.timeout, () => { sock.destroy(); process.exit(1); });
`;
      try {
        const r = spawnSync(
          process.execPath,
          ['-e', inlineScript],
          { input: JSON.stringify({ host, port, timeout }), timeout: timeout + 500, encoding: 'utf-8' as any }
        );
        if (r.error || r.status !== 0) return null;
        return `${host}:${port}`;
      } catch (e: any) {
        return null;
      }
    }

    // net-sendrecv-pool: persistent TCP connection pool via Worker Thread
    // args: host port hexData timeout
    // Returns hex response or null
    case "net-sendrecv-pool": {
      const host = String(args[0] ?? "localhost");
      const port = Number(args[1] ?? 27017);
      const hexData = String(args[2] ?? "");
      const timeout = Number(args[3] ?? 10000);

      // Lazy-initialize the net pool worker
      if (!(globalThis as any).__netPoolWorker) {
        const { Worker: NetWorker } = require("worker_threads");
        const netCtrlBuf = new SharedArrayBuffer(4);
        const netDataBuf = new SharedArrayBuffer(8 * 1024 * 1024); // 8MB
        Atomics.store(new Int32Array(netCtrlBuf), 0, 0);
        const netWorkerCode = `
const { workerData } = require('worker_threads');
const net = require('net');
const control = new Int32Array(workerData.controlBuf);
const data = Buffer.from(workerData.dataBuf);
const sockets = new Map(); // key=host:port, value=socket

function getSocket(host, port) {
  const key = host + ':' + port;
  if (sockets.has(key)) {
    const s = sockets.get(key);
    if (!s.destroyed && s.writable) return Promise.resolve(s);
    sockets.delete(key);
  }
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    sock.on('connect', () => {
      sockets.set(key, sock);
      resolve(sock);
    });
    sock.on('error', reject);
    sock.on('close', () => sockets.delete(key));
    setTimeout(() => reject(new Error('connect timeout')), 5000);
  });
}

function sendRecv(host, port, hexPayload, timeout) {
  return new Promise(async (resolve, reject) => {
    let sock;
    try { sock = await getSocket(host, port); } catch(e) { return reject(e); }
    const buf = Buffer.from(hexPayload, 'hex');
    let chunks = [];
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(null); }
    }, timeout);
    const onData = (chunk) => {
      chunks.push(chunk);
      const total = Buffer.concat(chunks);
      if (total.length >= 4) {
        const msgLen = total.readInt32LE(0);
        if (total.length >= msgLen) {
          done = true;
          clearTimeout(timer);
          sock.removeListener('data', onData);
          resolve(total.slice(0, msgLen).toString('hex'));
        }
      }
    };
    sock.on('data', onData);
    sock.write(buf);
  });
}

async function loop() {
  while (true) {
    Atomics.wait(control, 0, 0);
    const flag = Atomics.load(control, 0);
    if (flag === -1) break;
    const reqLen = data.readInt32LE(0);
    const reqStr = data.toString('utf8', 4, 4 + reqLen);
    let resp;
    try {
      const req = JSON.parse(reqStr);
      const hexResp = await sendRecv(req.host, req.port, req.data, req.timeout || 10000);
      resp = { ok: true, data: hexResp };
    } catch(e) {
      resp = { ok: false, error: e.message };
    }
    const respStr = JSON.stringify(resp);
    data.writeInt32LE(respStr.length, 0);
    data.write(respStr, 4, 'utf8');
    Atomics.store(control, 0, 2);
    Atomics.notify(control, 0);
    Atomics.wait(control, 0, 2); // wait for main thread to acknowledge
  }
}
loop().catch(e => {
  Atomics.store(control, 0, -2);
  Atomics.notify(control, 0);
});
`;
        const netWorker = new NetWorker(netWorkerCode, {
          eval: true,
          workerData: { controlBuf: netCtrlBuf, dataBuf: netDataBuf },
        });
        netWorker.on("error", (e: any) => {
          (globalThis as any).__netPoolWorker = null;
        });
        (globalThis as any).__netPoolWorker = netWorker;
        (globalThis as any).__netPoolCtrlBuf = netCtrlBuf;
        (globalThis as any).__netPoolDataBuf = netDataBuf;
      }

      const netCtrl = new Int32Array((globalThis as any).__netPoolCtrlBuf);
      const netData = Buffer.from((globalThis as any).__netPoolDataBuf);
      const reqStr = JSON.stringify({ host, port, data: hexData, timeout });
      netData.writeInt32LE(reqStr.length, 0);
      netData.write(reqStr, 4, "utf8");
      Atomics.store(netCtrl, 0, 1);
      Atomics.notify(netCtrl, 0);
      const waitResult = Atomics.wait(netCtrl, 0, 1, timeout + 2000);
      if (waitResult === "timed-out") return null;
      const respLen = netData.readInt32LE(0);
      const resp = JSON.parse(netData.toString("utf8", 4, 4 + respLen));
      Atomics.store(netCtrl, 0, 0); // acknowledge
      if (!resp.ok) return null;
      return resp.data;
    }

    // Arithmetic
    case "+": {
      const bi = args.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (bi >= 0) { const t = flTypeOf(args[bi]); const h = t === "nil" ? "(nil? 확인 후 기본값 사용)" : "(str-to-num 변환 확인)"; throw new Error(`[E_TYPE_MISMATCH] +: 인자 ${bi + 1}번에 ${t} 전달됨 — number 필요 ${h}`); }
      return args.reduce((a: number, b: number) => a + b, 0);
    }
    case "-": {
      const bi = args.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (bi >= 0) { const t = flTypeOf(args[bi]); const h = t === "nil" ? "(nil? 확인 후 기본값 사용)" : "(str-to-num 변환 확인)"; throw new Error(`[E_TYPE_MISMATCH] -: 인자 ${bi + 1}번에 ${t} 전달됨 — number 필요 ${h}`); }
      return args.length === 1 ? -args[0] : args.reduce((a: number, b: number) => a - b);
    }
    case "*": {
      const bi = args.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (bi >= 0) { const t = flTypeOf(args[bi]); const h = t === "nil" ? "(nil? 확인 후 기본값 사용)" : "(str-to-num 변환 확인)"; throw new Error(`[E_TYPE_MISMATCH] *: 인자 ${bi + 1}번에 ${t} 전달됨 — number 필요 ${h}`); }
      return args.reduce((a: number, b: number) => a * b, 1);
    }
    case "/": {
      const bi = args.findIndex((v: any) => v === null || v === undefined || typeof v !== "number");
      if (bi >= 0) { const t = flTypeOf(args[bi]); const h = t === "nil" ? "(nil? 확인 후 기본값 사용)" : "(str-to-num 변환 확인)"; throw new Error(`[E_TYPE_MISMATCH] /: 인자 ${bi + 1}번에 ${t} 전달됨 — number 필요 ${h}`); }
      return args.length === 1 ? 1 / args[0] : args.reduce((a: number, b: number) => a / b);
    }
    case "%":
      return args[0] % args[1];

    // Comparison
    case "=":
      // Phase 후속: list/map 자동 deep-equal (T77 palindrome 발견)
      return flDeepEq(args[0], args[1]);
    case "<":
      return args[0] < args[1];
    case ">":
      return args[0] > args[1];
    case "<=":
      return args[0] <= args[1];
    case ">=":
      return args[0] >= args[1];
    case "!=": case "not=":
      return args[0] !== args[1];

    // Logical (evaluated versions — unevaluated short-circuit is in eval-special-forms.ts)
    case "and":
      return args.every((a: any) => a);
    case "or": {
      // Lisp 표준: nil/false만 falsy
      const flFalsy3 = (v: any) => v === null || v === undefined || v === false;
      for (const a of args) { if (!flFalsy3(a)) return a; }
      return args.length > 0 ? args[args.length - 1] : null;
    }
    case "not":
      return !args[0];

    // Output
    case "print":
      process.stdout.write(args.map((a: any) => toDisplay(a)).join(" "));
      return null;
    case "println":
    case "echo":
      process.stdout.write(args.map((a: any) => toDisplay(a)).join(" ") + "\n");
      return null;
    case "tap": case "dbg": {
      // (tap x) → 값을 stderr에 출력하고 그대로 반환 (디버깅용)
      const label = args.length > 1 ? String(args[0]) + " " : "";
      const val = args.length > 1 ? args[1] : args[0];
      process.stderr.write("[tap] " + label + toDisplay(val) + "\n");
      return val;
    }
    case "print-err":
      process.stderr.write(args.map((a: any) => toDisplay(a)).join(" ") + "\n");
      return null;
    case "str":
      return args.map((a: any) => {
        if (a === null || a === undefined) return "null";
        if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") return String(a);
        const isPlainObj = typeof a === "object" && !Array.isArray(a)
          && !(a instanceof Map)
          && a?.kind !== "function-value"
          && a?.kind !== "closure";
        if (Array.isArray(a) || isPlainObj) {
          try { return JSON.stringify(a); } catch { return toDisplay(a); }
        }
        return toDisplay(a);
      }).join("");
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
    case "length": case "count":
      return Array.isArray(args[0]) ? args[0].length
        : typeof args[0] === "string" ? args[0].length
        : (args[0] !== null && typeof args[0] === "object") ? Object.keys(args[0]).length
        : 0;

    // Phase MongoDB: to-hex (number → 2-digit hex string)
    case "to-hex": {
      const n = Math.floor(Number(args[0])) & 0xFF;
      return n.toString(16).padStart(2, '0');
    }

    // Phase MongoDB: bson-encode-native (FreeLang map → BSON hex)
    case "bson-encode-native": {
      const int32ToHex = (n: number): string => {
        const b0 = n & 0xFF;
        const b1 = (n >> 8) & 0xFF;
        const b2 = (n >> 16) & 0xFF;
        const b3 = (n >> 24) & 0xFF;
        return b0.toString(16).padStart(2, '0') +
               b1.toString(16).padStart(2, '0') +
               b2.toString(16).padStart(2, '0') +
               b3.toString(16).padStart(2, '0');
      };
      const int64ToHex = (n: number): string => {
        // JS numbers are float64, safe up to 2^53
        const lo = n >>> 0;
        const hi = Math.floor(n / 0x100000000) >>> 0;
        return int32ToHex(lo) + int32ToHex(hi);
      };
      const float64ToHex = (n: number): string => {
        const buf = Buffer.allocUnsafe(8);
        buf.writeDoubleLE(n, 0);
        return buf.toString('hex');
      };
      const stringToHex = (s: string): string => {
        let hex = '';
        for (let i = 0; i < s.length; i++) {
          hex += s.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
      };

      const encodeDoc = (d: any): string => {
        if (!d || typeof d !== 'object') return int32ToHex(5) + '00'; // empty doc
        let elements = '';
        const entries = Array.isArray(d)
          ? d.map((v: any, i: number) => [String(i), v])
          : Object.entries(d);
        for (const [key, val] of entries) {
          const k = stringToHex(key) + '00';
          if (Array.isArray(val)) {
            const subdoc = encodeDoc(val);
            elements += '04' + k + subdoc;
          } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            const subdoc = encodeDoc(val);
            elements += '03' + k + subdoc;
          } else if (typeof val === 'number' && Number.isInteger(val) && val >= -2147483648 && val <= 2147483647) {
            elements += '10' + k + int32ToHex(val);
          } else if (typeof val === 'number') {
            elements += '01' + k + float64ToHex(val);
          } else if (typeof val === 'string') {
            const strBytes = Buffer.from(val, 'utf-8');
            const len = strBytes.length + 1;
            elements += '02' + k + int32ToHex(len) + strBytes.toString('hex') + '00';
          } else if (typeof val === 'boolean') {
            elements += '08' + k + (val ? '01' : '00');
          } else if (val === null || val === undefined) {
            elements += '0a' + k;
          }
        }
        const size = 4 + elements.length / 2 + 1;
        return int32ToHex(size) + elements + '00';
      };

      const doc = args[0];
      if (!doc || typeof doc !== 'object') return "0c000000107069696e6700010000000000";
      return encodeDoc(doc);
    }

    // Phase MongoDB: bson-decode-native (BSON hex → FreeLang map/array)
    case "bson-decode-native": {
      const hex = String(args[0] || "");
      if (hex.length < 8) return {};

      const buf = Buffer.from(hex, 'hex');

      const decodeDoc = (buf: Buffer, startOffset: number): [Record<string, any>, number] => {
        if (startOffset + 4 > buf.length) return [{}, startOffset];
        const docSize = buf.readInt32LE(startOffset);
        const endOffset = startOffset + docSize;
        const result: Record<string, any> = {};
        let offset = startOffset + 4;

        while (offset < endOffset - 1 && buf[offset] !== 0x00) {
          const elemType = buf[offset];
          offset++;

          let nameEnd = offset;
          while (nameEnd < buf.length && buf[nameEnd] !== 0x00) nameEnd++;
          const fieldName = buf.toString('utf-8', offset, nameEnd);
          offset = nameEnd + 1;

          if (elemType === 0x01) { // double
            result[fieldName] = buf.readDoubleLE(offset);
            offset += 8;
          } else if (elemType === 0x02) { // string
            const strLen = buf.readInt32LE(offset);
            offset += 4;
            result[fieldName] = buf.toString('utf-8', offset, offset + strLen - 1);
            offset += strLen;
          } else if (elemType === 0x03) { // embedded doc
            const [subdoc, newOffset] = decodeDoc(buf, offset);
            result[fieldName] = subdoc;
            offset = newOffset;
          } else if (elemType === 0x04) { // array
            const [subdoc, newOffset] = decodeDoc(buf, offset);
            result[fieldName] = Object.values(subdoc);
            offset = newOffset;
          } else if (elemType === 0x07) { // ObjectId (12 bytes)
            result[fieldName] = buf.toString('hex', offset, offset + 12);
            offset += 12;
          } else if (elemType === 0x08) { // bool
            result[fieldName] = buf[offset] !== 0;
            offset++;
          } else if (elemType === 0x09) { // datetime (int64 ms)
            result[fieldName] = buf.readBigInt64LE(offset);
            offset += 8;
          } else if (elemType === 0x0a) { // null
            result[fieldName] = null;
          } else if (elemType === 0x10) { // int32
            result[fieldName] = buf.readInt32LE(offset);
            offset += 4;
          } else if (elemType === 0x12) { // int64
            result[fieldName] = Number(buf.readBigInt64LE(offset));
            offset += 8;
          } else {
            // Unknown: skip rest of doc to avoid corruption
            break;
          }
        }
        return [result, endOffset];
      };

      const [result] = decodeDoc(buf, 0);
      return result;
    }

    // P3 (2026-04-25): 작은 함수형 stdlib — AI가 자연스럽게 짜는 패턴
    case "identity":
      return args[0];
    case "comp": {
      // (comp f g h) → (fn [x] (f (g (h x))))
      const fns = args.filter(a => a != null);
      return (...callArgs: any[]) => {
        if (fns.length === 0) return callArgs[0];
        let result = callFnVal(fns[fns.length - 1], callArgs);
        for (let i = fns.length - 2; i >= 0; i--) result = callFnVal(fns[i], [result]);
        return result;
      };
    }
    case "juxt": {
      // (juxt f g h) → (fn [x] [(f x) (g x) (h x)])
      const fns = args.filter(a => a != null);
      return (...callArgs: any[]) => fns.map(fn => callFnVal(fn, callArgs));
    }
    case "constantly": {
      // (constantly v) → (fn [...args] v) — 인자 무시하고 v 반환
      const v = args[0];
      return (..._callArgs: any[]) => v;
    }
    case "complement": {
      // (complement pred) → (fn [x] (not (pred x)))
      const pred = args[0];
      const callOne = (fn: any, callArgs: any[]) => {
        if (typeof fn === "function") return fn(...callArgs);
        if (fn?.kind === "function-value") return callFnVal(fn, callArgs);
        return null;
      };
      return (...callArgs: any[]) => !callOne(pred, callArgs);
    }

    // Array/Collection
    case "list":
      return args;
    case "first":
      return Array.isArray(args[0]) ? (args[0][0] !== undefined ? args[0][0] : null) : null;
    case "second":
      return Array.isArray(args[0]) ? (args[0][1] !== undefined ? args[0][1] : null) : null;
    case "nth":
      return Array.isArray(args[0]) ? (args[0][Number(args[1])] !== undefined ? args[0][Number(args[1])] : null) : null;
    case "rest":
      return Array.isArray(args[0]) ? args[0].slice(1) : [];
    // Phase 후속: 메인 dispatch에 alias 추가 (line 140 dispatch만 있던 함수들 통합)
    case "keys": {
      const kObj = args[0];
      if (kObj instanceof Map) return Array.from(kObj.keys());
      return kObj && typeof kObj === "object" && !Array.isArray(kObj) ? Object.keys(kObj) : [];
    }
    case "length-or-zero": case "length_or_zero": {
      const v = args[0];
      if (v === null || v === undefined) return 0;
      if (typeof v === "string") return v.length;
      if (Array.isArray(v)) return v.length;
      if (v instanceof Map) return v.size;
      if (typeof v === "object") return Object.keys(v).length;
      return 0;
    }
    case "vals":
    case "values": {
      const vObj = args[0];
      if (vObj instanceof Map) return Array.from(vObj.values());
      return vObj && typeof vObj === "object" && !Array.isArray(vObj) ? Object.values(vObj) : [];
    }
    case "upper-case":
      return typeof args[0] === "string" ? args[0].toUpperCase() : args[0];
    case "lower-case":
    case "lowercase":
    case "lower":
      return typeof args[0] === "string" ? args[0].toLowerCase() : args[0];
    case "trim":
      return typeof args[0] === "string" ? args[0].trim() : "";
    case "starts-with?":
    case "str-starts-with?":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].startsWith(args[1]) : false;
    case "ends-with?":
    case "str-ends-with?":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].endsWith(args[1]) : false;
    case "char-at":
    case "str-char-at":
      return typeof args[0] === "string" ? (args[0][Number(args[1])] ?? "") : "";
    case "math-pow":
      return Math.pow(Number(args[0]), Number(args[1]));
    case "append":
      if (Array.isArray(args[0]) && args.length === 2 && Array.isArray(args[1])) {
        return [...args[0], ...args[1]];
      }
      return [...(args[0] || []), ...args.slice(1)];
    case "reverse":
      if (Array.isArray(args[0])) return [...args[0]].reverse();
      return [];
    case "map": {
      // 인자 순서 감지: (map arr fn) → 즉시 throw (#1 해결)
      // 조건: 첫 인자 비어있지 않은 배열 + 두 번째 인자 함수
      if (Array.isArray(args[0]) && args[0].length > 0) {
        const second = args[1];
        if (second && (typeof second === "function" || second?.kind === "function-value" || second?.kind === "closure")) {
          throw new Error(`map 인자 순서 오류: (map fn arr) 형식이 올바릅니다. 현재 입력: (map arr fn)`);
        }
      }
      const mapFn = args[0];
      if (args[1] === null || args[1] === undefined) return [];
      const mapArr = Array.isArray(args[1]) ? args[1] : [];
      return mapArr.map((item: any) => callFnVal(mapFn, [item]));
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
      // 인자 순서 감지: (reduce arr init fn) → 즉시 throw (#3 해결)
      // reduce는 3인자: args[0]=fn, args[1]=init, args[2]=arr
      if (Array.isArray(args[0]) && args[0].length > 0) {
        const third = args[2];
        if (third && (typeof third === "function" || third?.kind === "function-value" || third?.kind === "closure")) {
          throw new Error(`reduce 인자 순서 오류: (reduce fn init arr) 형식이 올바릅니다. 현재 입력: (reduce arr init fn)`);
        }
      }
      // fn-first 고정: (reduce fn init arr) 또는 2인자 (reduce fn arr)
      const reduceFn = args[0];
      let accumulator: any;
      let arr: any;
      if (args.length <= 2 || args[2] === undefined) {
        // 2-arg form: (reduce fn coll) — 첫 요소를 초기값으로
        const coll = Array.isArray(args[1]) ? args[1] : [];
        if (coll.length === 0) return null;
        accumulator = coll[0];
        arr = coll.slice(1);
      } else {
        accumulator = args[1];
        arr = args[2] ?? [];
      }
      // lazy seq 지원 (범위 제한 100k)
      if (isLazySeq(arr)) {
        const REDUCE_LAZY_LIMIT = 100000;
        let cur: any = arr;
        let count = 0;
        while (cur && count < REDUCE_LAZY_LIMIT) {
          accumulator = callFn(reduceFn, [accumulator, lazyHead(cur)]);
          cur = lazyTail(cur);
          count++;
        }
        if (count >= REDUCE_LAZY_LIMIT) {
          throw new Error(`reduce: lazy seq가 ${REDUCE_LAZY_LIMIT}을 초과 (무한 시퀀스 가능성, take를 먼저 사용하세요)`);
        }
        return accumulator;
      }
      if (!Array.isArray(arr)) throw new Error(`reduce: 배열 인자가 필요합니다 (받은 타입: ${typeof arr})`);
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

    // XSS 방어
    case "html-escape": {
      const s = String(args[0] ?? "");
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    }
    case "js-escape": {
      const s = String(args[0] ?? "");
      return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'")
              .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\x00/g, "\\0");
    }

    case "h": {
      // (h :div {:class "card" :id "main"} child1 child2 ...)
      // (h :br)  (h :input {:type "text" :name "q"})
      const VOID_TAGS = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
      const escAttr = (v: string) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const escText = (v: string) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // 태그명 추출 (키워드 or 문자열)
      const tag = String(args[0] ?? "div").toLowerCase();

      // 두 번째 인자가 객체이면 attrs, 아니면 첫 번째 child
      let attrs: Record<string, any> = {};
      let childStart = 1;
      if (args[1] !== null && args[1] !== undefined && typeof args[1] === "object" && !Array.isArray(args[1])) {
        attrs = args[1];
        childStart = 2;
      }

      // attrs → HTML attribute string
      const attrStr = Object.entries(attrs)
        .filter(([, v]) => v !== null && v !== undefined && v !== false)
        .map(([k, v]) => {
          if (v === true) return ` ${k}`;           // boolean attr: disabled, checked
          return ` ${k}="${escAttr(String(v))}"`;
        })
        .join("");

      if (VOID_TAGS.has(tag)) return `<${tag}${attrStr}>`;

      // children: strings, h() results, nil 필터, 배열 flat
      const children = args.slice(childStart)
        .flat()
        .filter((c: any) => c !== null && c !== undefined && c !== false)
        .map((c: any) => {
          if (typeof c === "string") return c;       // h() 결과는 이미 escaped
          if (typeof c === "number" || typeof c === "boolean") return escText(String(c));
          return String(c ?? "");
        })
        .join("");

      return `<${tag}${attrStr}>${children}</${tag}>`;
    }

    case "cx": {
      // (cx "btn" (when active "btn-active") nil "rounded")
      // nil/false/빈 문자열 필터링 후 공백으로 join
      return args
        .flat()
        .filter((c: any) => c !== null && c !== undefined && c !== false && c !== "")
        .map((c: any) => String(c).trim())
        .filter((c: string) => c.length > 0)
        .join(" ");
    }

    case "for-html": {
      // (for-html items render-fn) → str-join(map(fn, items), "")
      if (!Array.isArray(args[0])) return "";
      return args[0].map((item: any) => {
        const result = callFnVal(args[1], [item]);
        return result !== null && result !== undefined ? String(result) : "";
      }).join("");
    }

    case "for-html-indexed": {
      // (for-html-indexed items render-fn) → fn receives [item index]
      if (!Array.isArray(args[0])) return "";
      return args[0].map((item: any, i: number) => {
        const result = callFnVal(args[1], [item, i]);
        return result !== null && result !== undefined ? String(result) : "";
      }).join("");
    }

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
      return typeof args[0] === "string" ? args[0].split(String(args[1] ?? "")) : [];
    case "error":
      throw new Error(String(args[0]));
    case "nil?":
    case "null?":
      return args[0] === null || args[0] === undefined;
    case "empty?": {
      const v = args[0];
      if (v === null || v === undefined) return true;
      if (typeof v === "string") return v.length === 0;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === "object") return Object.keys(v).length === 0;
      return false;
    }
    case "not-empty?": {
      // (not-empty? v) — empty?의 반대
      const v = args[0];
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.keys(v).length > 0;
      return true;
    }
    case "has-key?": {
      const obj = args[0], key = args[1];
      if (obj === null || obj === undefined || typeof obj !== "object" || Array.isArray(obj)) return false;
      const k = typeof key === "string" && key.startsWith(":") ? key.slice(1) : String(key ?? "");
      return Object.prototype.hasOwnProperty.call(obj, k);
    }
    case "nil-or-empty?":
      return args[0] === null || args[0] === undefined || (args[0] && args[0].length === 0);
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
    case "some?":
    case "not-nil?":
      return args[0] !== null && args[0] !== undefined;
    case "positive?":
      return typeof args[0] === "number" && args[0] > 0;
    case "negative?":
      return typeof args[0] === "number" && args[0] < 0;
    case "int?":
      return typeof args[0] === "number" && Number.isInteger(args[0]);
    case "float?":
      return typeof args[0] === "number" && !Number.isInteger(args[0]);
    case "nan?":
      return typeof args[0] === "number" && isNaN(args[0]);
    case "dir-exists?": {
      try {
        return require("fs").statSync(String(args[0])).isDirectory();
      } catch {
        return false;
      }
    }
    case "string?":
      return typeof args[0] === "string";
    case "number?":
      return typeof args[0] === "number";
    case "boolean?":
    case "bool?":
      return typeof args[0] === "boolean";
    case "list?":
    case "array?":
      return Array.isArray(args[0]);
    case "function?":
    case "fn?": {
      const fv = args[0];
      return typeof fv === "function"
        || (fv !== null && typeof fv === "object" && (fv.kind === "function-value" || fv.kind === "closure" || fv.kind === "async-function-value" || fv.kind === "builtin-fn"));
    }
    case "map?":
      return args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]);
    case "vector?": case "array?": case "list?":
      return Array.isArray(args[0]);
    case "integer?":
      return typeof args[0] === "number" && Number.isInteger(args[0]);
    case "float?":
      return typeof args[0] === "number" && !Number.isInteger(args[0]);
    case "num-to-str":
      return String(args[0]);
    case "str-to-num": { const _n = parseFloat(String(args[0])); return isNaN(_n) ? null : _n; }
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
    case "str-split": {
      if (typeof args[0] !== "string" || typeof args[1] !== "string") return [];
      const parts = args[0].split(args[1]);
      if (args[2] !== undefined) {
        const lim = Number(args[2]);
        if (lim > 0 && parts.length > lim) {
          return [...parts.slice(0, lim - 1), parts.slice(lim - 1).join(args[1])];
        }
      }
      return parts;
    }
    case "join":
    case "str-join":
      // (str-join arr sep) 또는 (str-join sep arr) 양방향 지원
      if (Array.isArray(args[0])) return args[0].join(args[1] !== undefined ? String(args[1]) : "");
      if (typeof args[0] === "string" && Array.isArray(args[1])) return args[1].join(args[0]);
      return Array.isArray(args[0]) ? args[0].join("") : "";
    case "str-format": case "format": {
      // (str-format "%s has %d items" name count) 또는 (str-format "%s has %d" [name count])
      const fmt = String(args[0] ?? "");
      const fmtArgs = (args.length === 2 && Array.isArray(args[1])) ? args[1] : args.slice(1);
      let i = 0;
      return fmt.replace(/%([+\-0 ]*)(\d*)\.?(\d*)([sdifoexX%])/g, (_m, flags, width, prec, t) => {
        if (t === "%") return "%";
        const v = fmtArgs[i++];
        const w = width ? parseInt(width) : 0;
        const hasPlus = flags.includes("+");
        const hasZero = flags.includes("0");
        const hasLeft = flags.includes("-");
        const pad = (s: string, positive: boolean) => {
          if (w <= s.length) return s;
          if (hasLeft) return s.padEnd(w, " ");
          if (hasZero) {
            const sign = s[0] === "+" || s[0] === "-" ? s[0] : "";
            return sign + (sign ? s.slice(1) : s).padStart(w - sign.length, "0");
          }
          return s.padStart(w, " ");
        };
        if (t === "d" || t === "i") {
          const n = Math.trunc(Number(v));
          let s = String(Math.abs(n));
          if (n < 0) s = "-" + s;
          else if (hasPlus) s = "+" + s;
          return pad(s, n >= 0);
        }
        if (t === "f") {
          const precision = prec !== "" ? parseInt(prec) : 6;
          const n = Number(v);
          let s = Math.abs(n).toFixed(precision);
          if (n < 0) s = "-" + s;
          else if (hasPlus) s = "+" + s;
          return pad(s, n >= 0);
        }
        if (t === "e" || t === "E") {
          const precision = prec !== "" ? parseInt(prec) : 6;
          let s = Number(v).toExponential(precision);
          if (t === "E") s = s.toUpperCase();
          return w > s.length ? (hasLeft ? s.padEnd(w) : s.padStart(w)) : s;
        }
        if (t === "s") {
          let s = v === null || v === undefined ? "null" : String(v);
          if (w > s.length) s = hasLeft ? s.padEnd(w, " ") : s.padStart(w, " ");
          return s;
        }
        if (t === "o") return JSON.stringify(v);
        if (t === "x") return Math.trunc(Number(v)).toString(16);
        if (t === "X") return Math.trunc(Number(v)).toString(16).toUpperCase();
        return String(v);
      });
    }
    case "str-blank?":
      return args[0] === null || args[0] === undefined || (typeof args[0] === "string" && args[0].trim() === "");
    case "trim":
    case "string_trim":
    case "str_trim":
      return typeof args[0] === "string" ? args[0].trim() : "";
    case "uppercase":
      return typeof args[0] === "string" ? args[0].toUpperCase() : "";
    case "lowercase":
      return typeof args[0] === "string" ? args[0].toLowerCase() : "";
    case "contains?":
      if (typeof args[0] === "string" && typeof args[1] === "string") return args[0].includes(args[1]);
      if (Array.isArray(args[0])) return args[0].includes(args[1]);
      if (args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
        let ck: any = args[1];
        if (ck !== null && typeof ck === "object" && (ck as any).kind === "keyword") ck = (ck as any).name;
        const ckNorm = typeof ck === "string" && ck.startsWith(":") ? ck.slice(1) : String(ck);
        return Object.prototype.hasOwnProperty.call(args[0], ckNorm)
          || Object.prototype.hasOwnProperty.call(args[0], ":" + ckNorm);
      }
      return false;
    case "starts-with?":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].startsWith(args[1]) : false;
    case "index-of":
      if (Array.isArray(args[0])) return args[0].indexOf(args[1]);
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].indexOf(args[1]) : -1;
    case "replace":
      return typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string"
        ? args[0].split(args[1]).join(args[2])
        : "";
    case "repeat": {
      // (repeat n val) → [val val val ...]  또는  (repeat str n) → str 반복 (하위호환)
      if (typeof args[0] === "number") return Array(args[0]).fill(args[1] !== undefined ? args[1] : null);
      if (typeof args[0] === "string" && typeof args[1] === "number") return args[0].repeat(args[1]);
      return [];
    }

    // Array Operations
    case "filter": {
      // 인자 순서 감지: (filter arr fn) → 즉시 throw (#2 해결)
      if (Array.isArray(args[0]) && args[0].length > 0) {
        const second = args[1];
        if (second && (typeof second === "function" || second?.kind === "function-value" || second?.kind === "closure")) {
          throw new Error(`filter 인자 순서 오류: (filter fn arr) 형식이 올바릅니다. 현재 입력: (filter arr fn)`);
        }
      }
      // fn-first 고정: (filter fn arr)
      const filterFn = args[0];
      const coll = args[1];
      if (coll === null || coll === undefined) return [];
      if (!Array.isArray(coll)) return [];
      if (filterFn === null || filterFn === undefined) return coll;
      return coll.filter((item: any) => callFnVal(filterFn, [item]));
    }
    case "find": {
      // (find arr fn-or-value) — arr-first; fn → element, value → index
      if (!Array.isArray(args[0])) return -1;
      const findTarget = args[1];
      if (typeof findTarget === "function") return args[0].find(findTarget) ?? null;
      if (findTarget && ((findTarget as any).kind === "function-value" || (findTarget as any).kind === "closure")) {
        return args[0].find((item: any) => callFnVal(findTarget, [item])) ?? null;
      }
      return args[0].indexOf(findTarget);
    }
    case "last":
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
    case "butlast":
      return Array.isArray(args[0]) && args[0].length > 1 ? args[0].slice(0, -1) : [];
    // Phase C: nil-safe wrapper들
    case "first-or": case "first_or":
      return Array.isArray(args[0]) && args[0].length > 0 && args[0][0] !== undefined
        ? args[0][0]
        : (args[1] !== undefined ? args[1] : null);
    case "last-or": case "last_or":
      return Array.isArray(args[0]) && args[0].length > 0
        ? args[0][args[0].length - 1]
        : (args[1] !== undefined ? args[1] : null);

    // ── apply: (apply fn args-array) ─────────────────────────────────
    case "apply": {
      const apFn = args[0], apArr = Array.isArray(args[args.length - 1]) ? args[args.length - 1] : [];
      const extraArgs = args.slice(1, args.length - 1);
      const allArgs = [...extraArgs, ...apArr];
      // builtin 연산자(+,-,*,/,max,min 등)는 evalBuiltin으로 직접 호출
      if (typeof apFn === "string") return evalBuiltin(interp, apFn, allArgs, expr);
      return callFnVal(apFn, allArgs);
    }

    // ── sum / product / average ───────────────────────────────────────
    case "sum": {
      const arr = Array.isArray(args[0]) ? args[0] : args;
      return arr.reduce((a: number, b: number) => a + Number(b), 0);
    }
    case "product": {
      const arr = Array.isArray(args[0]) ? args[0] : args;
      return arr.reduce((a: number, b: number) => a * Number(b), 1);
    }
    case "average": {
      const arr = Array.isArray(args[0]) ? args[0] : args;
      if (arr.length === 0) return null;
      return arr.reduce((a: number, b: number) => a + Number(b), 0) / arr.length;
    }

    // ── update: (update map key fn) ──────────────────────────────────
    case "update": {
      const uMap = args[0], uKey0 = args[1], uFn = args[2];
      let uKey = uKey0;
      if (uKey && typeof uKey === "object" && (uKey as any).kind === "keyword") uKey = (uKey as any).name;
      else if (typeof uKey === "string" && uKey.startsWith(":")) uKey = uKey.slice(1);
      const cur = uMap && typeof uMap === "object" ? uMap[uKey] ?? null : null;
      const next = callFnVal(uFn, [cur]);
      return { ...uMap, [uKey]: next };
    }

    // ── partition: (partition n arr) ─────────────────────────────────
    case "partition": {
      const n = Number(args[0]), parr = Array.isArray(args[1]) ? args[1] : [];
      const out: any[] = [];
      for (let i = 0; i < parr.length; i += n) out.push(parr.slice(i, i + n));
      return out;
    }

    // ── interpose: (interpose sep arr) ───────────────────────────────
    case "interpose": {
      const sep = args[0], iarr = Array.isArray(args[1]) ? args[1] : [];
      if (iarr.length === 0) return [];
      const result: any[] = [iarr[0]];
      for (let i = 1; i < iarr.length; i++) { result.push(sep); result.push(iarr[i]); }
      return result;
    }

    // ── keep: (keep fn arr) → non-nil results ────────────────────────
    case "keep": {
      const kfn = args[0], karr = Array.isArray(args[1]) ? args[1] : [];
      return karr.map((x: any) => callFnVal(kfn, [x])).filter((v: any) => v !== null && v !== undefined);
    }

    // ── mapcat: (mapcat fn arr) → map + flatten 1 level ──────────────
    case "mapcat": {
      const mcfn = args[0], mcarr = Array.isArray(args[1]) ? args[1] : [];
      return mcarr.flatMap((x: any) => { const r = callFnVal(mcfn, [x]); return Array.isArray(r) ? r : [r]; });
    }

    // ── count-if: (count-if fn arr) ──────────────────────────────────
    case "count-if": {
      const cifn = args[0], ciarr = Array.isArray(args[1]) ? args[1] : [];
      return ciarr.filter((x: any) => callFnVal(cifn, [x])).length;
    }

    case "find-first": {
      const fffn = args[0], ffarr = Array.isArray(args[1]) ? args[1] : [];
      const found = ffarr.find((x: any) => callFnVal(fffn, [x]));
      return found !== undefined ? found : null;
    }

    // ── max-by / min-by: (max-by fn arr) ─────────────────────────────
    case "max-by": {
      const mbfn = args[0], mbarr = Array.isArray(args[1]) ? args[1] : [];
      if (mbarr.length === 0) return null;
      // 문자열이고 배열 첫 항목이 객체면 필드 접근, 아니면 함수 호출
      const mbIsField = typeof mbfn === "string" && mbarr[0] !== null && typeof mbarr[0] === "object";
      const mbKey = mbIsField
        ? (x: any) => (x !== null && typeof x === "object") ? x[mbfn] : null
        : (x: any) => callFnVal(mbfn, [x]);
      return mbarr.reduce((best: any, x: any) => mbKey(x) > mbKey(best) ? x : best);
    }
    case "min-by": {
      const mnbfn = args[0], mnbarr = Array.isArray(args[1]) ? args[1] : [];
      if (mnbarr.length === 0) return null;
      const mnbIsField = typeof mnbfn === "string" && mnbarr[0] !== null && typeof mnbarr[0] === "object";
      const mnbKey = mnbIsField
        ? (x: any) => (x !== null && typeof x === "object") ? x[mnbfn] : null
        : (x: any) => callFnVal(mnbfn, [x]);
      return mnbarr.reduce((best: any, x: any) => mnbKey(x) < mnbKey(best) ? x : best);
    }

    // ── max-of / min-of: (max-of arr) ────────────────────────────────
    case "max-of": {
      const moarr = Array.isArray(args[0]) ? args[0] : args;
      return moarr.length === 0 ? null : Math.max(...moarr.map(Number));
    }
    case "min-of": {
      const minarr = Array.isArray(args[0]) ? args[0] : args;
      return minarr.length === 0 ? null : Math.min(...minarr.map(Number));
    }
    case "get-in": {
      // (get-in obj [k1 k2 k3]) → 중첩 맵 접근
      // (get-in obj [k1 k2] default) → 경로 중 nil이면 default 반환
      if (!Array.isArray(args[1])) throw new Error(`get-in: 두 번째 인자는 키 배열이어야 합니다`);
      const giDefault = args[2] !== undefined ? args[2] : null;
      let cur: any = args[0];
      for (const k of args[1]) {
        if (cur === null || cur === undefined) return giDefault;
        const key = typeof k === "string" && k.startsWith(":") ? k.slice(1) : k;
        if (Array.isArray(cur)) cur = cur[key] !== undefined ? cur[key] : undefined;
        else if (cur !== null && typeof cur === "object") cur = cur[key] !== undefined ? cur[key] : undefined;
        else return giDefault;
      }
      return cur !== undefined ? cur : giDefault;
    }
    case "get-or": {
      // (get-or coll key default)
      const def = args[2] !== undefined ? args[2] : null;
      let k: any = args[1];
      if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;
      if (args[0] === null || args[0] === undefined) return def;
      if (Array.isArray(args[0])) {
        const idx = typeof k === "number" ? k : Number(k);
        return Number.isFinite(idx) && args[0][idx] !== undefined ? args[0][idx] : def;
      }
      if (args[0] instanceof Map) {
        const r = args[0].get(String(k).replace(/^:/, ""));
        return r === undefined ? def : r;
      }
      if (typeof args[0] === "object") {
        const normalized = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (args[0][normalized] !== undefined) return args[0][normalized];
        if (typeof k === "string" && args[0][k] !== undefined) return args[0][k];
        return def;
      }
      return def;
    }
    case "get": {
      // v11.2: 일관된 키 규칙 — keyword/string 동일 결과
      // Phase C: FL_STRICT=1이면 nil 접근을 명시적 에러로 throw
      if ((args[0] === null || args[0] === undefined) && process.env.FL_STRICT === "1") {
        throw new FLRuntimeError(
          ErrorCodes.TYPE_NIL,
          `(get nil ${typeof args[1] === "string" ? '"' + args[1] + '"' : String(args[1])}) — cannot access key on nil. Use (get-or coll key default).`,
          { fn: "get", arg: 0, expected: "non-nil", got: "nil" }
        );
      }
      // #9: 첫 번째 인자가 map/array/string이 아닌 경우 타입 힌트
      if (args[0] !== null && args[0] !== undefined &&
          typeof args[0] !== "object" && typeof args[0] !== "string" &&
          !Array.isArray(args[0])) {
        const hint = `[E_TYPE_MISMATCH] get: 첫 번째 인자는 map, array, string이어야 합니다 (받은 값: ${typeof args[0]})\n  올바른 형식: (get map key) 또는 (get arr index)\n  예: (get {:name "kim"} "name") → "kim"`;
        if (process.env.FL_V12 === "1") throw new Error(hint);
        console.warn(`⚠️  [FreeLang] ${hint}`);
      }
      let k: any = args[1];
      if (k !== null && typeof k === "object" && (k as any).kind === "keyword") k = (k as any).name;
      const _getDef = args.length >= 3 ? args[2] : null;
      if (Array.isArray(args[0])) return typeof k === "number" ? (args[0][k] ?? _getDef) : _getDef;
      if (typeof args[0] === "string") return typeof k === "number" ? (args[0][k] ?? _getDef) : _getDef;
      if (args[0] instanceof Map) return args[0].has(String(k).replace(/^:/, "")) ? args[0].get(String(k).replace(/^:/, "")) : _getDef;
      if (args[0] !== null && typeof args[0] === "object") {
        const normalized = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (args[0][normalized] !== undefined) return args[0][normalized];
        if (typeof k === "string" && args[0][k] !== undefined) return args[0][k];
        return _getDef;
      }
      return _getDef;
    }
    case "block-items":
      // Array 블록에서 items 추출 (셀프 호스팅용)
      if (args[0] && typeof args[0] === "object" && args[0].kind === "block" && args[0].type === "Array") {
        return args[0].fields instanceof Map ? (args[0].fields.get("items") ?? []) : [];
      }
      if (Array.isArray(args[0])) return args[0];
      return [];
    case "fl-env-get": {
      // 네이티브 FL 환경 조회 — env-find 재귀 스택오버플로우 방지
      // env = {vars: [["name", val], ...], parent: env|null}
      let flenv = args[0];
      const fname = String(args[1]);
      while (flenv !== null && flenv !== undefined) {
        const vars = flenv.vars;
        if (Array.isArray(vars)) {
          for (let i = 0; i < vars.length; i++) {
            const pair = vars[i];
            if (Array.isArray(pair) && pair[0] === fname) return pair[1];
          }
        }
        flenv = flenv.parent;
      }
      return null;
    }
    case "fl-special-op?": {
      // fl-eval-sexpr 12중첩 if 대체 — op가 특수 형식인지 반환
      const sop = String(args[0]);
      const specials = ["if","let","do","begin","fn","and","or","not","null?","match","call","export","define","set!"];
      return specials.includes(sop) ? sop : null;
    }
    case "fl-exec-op": {
      // fl-eval-builtin의 29중첩 if 대체 — 네이티브 산술/비교/문자열 디스패치
      // (fl-exec-op op vals) — vals는 이미 평가된 JS 배열
      const op = String(args[0]);
      const vals: any[] = Array.isArray(args[1]) ? args[1] : [];
      const v0 = vals[0], v1 = vals[1], v2 = vals[2];
      switch (normalizedOp) {
        case "+": return vals.reduce((a: number, b: number) => a + b, 0);
        case "-": return vals.length === 1 ? -v0 : vals.reduce((a: number, b: number) => a - b);
        case "*": return vals.reduce((a: number, b: number) => a * b, 1);
        case "/": return vals.length === 1 ? 1 / v0 : vals.reduce((a: number, b: number) => a / b);
        case "%": return typeof v0 === "number" && typeof v1 === "number" ? v0 % v1 : null;
        case "=": return v0 === v1;
        case "!=": return v0 !== v1;
        case "<": return v0 < v1;
        case ">": return v0 > v1;
        case "<=": return v0 <= v1;
        case ">=": return v0 >= v1;
        case "concat": return vals.reduce((a: string, b: any) => a + String(b ?? ""), "");
        case "length": return Array.isArray(v0) ? v0.length : typeof v0 === "string" ? v0.length : 0;
        case "get":
          if (Array.isArray(v0)) return typeof v1 === "number" ? (v0[v1] ?? null) : null;
          if (typeof v0 === "string") return typeof v1 === "number" ? (v0[v1] ?? null) : null;
          if (v0 instanceof Map) return v0.get(String(v1).replace(/^:/, "")) ?? null;
          if (v0 !== null && typeof v0 === "object") return v0[String(v1).replace(/^:/, "")] ?? v0[v1] ?? null;
          return null;
        case "append": return Array.isArray(v0) && Array.isArray(v1) ? [...v0, ...v1] : Array.isArray(v0) ? [...v0, v1] : [v0, v1];
        case "slice": return Array.isArray(v0) ? v0.slice(v1, v2) : typeof v0 === "string" ? v0.slice(v1, v2) : [];
        case "num-to-str": return String(v0 ?? "");
        case "str-to-num": { const _n2 = parseFloat(String(v0)); return isNaN(_n2) ? null : _n2; }
        case "replace": return typeof v0 === "string" ? v0.split(String(v1)).join(String(v2)) : v0;
        case "str-join": return Array.isArray(v0) ? v0.join(String(v1 ?? "")) : String(v0 ?? "");
        case "null?": return v0 === null || v0 === undefined;
        case "array?": return Array.isArray(v0);
        case "string?": return typeof v0 === "string";
        case "number?": return typeof v0 === "number";
        case "read-file": try { return require("fs").readFileSync(String(v0), "utf-8"); } catch { return null; }
        case "write-file": try { require("fs").writeFileSync(String(v0), String(v1 ?? "")); return true; } catch { return false; }
        case "file-exists?": try { return require("fs").existsSync(String(v0)); } catch { return false; }
        case "file-append": try { require("fs").appendFileSync(String(v0), String(v1 ?? "")); return true; } catch { return false; }
        case "file-append-line": try { require("fs").appendFileSync(String(v0), String(v1 ?? "") + "\n"); return true; } catch { return false; }
        case "dir-list": try { return require("fs").readdirSync(String(v0)); } catch { return []; }
        default: return null;
      }
    }
    // ── 네이티브 FL 인터프리터 ─────────────────────────────────────
    // fl-interp: FL AST 노드를 native TS로 직접 평가 (스택오버플로우 방지)
    // fl-fix-env: 로드된 FL env의 모든 closure-env를 final env로 업데이트 (재귀 지원)
    case "fl-interp":
      return flInterpNative(args[0], args[1]);
    case "lex":
      try { return _flLex(String(args[0] ?? "")); } catch { return []; }
    case "parse":
      try { return _flParse(Array.isArray(args[0]) ? args[0] : []); } catch { return []; }
    case "fl-parse": {
      // FL 소스 문자열 → AST 배열 (셀프 호스팅: interpret에 넘기기용)
      try { return _flParse(_flLex(String(args[0] ?? ""))); } catch { return []; }
    }
    case "fl-fix-env": {
      // fl-load-funcs 후 모든 클로저의 closure-env를 최종 env로 업데이트
      // 이를 통해 재귀 함수가 자기 자신을 closure-env에서 찾을 수 있음
      const finalEnv = args[0];
      if (!finalEnv || !Array.isArray(finalEnv.vars)) return finalEnv;
      for (const pair of finalEnv.vars) {
        if (Array.isArray(pair) && pair[1] && typeof pair[1] === "object" && pair[1].kind === "closure") {
          pair[1]["closure-env"] = finalEnv;
        }
      }
      return finalEnv;
    }
    case "hash-map": {
      // (hash-map k1 v1 k2 v2 ...) → map
      const hm: Record<string, any> = {};
      for (let i = 0; i + 1 < args.length; i += 2) {
        const k = typeof args[i] === "string" && args[i].startsWith(":") ? args[i].slice(1) : String(args[i]);
        hm[k] = args[i + 1];
      }
      return hm;
    }
    case "assoc": {
      // #5 v12 힌트: 첫 번째 인자가 map이 아니면 명확한 에러
      if (args[0] !== null && (typeof args[0] !== "object" || Array.isArray(args[0]))) {
        throw new Error(`[E_TYPE_MISMATCH] assoc: 첫 번째 인자는 map이어야 합니다 (받은 값: ${typeof args[0]})\n  올바른 형식: (assoc map key val)\n  예: (assoc {:a 1} "b" 2) → {:a 1 :b 2}`);
      }
      let base = (args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]))
        ? { ...args[0] } : {};
      // 멀티 쌍: (assoc map k1 v1 k2 v2 ...)
      for (let i = 1; i + 1 < args.length; i += 2) {
        // 키 정규화: :key → "key" (LIR-002)
        const rawK = args[i];
        const k = typeof rawK === "string" && rawK.startsWith(":") ? rawK.slice(1) : String(rawK);
        base[k] = args[i + 1];
      }
      return base;
    }
    case "assoc-in": {
      // (assoc-in obj [k1 k2 k3] val) → 중첩 맵을 불변으로 업데이트
      if (!Array.isArray(args[1]) || args[1].length === 0) throw new Error(`assoc-in: 두 번째 인자는 비어있지 않은 키 배열이어야 합니다`);
      const aiKeys = args[1];
      const aiVal = args[2];
      function aiSet(obj: any, keys: any[], val: any): any {
        const k = typeof keys[0] === "string" && keys[0].startsWith(":") ? keys[0].slice(1) : String(keys[0]);
        const base = (obj !== null && typeof obj === "object" && !Array.isArray(obj)) ? { ...obj } : {};
        base[k] = keys.length === 1 ? val : aiSet(base[k], keys.slice(1), val);
        return base;
      }
      return aiSet(args[0], aiKeys, aiVal);
    }
    case "update-in": {
      // (update-in obj [k1 k2 k3] fn) → 중첩 경로의 값에 fn 적용, 불변 반환
      if (!Array.isArray(args[1]) || args[1].length === 0) throw new Error(`update-in: 두 번째 인자는 비어있지 않은 키 배열이어야 합니다`);
      const uiKeys = args[1];
      const uiFn = args[2];
      const uiExtraArgs = args.slice(3);
      function uiUpdate(obj: any, keys: any[]): any {
        const k = typeof keys[0] === "string" && keys[0].startsWith(":") ? keys[0].slice(1) : String(keys[0]);
        const base = (obj !== null && typeof obj === "object" && !Array.isArray(obj)) ? { ...obj } : {};
        if (keys.length === 1) {
          const cur = base[k] !== undefined ? base[k] : null;
          const uiCallArgs = [cur, ...uiExtraArgs];
          base[k] = typeof uiFn === "string"
            ? evalBuiltin(interp, uiFn, uiCallArgs, expr)
            : callFnVal(uiFn, uiCallArgs);
        } else {
          base[k] = uiUpdate(base[k], keys.slice(1));
        }
        return base;
      }
      return uiUpdate(args[0], uiKeys);
    }
    case "dissoc": {
      // #6 v12 힌트: 첫 번째 인자가 map이 아니면 에러
      if (args[0] !== null && args[0] !== undefined && (typeof args[0] !== "object" || Array.isArray(args[0]))) {
        throw new Error(`[E_TYPE_MISMATCH] dissoc: 첫 번째 인자는 map이어야 합니다 (받은 값: ${typeof args[0]})\n  올바른 형식: (dissoc map key)\n  예: (dissoc {:a 1 :b 2} "a") → {:b 2}`);
      }
      if (args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])) {
        // 다중 키 지원: (dissoc m "a" "b" "c")
        let result = { ...args[0] };
        for (let ki = 1; ki < args.length; ki++) {
          const rawK = args[ki];
          const k = typeof rawK === "string" && rawK.startsWith(":") ? rawK.slice(1) : String(rawK);
          delete result[k];
        }
        return result;
      }
      return args[0] ?? {};
    }
    case "obj-keys": case "obj_keys": {
      if (!args[0] || typeof args[0] !== "object" || Array.isArray(args[0])) return [];
      return Object.keys(args[0]);
    }
    case "obj-values": case "obj_values": {
      if (!args[0] || typeof args[0] !== "object" || Array.isArray(args[0])) return [];
      return Object.values(args[0]);
    }
    case "obj-entries": case "obj_entries": {
      if (!args[0] || typeof args[0] !== "object" || Array.isArray(args[0])) return [];
      return Object.entries(args[0]);
    }
    case "obj-merge": case "obj_merge": case "merge": {
      // (obj-merge m1 m2 ...) — 오른쪽이 우선
      if (args.length === 0) return {};
      return Object.assign({}, ...args.filter((a: any) => a && typeof a === "object" && !Array.isArray(a)));
    }
    case "merge-with": {
      // (merge-with fn m1 m2) — 키 충돌 시 fn(v1 v2)로 합산
      const fn = args[0];
      const maps = args.slice(1).filter((a: any) => a && typeof a === "object" && !Array.isArray(a));
      if (maps.length === 0) return {};
      const result: any = { ...maps[0] };
      for (let mi = 1; mi < maps.length; mi++) {
        for (const [k, v] of Object.entries(maps[mi])) {
          result[k] = k in result ? callFnVal(fn, [result[k], v]) : v;
        }
      }
      return result;
    }
    case "into": {
      // (into target coll) — coll의 모든 요소를 target에 합침
      const target = args[0];
      const coll = args[1];
      if (Array.isArray(target)) {
        return Array.isArray(coll) ? [...target, ...coll] : target;
      }
      if (target && typeof target === "object" && !Array.isArray(target)) {
        if (Array.isArray(coll)) {
          const res = { ...target };
          for (const item of coll) {
            if (Array.isArray(item) && item.length === 2) res[String(item[0])] = item[1];
            else if (item && typeof item === "object") Object.assign(res, item);
          }
          return res;
        }
        return target;
      }
      return coll ?? target;
    }
    case "obj-pick": case "obj_pick": case "pick": {
      // (obj-pick m ["k1" "k2"]) — 지정 키만 추출
      if (!args[0] || !Array.isArray(args[1])) return {};
      const m = args[0];
      return args[1].reduce((acc: any, k: string) => {
        const key = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (key in m) acc[key] = m[key];
        return acc;
      }, {});
    }
    case "obj-omit": case "obj_omit": case "omit": {
      // (obj-omit m ["k1" "k2"]) — 지정 키 제외한 나머지
      if (!args[0]) return {};
      if (!Array.isArray(args[1])) return { ...args[0] };
      const result = { ...args[0] };
      for (const k of args[1]) {
        const key = typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        delete result[key];
      }
      return result;
    }
    case "select-keys": {
      // (select-keys m [:a :b]) → {a: ..., b: ...}
      if (!args[0] || !Array.isArray(args[1])) return {};
      const result: Record<string, any> = {};
      for (const k of args[1]) {
        const key = k && typeof k === "object" && k.kind === "keyword" ? k.name
          : typeof k === "string" && k.startsWith(":") ? k.slice(1) : String(k);
        if (args[0][key] !== undefined) result[key] = args[0][key];
      }
      return result;
    }
    case "rename-keys": {
      // (rename-keys m {:old-key :new-key}) → m with keys renamed
      if (!args[0] || !args[1]) return { ...args[0] };
      const result = { ...args[0] };
      for (const [oldK, newK] of Object.entries(args[1])) {
        const ok = typeof oldK === "string" && oldK.startsWith(":") ? oldK.slice(1) : oldK;
        const nk = newK && typeof newK === "object" && (newK as any).kind === "keyword" ? (newK as any).name
          : typeof newK === "string" && newK.startsWith(":") ? newK.slice(1) : String(newK);
        if (result[ok] !== undefined) { result[nk] = result[ok]; delete result[ok]; }
      }
      return result;
    }
    case "str-index-of": case "str-index_of": {
      if (typeof args[0] !== "string") return -1;
      return args[0].indexOf(String(args[1] ?? ""), args[2] !== undefined ? Number(args[2]) : 0);
    }
    case "str-replace-all": case "str-replace":
      return typeof args[0] === "string" ? args[0].split(String(args[1] ?? "")).join(String(args[2] ?? "")) : "";
    // 정식 str-* 이름 (alias)
    case "str-to-upper": case "str-upper":
      return typeof args[0] === "string" ? args[0].toUpperCase() : (args[0] ?? "");
    case "str-to-lower": case "str-lower":
      return typeof args[0] === "string" ? args[0].toLowerCase() : (args[0] ?? "");
    case "str-trim":
      return typeof args[0] === "string" ? args[0].trim() : (args[0] === null || args[0] === undefined ? null : "");
    case "str-trim-left":
      return typeof args[0] === "string" ? args[0].trimStart() : (args[0] ?? "");
    case "str-trim-right":
      return typeof args[0] === "string" ? args[0].trimEnd() : (args[0] ?? "");
    case "str-starts-with":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].startsWith(args[1]) : false;
    case "str-ends-with":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].endsWith(args[1]) : false;
    case "str-includes": case "str-contains":
      return typeof args[0] === "string" && typeof args[1] === "string" ? args[0].includes(args[1]) : false;
    // 신규 문자열 함수
    case "str-repeat":
      return typeof args[0] === "string" ? args[0].repeat(Math.max(0, Number(args[1] ?? 0))) : "";
    case "str-pad-left": {
      if (typeof args[0] !== "string") return String(args[0] ?? "");
      const padLen = Number(args[1] ?? 0);
      const padCh = typeof args[2] === "string" ? args[2] : " ";
      return args[0].padStart(padLen, padCh);
    }
    case "str-pad-right": {
      if (typeof args[0] !== "string") return String(args[0] ?? "");
      const padLen = Number(args[1] ?? 0);
      const padCh = typeof args[2] === "string" ? args[2] : " ";
      return args[0].padEnd(padLen, padCh);
    }
    case "str-lines":
      return typeof args[0] === "string" ? args[0].split("\n") : [];
    case "str-reverse":
      return typeof args[0] === "string" ? args[0].split("").reverse().join("") : "";
    // 맵 변환 유틸리티
    case "map-vals": {
      const fn = args[0]; const m = args[1];
      if (!m || typeof m !== "object" || Array.isArray(m)) return {};
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(m)) out[k] = callFnVal(fn, [v]);
      return out;
    }
    case "map-keys": {
      const fn = args[0]; const m = args[1];
      if (!m || typeof m !== "object" || Array.isArray(m)) return {};
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(m)) out[String(callFnVal(fn, [k]))] = v;
      return out;
    }
    case "filter-vals": {
      const fn = args[0]; const m = args[1];
      if (!m || typeof m !== "object" || Array.isArray(m)) return {};
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(m)) if (callFnVal(fn, [v])) out[k] = v;
      return out;
    }
    case "flatten": {
      if (!Array.isArray(args[0])) return [];
      const flattenDeep = (arr: any[]): any[] => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flattenDeep(val) : val), []);
      return flattenDeep(args[0]);
    }
    case "flatten-1": case "flat-1": {
      // 1단계만 펼치기
      if (!Array.isArray(args[0])) return [];
      return (args[0] as any[]).reduce((acc: any[], val: any) => acc.concat(Array.isArray(val) ? val : [val]), []);
    }
    case "conj": {
      // (conj coll v1 v2 ...) — 배열 끝에 추가, 맵이면 병합
      const coll = args[0];
      const vals = args.slice(1);
      if (Array.isArray(coll)) return [...coll, ...vals];
      if (coll !== null && typeof coll === "object" && !Array.isArray(coll)) {
        let result = { ...coll };
        for (const v of vals) {
          if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(result, v);
          else if (Array.isArray(v) && v.length === 2) result[String(v[0])] = v[1];
        }
        return result;
      }
      return vals;
    }
    case "partition-by": {
      // (partition-by fn coll) — 연속된 같은 결과끼리 그룹화
      const fn = args[0];
      const coll = args[1];
      if (!Array.isArray(coll) || coll.length === 0) return [];
      const result: any[][] = [];
      let group: any[] = [coll[0]];
      let lastKey = callFnVal(fn, [coll[0]]);
      for (let i = 1; i < coll.length; i++) {
        const key = callFnVal(fn, [coll[i]]);
        if (key === lastKey) {
          group.push(coll[i]);
        } else {
          result.push(group);
          group = [coll[i]];
          lastKey = key;
        }
      }
      result.push(group);
      return result;
    }
    case "every?": case "every": {
      if (args[1] === null || args[1] === undefined) return true; // vacuous truth
      if (!Array.isArray(args[1])) throw new Error(`every?: 두 번째 인자는 배열이어야 합니다`);
      return args[1].every((item: any) => callFnVal(args[0], [item]));
    }
    case "any?": case "any": {
      if (args[1] === null || args[1] === undefined) return null;
      if (!Array.isArray(args[1])) throw new Error(`any?: 두 번째 인자는 배열이어야 합니다`);
      const found = args[1].find((item: any) => callFnVal(args[0], [item]));
      return found !== undefined ? found : null;
    }
    case "none?": {
      // (none? pred arr) → 모든 요소가 pred를 만족하지 않으면 true
      if (!Array.isArray(args[1])) return true;
      return args[1].every((item: any) => !callFnVal(args[0], [item]));
    }
    case "none":
      // (none) → Option monad None 생성자; (none? pred arr) 와 구분
      if (args.length === 0) return { tag: "None", value: null, kind: "Option" };
      // 2인자: none?와 동일 동작 (하위호환)
      if (Array.isArray(args[1])) return args[1].every((item: any) => !callFnVal(args[0], [item]));
      return { tag: "None", value: null, kind: "Option" };
    case "unique": case "distinct":
      return Array.isArray(args[0]) ? [...new Set(args[0])] : [];
    case "sort":
      if (!Array.isArray(args[0])) return [];
      return [...args[0]].sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") return a - b;
        return String(a).localeCompare(String(b));
      });
    case "sort-by": case "sort_by": {
      // (sort-by keyfn coll) — keyfn을 호출해 반환값으로 정렬
      // 인자 순서 오류 감지: (sort-by arr fn) 형식은 잘못됨
      if (Array.isArray(args[0]) && args[0].length > 0) {
        const second = args[1];
        const firstElemIsFunc = typeof args[0][0] === "function"
          || args[0][0]?.kind === "function-value"
          || args[0][0]?.kind === "closure";
        const secondIsFunc = second && (
          typeof second === "function"
          || second?.kind === "function-value"
          || second?.kind === "closure"
        );
        if (secondIsFunc && !firstElemIsFunc) {
          throw new Error(
            `sort-by 인자 순서 오류: (sort-by fn arr) 형식이 올바릅니다. 현재 입력: (sort-by arr fn)`
          );
        }
      }
      if (!Array.isArray(args[1])) return [];
      const keyFn = args[0];
      const sbArr = args[1] as any[];
      const sbIsField = typeof keyFn === "string" && sbArr.length > 0 && sbArr[0] !== null && typeof sbArr[0] === "object";
      const sbExtract = sbIsField
        ? (x: any) => (x !== null && typeof x === "object") ? x[keyFn] : null
        : (x: any) => callFnVal(keyFn, [x]);
      return [...sbArr].sort((a, b) => {
        const ka = sbExtract(a);
        const kb = sbExtract(b);
        if (typeof ka === "number" && typeof kb === "number") return ka - kb;
        return String(ka).localeCompare(String(kb));
      });
    }
    case "zip": {
      // (zip arr1 arr2) → [[a1 b1] [a2 b2] ...]
      const a = Array.isArray(args[0]) ? args[0] : [];
      const b = Array.isArray(args[1]) ? args[1] : [];
      const len = Math.min(a.length, b.length);
      return Array.from({ length: len }, (_, i) => [a[i], b[i]]);
    }
    case "zip-with": {
      // (zip-with f arr1 arr2) → [(f a1 b1) (f a2 b2) ...]
      const fn = args[0];
      const a = Array.isArray(args[1]) ? args[1] : [];
      const b = Array.isArray(args[2]) ? args[2] : [];
      const len = Math.min(a.length, b.length);
      const callFn2 = interp?.callFunctionValue?.bind(interp);
      if (!callFn2) return [];
      return Array.from({ length: len }, (_, i) => callFn2(fn, [a[i], b[i]]));
    }
    // ── cache-* (LRU + TTL) ──────────────────────────────────────────────────
    case "cache-create": {
      const maxSize = typeof args[0] === "number" ? Math.max(1, args[0]) : 100;
      return makeCacheHandle(maxSize);
    }
    case "cache-set": {
      // 핸들 모드: (cache-set ch key val [ttl-ms])
      // 글로벌 모드: (cache-set key val [ttl-sec]) — 하위 호환
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      const key = String(isHandle ? args[1] : args[0]);
      const val = isHandle ? args[2] : args[1];
      const rawTtl = isHandle ? args[3] : args[2];
      // 글로벌 모드는 TTL이 초 단위, 핸들 모드는 ms 단위
      const ttlMs = typeof rawTtl === "number" ? (isHandle ? rawTtl : rawTtl * 1000) : null;
      if (ch.map.has(key)) ch.map.delete(key);
      else cacheEvict(ch);
      ch.map.set(key, { value: val, expires: ttlMs !== null ? Date.now() + ttlMs : null });
      return true;
    }
    case "cache-get": {
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      const key = String(isHandle ? args[1] : args[0]);
      const entry = ch.map.get(key);
      if (!entry) { ch.misses++; return null; }
      if (entry.expires !== null && Date.now() > entry.expires) {
        ch.map.delete(key); ch.misses++; return null;
      }
      ch.map.delete(key); ch.map.set(key, entry);
      ch.hits++;
      return entry.value;
    }
    case "cache-has": {
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      const key = String(isHandle ? args[1] : args[0]);
      const entry = ch.map.get(key);
      if (!entry) return false;
      if (entry.expires !== null && Date.now() > entry.expires) { ch.map.delete(key); return false; }
      return true;
    }
    case "cache-del": {
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      const key = String(isHandle ? args[1] : args[0]);
      return ch.map.delete(key);
    }
    case "cache-clear": {
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      ch.map.clear(); ch.hits = 0; ch.misses = 0;
      return true;
    }
    case "cache-stats": {
      const isHandle = args[0] && (args[0] as any).kind === "cache";
      const ch = isHandle ? (args[0] as CacheHandle) : _globalCache;
      const total = ch.hits + ch.misses;
      return { size: ch.map.size, hits: ch.hits, misses: ch.misses, "hit-rate": total > 0 ? ch.hits / total : 0 };
    }
    // ────────────────────────────────────────────────────────────────────────

    case "uuid": case "uuid4": {
      const { randomUUID } = require("crypto");
      return randomUUID();
    }
    case "sleep": {
      const ms = Math.max(0, Number(args[0] ?? 0));
      // 동기 sleep — SharedArrayBuffer 없이 Atomics.wait 사용
      const buf = new SharedArrayBuffer(4);
      Atomics.wait(new Int32Array(buf), 0, 0, ms);
      return null;
    }
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
    case "type-of": {
      const v = args[0];
      if (v === null || v === undefined) return "nil";
      if (Array.isArray(v)) return "array";
      if (typeof v === "function" || v?.kind === "function-value" || v?.kind === "closure" || v?.kind === "builtin-fn") return "function";
      if (typeof v === "object") return "map";
      return typeof v; // "number", "string", "boolean"
    }

    // ── 벡터 유사도 (pgvector 대체) ──────────────────────────────
    case "vec-dot": case "dot-product": {
      // (vec-dot a b) → 내적 (dot product)
      const a = args[0], b = args[1];
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      let sum = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
      return sum;
    }
    case "vec-norm": case "vec-magnitude": {
      // (vec-norm v) → L2 노름 (크기)
      const v = args[0];
      if (!Array.isArray(v)) return 0;
      return Math.sqrt(v.reduce((s: number, x: any) => s + x * x, 0));
    }
    case "cosine-sim": case "cosine_sim": {
      // (cosine-sim a b) → 코사인 유사도 [-1, 1]
      const a = args[0], b = args[1];
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dot += (a[i] ?? 0) * (b[i] ?? 0);
        na  += (a[i] ?? 0) ** 2;
        nb  += (b[i] ?? 0) ** 2;
      }
      const denom = Math.sqrt(na) * Math.sqrt(nb);
      return denom === 0 ? 0 : dot / denom;
    }
    case "euclidean-dist": case "vec-dist": {
      // (euclidean-dist a b) → 유클리디안 거리
      const a = args[0], b = args[1];
      if (!Array.isArray(a) || !Array.isArray(b)) return 0;
      let sum = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        sum += d * d;
      }
      return Math.sqrt(sum);
    }
    case "vec-add": {
      // (vec-add a b) → 벡터 합
      const a = args[0], b = args[1];
      if (!Array.isArray(a) || !Array.isArray(b)) return [];
      return Array.from({ length: Math.min(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
    }
    case "vec-scale": {
      // (vec-scale v scalar) → 스칼라 곱
      const v = args[0], s = Number(args[1] ?? 1);
      if (!Array.isArray(v)) return [];
      return v.map((x: any) => x * s);
    }
    case "vec-normalize": {
      // (vec-normalize v) → 단위 벡터
      const v = args[0];
      if (!Array.isArray(v)) return [];
      const norm = Math.sqrt(v.reduce((s: number, x: any) => s + x * x, 0));
      return norm === 0 ? v : v.map((x: any) => x / norm);
    }
    case "vec-top-k": {
      // (vec-top-k query vectors k) → 코사인 유사도 상위 k개 [{:score :index :data}]
      const query   = args[0];
      const vectors = args[1];
      const k       = Number(args[2] ?? 5);
      if (!Array.isArray(query) || !Array.isArray(vectors)) return [];
      const scored = vectors.map((item: any, idx: number) => {
        const vec = Array.isArray(item) ? item : (item?.vector ?? item?.embedding ?? []);
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < Math.min(query.length, vec.length); i++) {
          dot += (query[i] ?? 0) * (vec[i] ?? 0);
          na  += (query[i] ?? 0) ** 2;
          nb  += (vec[i] ?? 0) ** 2;
        }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        return { score: denom === 0 ? 0 : dot / denom, index: idx, data: item };
      });
      return scored.sort((a: any, b: any) => b.score - a.score).slice(0, k);
    }

    case "assert-type": {
      const val = args[0];
      const typeStr = String(args[1]);
      let actualType = typeof val;
      if (Array.isArray(val)) actualType = "array";
      else if (val === null) actualType = "null";
      else if (val instanceof Map) actualType = "map";
      if (actualType !== typeStr) {
        throw new Error(`Type assertion failed: expected '${typeStr}', got '${actualType}' (value: ${JSON.stringify(val)})`);
      }
      return val;
    }
    case "num":
      return Number(args[0]);
    case "bool":
      return Boolean(args[0]);

    // Math Functions
    case "math-abs": case "math_abs":
    case "abs":
      return Math.abs(args[0]);
    case "min":
      return Math.min(...args.filter((v: any) => typeof v === "number"));
    case "max":
      return Math.max(...args.filter((v: any) => typeof v === "number"));
    case "floor":
      return Math.floor(args[0]);
    case "ceil":
      return Math.ceil(args[0]);
    case "round":
      return Math.round(args[0]);
    case "quot":
      // (quot a b) → 정수 나눗셈 (0 방향으로 버림)
      return Math.trunc(Number(args[0]) / Number(args[1]));
    case "rem":
      // (rem a b) → 나머지 (부호는 피제수 따름)
      return Number(args[0]) - Math.trunc(Number(args[0]) / Number(args[1])) * Number(args[1]);
    case "int":
      // (int x) → 정수로 변환 (0 방향 버림)
      return Math.trunc(Number(args[0]));
    case "sorted?": {
      // (sorted? coll) → 오름차순 정렬 여부
      const arr = args[0];
      if (!Array.isArray(arr) || arr.length <= 1) return true;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] < arr[i - 1]) return false;
      }
      return true;
    }
    case "math-sqrt": case "math_sqrt":
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
    case "rand":
      return Math.random();
    case "rand-int": {
      // (rand-int n) → 0..n-1,  (rand-int min max) → min..max-1
      if (args.length >= 2) return Math.floor(Math.random() * (Number(args[1]) - Number(args[0]))) + Number(args[0]);
      return Math.floor(Math.random() * Number(args[0]));
    }
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
      // (some fn arr) → bool array predicate; (some val) → Option monad constructor
      if (typeof args[0] === "function" || (args[0] && ((args[0] as any).kind === "function-value" || (args[0] as any).kind === "closure"))) {
        const someFn = args[0], someArr = Array.isArray(args[1]) ? args[1] : [];
        if (typeof someFn === "function") return someArr.some(someFn);
        return someArr.some((item: any) => callFnVal(someFn, [item]));
      }
      return { tag: "Some", value: args[0], kind: "Option" };
    case "every?": {
      // (every? fn arr) → true if all elements satisfy predicate
      const evFn = args[0], evArr = Array.isArray(args[1]) ? args[1] : [];
      if (typeof evFn === "function") return evArr.every(evFn);
      return evArr.every((item: any) => callFnVal(evFn, [item]));
    }
    case "any?": {
      // (any? fn arr) → true if any element satisfies predicate
      const anyFn = args[0], anyArr = Array.isArray(args[1]) ? args[1] : [];
      if (typeof anyFn === "function") return anyArr.some(anyFn);
      return anyArr.some((item: any) => callFnVal(anyFn, [item]));
    }
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
      // (range n) → [0 1 ... n-1] eager array
      // (range start end) → [start ... end-1] eager array
      // (range start end step) → stepped array
      // (range) → infinite lazy seq (무한 seq, take와 함께 사용)
      if (args.length === 0) return rangeSeq(0);
      const start = args.length === 1 ? 0 : Number(args[0]);
      const end   = args.length === 1 ? Number(args[0]) : Number(args[1]);
      const step  = args.length >= 3 ? Number(args[2]) : 1;
      const out: number[] = [];
      if (step > 0) for (let i = start; i < end; i += step) out.push(i);
      else if (step < 0) for (let i = start; i > end; i += step) out.push(i);
      return out;
    }

    // (take n seq) — lazy or array에서 n개 꺼냄
    case "take": {
      // 인자 순서 감지: (take arr n) → 즉시 throw
      if (Array.isArray(args[0]) && typeof args[1] === "number") {
        throw new Error(`take 인자 순서 오류: (take n coll) 형식이 올바릅니다. 현재 입력: (take coll n)`);
      }
      const n = args[0] as number;
      const seq = args[1];
      return take(n, isLazySeq(seq) ? seq : Array.isArray(seq) ? seq : null);
    }

    // (drop n seq) — lazy seq에서 n개 버리고 나머지 반환
    case "drop": {
      // 인자 순서 감지: (drop arr n) → 즉시 throw
      if (Array.isArray(args[0]) && typeof args[1] === "number") {
        throw new Error(`drop 인자 순서 오류: (drop n coll) 형식이 올바릅니다. 현재 입력: (drop coll n)`);
      }
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

    case "drop-while": {
      // (drop-while pred seq) → pred가 truthy인 동안 건너뛰고 나머지 반환
      const pred = args[0];
      const seq = args[1];
      if (!Array.isArray(seq)) return [];
      let i = 0;
      while (i < seq.length && callFnVal(pred, [seq[i]])) i++;
      return seq.slice(i);
    }

    case "map-indexed": {
      // (map-indexed fn seq) → fn이 [index value]를 인자로 받음
      const fn = args[0];
      const seq = args[1];
      if (!Array.isArray(seq)) return [];
      return seq.map((v, i) => callFnVal(fn, [i, v]));
    }

    case "reduce-kv": {
      // (reduce-kv fn init map) → map의 키-값 쌍을 순회하며 축적
      const fn = args[0];
      const init = args[1];
      const m = args[2];
      if (m === null || m === undefined || typeof m !== "object" || Array.isArray(m)) return init;
      let acc = init;
      for (const [k, v] of Object.entries(m)) {
        acc = callFnVal(fn, [acc, k, v]);
      }
      return acc;
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
      // (flat-map fn arr) — fn-first
      const fmFn = args[0], fmArr = args[1];
      if (Array.isArray(fmArr)) {
        const results: any[] = [];
        for (const item of fmArr) {
          const r = callFnVal(fmFn, [item]);
          if (Array.isArray(r)) results.push(...r);
          else if (r !== null && r !== undefined) results.push(r);
        }
        return results;
      }
      // Result monad flat-map fallback
      return flatMap(fmArr, (v: any) => callFn(fmFn, [v]));
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

      // Phase 128: Chain-Agents — 에이전트 체인 파이프라인
      if (op === "chain-agents") {
        // (chain-agents agents-list input) → finalOutput
        const [rawAgents, input] = args;
        if (!Array.isArray(rawAgents)) return input;
        const agents: ChainAgent[] = rawAgents.map((a: any) => {
          if (typeof a === "object" && a !== null && typeof a.transform === "function") return a as ChainAgent;
          if (Array.isArray(a)) {
            const [id, tf, vf] = a;
            return {
              id: String(id),
              transform: (inp: any) => callFn(tf, [inp]),
              validate: vf ? (out: any) => Boolean(callFn(vf, [out])) : undefined,
            } as ChainAgent;
          }
          return { id: String(a), transform: (x: any) => x } as ChainAgent;
        });
        const chain = AgentChain.from(agents);
        const result = chain.run(input);
        return result.finalOutput;
      }
      if (op === "chain-links") {
        // (chain-links agents-list input) → agentId 리스트 (완료된 것)
        const [rawAgents, input] = args;
        if (!Array.isArray(rawAgents)) return [];
        const agents: ChainAgent[] = rawAgents.map((a: any) => {
          if (typeof a === "object" && a !== null && typeof a.transform === "function") return a as ChainAgent;
          if (Array.isArray(a)) {
            const [id, tf, vf] = a;
            return {
              id: String(id),
              transform: (inp: any) => callFn(tf, [inp]),
              validate: vf ? (out: any) => Boolean(callFn(vf, [out])) : undefined,
            } as ChainAgent;
          }
          return { id: String(a), transform: (x: any) => x } as ChainAgent;
        });
        const chain = AgentChain.from(agents);
        const result = chain.run(input);
        return result.links.filter((l: ChainLink) => !l.skipped).map((l: ChainLink) => l.agentId);
      }
      if (op === "chain-steps") {
        // (chain-steps agents-list input) → 완료 스텝 수
        const [rawAgents, input] = args;
        if (!Array.isArray(rawAgents)) return 0;
        const agents: ChainAgent[] = rawAgents.map((a: any) => {
          if (typeof a === "object" && a !== null && typeof a.transform === "function") return a as ChainAgent;
          if (Array.isArray(a)) {
            const [id, tf, vf] = a;
            return {
              id: String(id),
              transform: (inp: any) => callFn(tf, [inp]),
              validate: vf ? (out: any) => Boolean(callFn(vf, [out])) : undefined,
            } as ChainAgent;
          }
          return { id: String(a), transform: (x: any) => x } as ChainAgent;
        });
        const chain = AgentChain.from(agents);
        const result = chain.run(input);
        return result.stepsCompleted;
      }

      // Phase 126: Orchestrate — 의존성 기반 에이전트 오케스트레이션
      if (op === "orchestrate-run") {
        // (orchestrate-run tasks-list) → outputs map
        const [rawTasks] = args;
        if (!Array.isArray(rawTasks)) return {};
        const tasks: OrchestrateTask[] = rawTasks.map((t: any) => {
          if (Array.isArray(t)) {
            return { id: String(t[0]), input: t[1] ?? null, dependsOn: Array.isArray(t[2]) ? t[2].map(String) : undefined };
          }
          return { id: String(t.id ?? 'task'), input: t.input ?? null, dependsOn: t.dependsOn };
        });
        return globalOrchestrator.run(tasks).outputs;
      }
      if (op === "orchestrate-order") {
        // (orchestrate-order tasks-list) → 실행 순서 배열
        const [rawTasks] = args;
        if (!Array.isArray(rawTasks)) return [];
        const tasks: OrchestrateTask[] = rawTasks.map((t: any) => {
          if (Array.isArray(t)) {
            return { id: String(t[0]), input: t[1] ?? null, dependsOn: Array.isArray(t[2]) ? t[2].map(String) : undefined };
          }
          return { id: String(t.id ?? 'task'), input: t.input ?? null, dependsOn: t.dependsOn };
        });
        return globalOrchestrator.getOrder(tasks);
      }

      // Phase 130: Multi-Agent Hub — 협업 통합 허브
      if (op === "hub-route") {
        // (hub-route "taskType" problem) → result
        const [taskType, problem] = args;
        const result = globalHub.route(String(taskType), problem, []);
        return result.result;
      }
      if (op === "hub-stats") {
        // (hub-stats) → { systems, ready, phases, tier }
        return globalHub.stats();
      }
      if (op === "hub-systems") {
        // (hub-systems) → 시스템 이름 배열
        return globalHub.systems();
      }
      if (op === "hub-task-types") {
        // (hub-task-types) → 태스크 타입 배열
        return globalHub.taskTypes();
      }

      // Phase 122: Delegation — 서브태스크 위임
      if (op === "delegate-register") {
        const [id, caps, fn] = args;
        const capabilities: string[] = Array.isArray(caps) ? caps.map(String) : [];
        const agent: DelegateAgent = {
          id: String(id),
          capabilities,
          execute: (task: DelegateTask) => {
            if (typeof fn === "function") return fn(task);
            if ((fn as any)?.kind === "function-value") return callFn(fn, [task]);
            return fn;
          }
        };
        globalDelegation.register(agent);
        return String(id);
      }
      if (op === "delegate") {
        const [desc, input, capability] = args;
        const task: DelegateTask = {
          id: `task-${Date.now()}`,
          description: String(desc),
          input,
          requiredCapability: capability != null ? String(capability) : undefined
        };
        const result = globalDelegation.delegate(task);
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
        const tasks: DelegateTask[] = Array.isArray(taskList)
          ? taskList.map((t: any, i: number) => ({
              id: t instanceof Map ? String(t.get("id") ?? `task-${i}`) : `task-${i}`,
              description: t instanceof Map ? String(t.get("description") ?? "") : String(t),
              input: t instanceof Map ? t.get("input") : t,
              requiredCapability: t instanceof Map && t.has("requiredCapability")
                ? String(t.get("requiredCapability"))
                : undefined
            }))
          : [];
        const result = globalDelegation.delegateAll(tasks);
        return new Map<string, any>([
          ["results", result.results.map(r => new Map<string, any>([
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
        return globalDelegation.list();
      }

      // === Phase 133: CROSSOVER ===
      // (crossover-single [1 2 3] [4 5 6]) → CrossoverResult
      if (op === "crossover-single") {
        const [a, b] = args;
        const arrA = Array.isArray(a) ? a : [a];
        const arrB = Array.isArray(b) ? b : [b];
        const result = globalCrossover.singlePoint(arrA, arrB);
        return new Map<string, any>([
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
        const result = globalCrossover.twoPoint(arrA, arrB);
        return new Map<string, any>([
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
        const result = globalCrossover.uniform(arrA, arrB);
        return new Map<string, any>([
          ["parent1", result.parent1],
          ["parent2", result.parent2],
          ["child1", result.child1],
          ["child2", result.child2],
          ["type", result.type],
        ]);
      }
      // (crossover-arithmetic [1.0 2.0] [3.0 4.0] :alpha 0.5) → CrossoverResult
      if (op === "crossover-arithmetic") {
        let alpha: number | undefined;
        let cleanArgs = [...args];
        const alphaIdx = cleanArgs.findIndex((v: any) => v === "alpha" || v === ":alpha");
        if (alphaIdx !== -1) {
          alpha = Number(cleanArgs[alphaIdx + 1]);
          cleanArgs.splice(alphaIdx, 2);
        }
        const [a, b] = cleanArgs;
        const arrA = Array.isArray(a) ? a.map(Number) : [Number(a)];
        const arrB = Array.isArray(b) ? b.map(Number) : [Number(b)];
        const result = globalCrossover.arithmetic(arrA, arrB, alpha);
        return new Map<string, any>([
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
        const result = globalCrossover.crossoverStrings(String(a), String(b));
        return new Map<string, any>([
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
        const objA: Record<string, unknown> = a instanceof Map
          ? Object.fromEntries(a.entries())
          : (typeof a === "object" && a !== null ? a : {});
        const objB: Record<string, unknown> = b instanceof Map
          ? Object.fromEntries(b.entries())
          : (typeof b === "object" && b !== null ? b : {});
        const result = globalCrossover.crossoverObjects(objA, objB);
        const toMap = (o: Record<string, unknown>) =>
          new Map<string, any>(Object.entries(o));
        return new Map<string, any>([
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
        const alphaIdx = cleanArgs.findIndex((v: any) => v === "alpha" || v === ":alpha");
        if (alphaIdx !== -1) {
          alpha = Number(cleanArgs[alphaIdx + 1]);
          cleanArgs.splice(alphaIdx, 2);
        }
        const [a, b] = cleanArgs;
        if (Array.isArray(a) && Array.isArray(b)) {
          const result = globalCrossover.arithmetic(a.map(Number), b.map(Number), alpha);
          return result.child1;
        }
        if (typeof a === "number" && typeof b === "number") {
          return alpha * a + (1 - alpha) * b;
        }
        return a;
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
      // === Phase 131: EVOLVE ===

      // evolve-numbers: 숫자 배열 진화
      if (op === "evolve-numbers") {
        const target = Array.isArray(args[0]) ? args[0].map(Number) : [0];
        let popSize = 20;
        let maxGens = 50;
        for (let i = 1; i < args.length - 1; i += 2) {
          const key = String(args[i]);
          if (key === ":pop") popSize = Number(args[i + 1]);
          if (key === ":gens") maxGens = Number(args[i + 1]);
        }
        const result = evolveNumbers(target, popSize, maxGens);
        return new Map<string, any>([
          ["best", new Map<string, any>([
            ["genome", result.best.genome],
            ["fitness", result.best.fitness],
            ["generation", result.best.generation],
            ["id", result.best.id],
          ])],
          ["generations", result.generations],
          ["converged", result.converged],
          ["history", result.history.map(h => new Map<string, any>([
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
          if (key === ":pop") popSize = Number(args[i + 1]);
          if (key === ":gens") maxGens = Number(args[i + 1]);
        }
        const result = evolveStrings(target, popSize, maxGens);
        return new Map<string, any>([
          ["best", new Map<string, any>([
            ["genome", result.best.genome],
            ["fitness", result.best.fitness],
            ["generation", result.best.generation],
            ["id", result.best.id],
          ])],
          ["generations", result.generations],
          ["converged", result.converged],
          ["history", result.history.map(h => new Map<string, any>([
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
        let fitnessGoal: number | null = null;
        for (let i = 0; i < args.length - 1; i += 2) {
          const key = String(args[i]);
          if (key === ":pop") popSize = Number(args[i + 1]);
          if (key === ":gens") maxGens = Number(args[i + 1]);
          if (key === ":mutation") mutationRate = Number(args[i + 1]);
          if (key === ":elite") eliteRatio = Number(args[i + 1]);
          if (key === ":goal") fitnessGoal = Number(args[i + 1]);
        }
        return new Map<string, any>([
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
        if (engine instanceof EvolutionEngine) {
          const stepResult = engine.step();
          return new Map<string, any>([
            ["bestFitness", stepResult.bestFitness],
            ["avgFitness", stepResult.avgFitness],
          ]);
        }
        return null;
      }

      // evolve-best: 현재 최고 개체 반환
      if (op === "evolve-best") {
        const engine = args[0];
        if (engine instanceof EvolutionEngine) {
          const best = engine.getBest();
          if (!best) return null;
          return new Map<string, any>([
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
        if (engine instanceof EvolutionEngine) {
          return engine.getPopulation().map(ind => new Map<string, any>([
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
        if (engine instanceof EvolutionEngine) {
          const result = engine.run();
          return new Map<string, any>([
            ["best", new Map<string, any>([
              ["genome", result.best.genome],
              ["fitness", result.best.fitness],
              ["generation", result.best.generation],
              ["id", result.best.id],
            ])],
            ["generations", result.generations],
            ["converged", result.converged],
            ["history", result.history.map(h => new Map<string, any>([
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
        if (arg instanceof EvolutionEngine) {
          return arg.getHistory().map((h: any) => new Map<string, any>([
            ["gen", h.gen],
            ["bestFitness", h.bestFitness],
            ["avgFitness", h.avgFitness],
          ]));
        }
        if (arg instanceof Map) {
          const history = arg.get("history");
          if (Array.isArray(history)) return history;
        }
        return [];
      }

      // === Phase 132: MUTATE ===
      if (op === "mutate-config") {
        const config: Partial<MutationConfig> = {};
        for (let i = 0; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
          else if (k === "strength") config.strength = Number(v);
          else if (k === "type") config.type = String(v) as MutationType;
        }
        return new Map<string, any>([
          ["rate", config.rate ?? 0.1],
          ["strength", config.strength ?? 0.1],
          ["type", config.type ?? "random"]
        ]);
      }
      if (op === "mutate-numbers") {
        const arr = Array.isArray(args[0]) ? args[0].map(Number) : [];
        const config: Partial<MutationConfig> = {};
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
          else if (k === "strength") config.strength = Number(v);
          else if (k === "type") config.type = String(v) as MutationType;
        }
        const m = new Mutator(config);
        const r = m.mutateNumbers(arr);
        return new Map<string, any>([
          ["original", r.original],
          ["mutated", r.mutated],
          ["mutations", r.mutations],
          ["mutationType", r.mutationType]
        ]);
      }
      if (op === "mutate-string") {
        const s = String(args[0] ?? "");
        const config: Partial<MutationConfig> = {};
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
          else if (k === "strength") config.strength = Number(v);
          else if (k === "type") config.type = String(v) as MutationType;
        }
        const m = new Mutator(config);
        const r = m.mutateString(s);
        return new Map<string, any>([
          ["original", r.original],
          ["mutated", r.mutated],
          ["mutations", r.mutations],
          ["mutationType", r.mutationType]
        ]);
      }
      if (op === "mutate-object") {
        const raw = args[0];
        const obj: Record<string, unknown> = raw instanceof Map
          ? Object.fromEntries(raw.entries())
          : (typeof raw === "object" && raw !== null ? raw : {});
        const config: Partial<MutationConfig> = {};
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
          else if (k === "strength") config.strength = Number(v);
          else if (k === "type") config.type = String(v) as MutationType;
        }
        const m = new Mutator(config);
        const r = m.mutateObject(obj as Record<string, unknown>);
        const toMap = (o: Record<string, unknown>) => new Map<string, any>(Object.entries(o));
        return new Map<string, any>([
          ["original", toMap(r.original as Record<string, unknown>)],
          ["mutated", toMap(r.mutated as Record<string, unknown>)],
          ["mutations", r.mutations],
          ["mutationType", r.mutationType]
        ]);
      }
      if (op === "mutate-swap") {
        const arr = Array.isArray(args[0]) ? args[0] : [];
        const config: Partial<MutationConfig> = { type: "swap", rate: 0.3 };
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
        }
        const m = new Mutator(config);
        const r = m.swapMutation(arr);
        return new Map<string, any>([
          ["original", r.original],
          ["mutated", r.mutated],
          ["mutations", r.mutations],
          ["mutationType", r.mutationType]
        ]);
      }
      if (op === "mutate-flip") {
        const arr = Array.isArray(args[0]) ? args[0].map(Number) : [];
        const config: Partial<MutationConfig> = { type: "flip" };
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "rate") config.rate = Number(v);
        }
        const m = new Mutator(config);
        const r = m.flipMutation(arr);
        return new Map<string, any>([
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
          if (k === "n") n = Number(v);
        }
        const candidates = rawList.map((item: any) => {
          if (item instanceof Map) {
            return { value: item.get("value"), fitness: Number(item.get("fitness") ?? 0) };
          }
          if (typeof item === "object" && item !== null && "value" in item && "fitness" in item) {
            return { value: item.value, fitness: Number(item.fitness ?? 0) };
          }
          return { value: item, fitness: 0 };
        });
        return globalMutator.select(candidates, n);
      }
      if (op === "mutation-count") {
        const r = args[0];
        if (r instanceof Map) return r.get("mutations") ?? 0;
        return 0;
      }

      // === Phase 135: GENERATION ===
      // (generation-run $pop $fitness $next-gen :max 50) → GenerationResult
      if (op === "generation-run") {
        const [popArg, fitnessFnArg, nextGenFnArg, ...rest] = args;
        const population: any[] = Array.isArray(popArg) ? popArg : [];
        const maxGen = rest.length >= 2 && rest[0] === "max" ? Number(rest[1]) : 50;

        const fitnessFunc = (item: any): number => {
          if (typeof fitnessFnArg === "function") return Number(fitnessFnArg(item));
          if ((fitnessFnArg as any)?.kind === "function-value") return Number(callFn(fitnessFnArg, [item]));
          if (typeof fitnessFnArg === "string") return Number(callUser(fitnessFnArg, [item]));
          return 0;
        };

        const nextGenFunc = (pop: any[], fits: number[]): any[] => {
          if (typeof nextGenFnArg === "function") return (nextGenFnArg as any)(pop, fits) ?? pop;
          if ((nextGenFnArg as any)?.kind === "function-value") return callFn(nextGenFnArg, [pop, fits]) ?? pop;
          if (typeof nextGenFnArg === "string") return callUser(nextGenFnArg, [pop, fits]) ?? pop;
          // 기본: 정렬 후 상위 절반 유지 + 복사
          const paired = pop.map((item: any, i: number) => ({ item, fit: fits[i] }));
          paired.sort((a: any, b: any) => b.fit - a.fit);
          const half = Math.max(1, Math.floor(paired.length / 2));
          const elites = paired.slice(0, half).map((p: any) => p.item);
          const result: any[] = [...elites];
          while (result.length < pop.length) result.push(elites[result.length % half]);
          return result;
        };

        const loop = new GenerationLoop<any>({ maxGenerations: maxGen });
        const genResult = loop.run(population, fitnessFunc, nextGenFunc);

        return new Map<string, any>([
          ["best", genResult.best],
          ["bestFitness", genResult.bestFitness],
          ["totalGenerations", genResult.totalGenerations],
          ["history", genResult.history.map((s: GenerationStats) => new Map<string, any>([
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
        if (arg instanceof Map) return arg.get("best") ?? null;
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
        if (arg instanceof GenerationLoop) return arg.hasConverged();
        if (arg instanceof Map) {
          const history: any[] = arg.get("history") ?? [];
          if (history.length < 5) return false;
          const recent = history.slice(-5);
          const firstBest = recent[0] instanceof Map ? recent[0].get("best") : recent[0]?.best;
          return recent.every((s: any) => {
            const b = s instanceof Map ? s.get("best") : s?.best;
            return Math.abs(b - firstBest) < 1e-9;
          });
        }
        return false;
      }

      // (generation-diversity [0.8 0.7 0.9 0.6]) → 다양성 지수
      if (op === "generation-diversity") {
        const [arr] = args;
        const fitnesses: number[] = Array.isArray(arr) ? arr.map(Number) : [];
        const tmpLoop = new GenerationLoop<number>({ maxGenerations: 1 });
        return tmpLoop.calculateDiversity(fitnesses);
      }

      // (gen-improvement $result) → improvementRatio
      if (op === "gen-improvement") {
        const [arg] = args;
        if (arg instanceof Map) return arg.get("improvementRatio") ?? 0;
        return 0;
      }

      // (gen-termination $result) → terminationReason 문자열
      if (op === "gen-termination") {
        const [arg] = args;
        if (arg instanceof Map) return arg.get("terminationReason") ?? "max-generations";
        return "max-generations";
      }

      // === Phase 134: FITNESS ===
      if (op === "fitness-proximity") {
        const fpValue = Number(args[0]);
        const fpTarget = Number(args[1]);
        const fpTol = args[2] !== undefined ? Number(args[2]) : undefined;
        const fpRes = globalFitness.proximity(fpValue, fpTarget, fpTol);
        return new Map<string, any>([["score", fpRes.score], ["rawScore", fpRes.rawScore], ["details", new Map(Object.entries(fpRes.details))]]);
      }
      if (op === "fitness-string") {
        const fsA = String(args[0] ?? "");
        const fsB = String(args[1] ?? "");
        const fsRes = globalFitness.stringSimilarity(fsA, fsB);
        return new Map<string, any>([["score", fsRes.score], ["rawScore", fsRes.rawScore], ["details", new Map(Object.entries(fsRes.details))]]);
      }
      if (op === "fitness-array") {
        const faArr = Array.isArray(args[0]) ? args[0] : [];
        const faTgt = Array.isArray(args[1]) ? args[1] : [];
        const faRes = globalFitness.arrayMatch(faArr, faTgt);
        return new Map<string, any>([["score", faRes.score], ["rawScore", faRes.rawScore], ["details", new Map(Object.entries(faRes.details))]]);
      }
      if (op === "fitness-multi") {
        const fmVMap = args[0] instanceof Map ? args[0] : new Map();
        const fmTMap = args[1] instanceof Map ? args[1] : new Map();
        const fmWMap = args[2] instanceof Map ? args[2] : undefined;
        const fmV: Record<string, number> = {};
        const fmT: Record<string, number> = {};
        const fmW: Record<string, number> | undefined = fmWMap ? {} : undefined;
        fmVMap.forEach((v: any, k: any) => { fmV[String(k)] = Number(v); });
        fmTMap.forEach((v: any, k: any) => { fmT[String(k)] = Number(v); });
        if (fmWMap && fmW) fmWMap.forEach((v: any, k: any) => { fmW[String(k)] = Number(v); });
        const fmRes = globalFitness.multiObjective(fmV, fmT, fmW);
        return new Map<string, any>([["score", fmRes.score], ["rawScore", fmRes.rawScore], ["details", new Map(Object.entries(fmRes.details))]]);
      }
      if (op === "fitness-constraint") {
        const fcVal = args[0];
        const fcRaw = Array.isArray(args[1]) ? args[1] : [];
        const fcFns: Array<(v: unknown) => boolean> = fcRaw.map((c: any) => {
          if (typeof c === "function") return c;
          if ((c as any)?.kind === "function-value") return (v: unknown) => callFn(c, [v]);
          if (c === "positive" || c === ":positive") return (v: unknown) => typeof v === "number" && v > 0;
          if (c === "negative" || c === ":negative") return (v: unknown) => typeof v === "number" && v < 0;
          if (c === "even" || c === ":even") return (v: unknown) => typeof v === "number" && (v as number) % 2 === 0;
          if (c === "odd" || c === ":odd") return (v: unknown) => typeof v === "number" && (v as number) % 2 !== 0;
          if (c === "zero" || c === ":zero") return (v: unknown) => v === 0;
          return () => false;
        });
        const fcRes = globalFitness.constraintSatisfaction(fcVal, fcFns);
        return new Map<string, any>([["score", fcRes.score], ["rawScore", fcRes.rawScore], ["details", new Map(Object.entries(fcRes.details))]]);
      }
      if (op === "fitness-rank") {
        const frItems: any[] = Array.isArray(args[0]) ? args[0] : [];
        const frScorer = args[1];
        const frFn = (item: any): number => {
          if (typeof frScorer === "function") return frScorer(item);
          if ((frScorer as any)?.kind === "function-value") return callFn(frScorer, [item]);
          return 0;
        };
        const frRanked = globalFitness.rank(frItems, frFn);
        return frRanked.map((r: any) => new Map<string, any>(Object.entries(r)));
      }
      if (op === "fitness-pareto") {
        const fpPItems: any[] = Array.isArray(args[0]) ? args[0] : [];
        const fpObjs = (Array.isArray(args[1]) ? args[1] : []).map((f: any) => {
          if (typeof f === "function") return f;
          if ((f as any)?.kind === "function-value") return (item: any) => callFn(f, [item]);
          return () => 0;
        });
        return globalFitness.paretoFront(fpPItems, fpObjs);
      }
      if (op === "fitness-score") {
        const fsResult = args[0];
        if (fsResult instanceof Map) return fsResult.get("score") ?? 0;
        if (typeof fsResult === "object" && fsResult !== null) return (fsResult as any).score ?? 0;
        return Number(fsResult);
      }

      // === Phase 136: PRUNE ===
      if (op === "prune-threshold") {
        // (prune-threshold $items $scorer :min 0.5)
        const [pItems, pScorerFn, ...pKw] = args;
        const pThreshold = (() => {
          for (let i = 0; i < pKw.length - 1; i++) {
            if (pKw[i] === ":min" || pKw[i] === "min") return Number(pKw[i + 1]);
          }
          return 0.5;
        })();
        const pScorer1 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pArr1 = Array.isArray(pItems) ? pItems : [];
        const pruner1 = new Pruner<any>();
        return pruneResultToMap(pruner1.pruneByThreshold(pArr1, pScorer1, pThreshold));
      }
      if (op === "prune-top-k") {
        // (prune-top-k $items $scorer :k 5)
        const [pItems, pScorerFn, ...pKw] = args;
        const pK = (() => {
          for (let i = 0; i < pKw.length - 1; i++) {
            if (pKw[i] === ":k" || pKw[i] === "k") return Number(pKw[i + 1]);
          }
          return 5;
        })();
        const pScorer2 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pArr2 = Array.isArray(pItems) ? pItems : [];
        const pruner2 = new Pruner<any>();
        return pruneResultToMap(pruner2.pruneToTopK(pArr2, pScorer2, pK));
      }
      if (op === "prune-top-percent") {
        // (prune-top-percent $items $scorer :percent 0.3)
        const [pItems, pScorerFn, ...pKw] = args;
        const pPct = (() => {
          for (let i = 0; i < pKw.length - 1; i++) {
            if (pKw[i] === ":percent" || pKw[i] === "percent") return Number(pKw[i + 1]);
          }
          return 0.3;
        })();
        const pScorer3 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pArr3 = Array.isArray(pItems) ? pItems : [];
        const pruner3 = new Pruner<any>();
        return pruneResultToMap(pruner3.pruneToTopPercent(pArr3, pScorer3, pPct));
      }
      if (op === "prune-diversity") {
        // (prune-diversity $items $scorer $similarity :min 0.2)
        const [pItems, pScorerFn, pSimFn, ...pKw] = args;
        const pMinDiv = (() => {
          for (let i = 0; i < pKw.length - 1; i++) {
            if (pKw[i] === ":min" || pKw[i] === "min") return Number(pKw[i + 1]);
          }
          return 0.2;
        })();
        const pScorer4 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pSim4 = (a: any, b: any) => Number(callFn(pSimFn, [a, b]));
        const pArr4 = Array.isArray(pItems) ? pItems : [];
        const pruner4 = new Pruner<any>();
        return pruneResultToMap(pruner4.pruneForDiversity(pArr4, pScorer4, pSim4, pMinDiv));
      }
      if (op === "prune-dedup") {
        // (prune-dedup $items)
        const [pItems, pKeyFn] = args;
        const pArr5 = Array.isArray(pItems) ? pItems : [];
        const pruner5 = new Pruner<any>();
        const pKeyFnWrapped = pKeyFn ? (item: any) => String(callFn(pKeyFn, [item])) : undefined;
        return pruneResultToMap(pruner5.dedup(pArr5, pKeyFnWrapped));
      }
      if (op === "prune-weak") {
        // (prune-weak $items $scorer)
        const [pItems, pScorerFn] = args;
        const pScorer6 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pArr6 = Array.isArray(pItems) ? pItems : [];
        const pruner6 = new Pruner<any>();
        return pruneResultToMap(pruner6.pruneWeak(pArr6, pScorer6));
      }
      if (op === "keep-best") {
        // (keep-best $items $scorer :k 3)
        const [pItems, pScorerFn, ...pKw] = args;
        const pK7 = (() => {
          for (let i = 0; i < pKw.length - 1; i++) {
            if (pKw[i] === ":k" || pKw[i] === "k") return Number(pKw[i + 1]);
          }
          return 3;
        })();
        const pScorer7 = (item: any) => Number(callFn(pScorerFn, [item]));
        const pArr7 = Array.isArray(pItems) ? pItems : [];
        return _keepBest(pArr7, pScorer7, pK7);
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
        if (r137 !== null) return r137;
      }

      // === Phase 139: VERSION-SELF ===
      // version-snapshot: (version-snapshot $data "설명") → Snapshot
      if (op === "version-snapshot") {
        const data = args[0] ?? null;
        const description = String(args[1] ?? "snapshot");
        const tags: string[] = [];
        let performance: number | undefined;
        for (let i = 2; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "tags" && Array.isArray(v)) tags.push(...v.map(String));
          if (k === "performance") performance = Number(v);
        }
        const snap = globalVersioning.snapshot(data, description, tags, performance);
        return new Map<string, any>([
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
        const result = globalVersioning.rollback(id);
        return new Map<string, any>([
          ["success", result.success],
          ["reason", result.reason ?? null],
          ["previousId", result.previous?.id ?? null],
          ["restoredId", result.restored?.id ?? null],
        ]);
      }

      // version-prev: (version-prev) → 이전 버전으로 롤백
      if (op === "version-prev") {
        const result = globalVersioning.rollbackPrev();
        return new Map<string, any>([
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
        return globalVersioning.diff(id1, id2);
      }

      // version-get: (version-get $id) → Snapshot
      if (op === "version-get") {
        const id = String(args[0] ?? "");
        const snap = globalVersioning.get(id);
        if (!snap) return null;
        return new Map<string, any>([
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
        const snap = globalVersioning.latest();
        if (!snap) return null;
        return new Map<string, any>([
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
        return globalVersioning.getHistory().map(snap => new Map<string, any>([
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
        return globalVersioning.branch(name, fromId);
      }

      // version-checkout: (version-checkout "name") → Snapshot
      if (op === "version-checkout") {
        const name = String(args[0] ?? "");
        const snap = globalVersioning.checkout(name);
        if (!snap) return null;
        return new Map<string, any>([
          ["id", snap.id],
          ["version", snap.version],
          ["description", snap.metadata.description],
        ]);
      }

      // version-best: (version-best) → 최고 성능 Snapshot
      if (op === "version-best") {
        const snap = globalVersioning.bestPerforming();
        if (!snap) return null;
        return new Map<string, any>([
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
          if (k === "runs") bRuns = Number(args[i + 1]);
        }
        const bCallable = () => typeof bFn === 'function' ? bFn() : callFnVal(bFn, []);
        const bResult = globalBenchmark.measure(bName, bCallable, bRuns);
        return new Map<string, any>([
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
          if (k === "runs") bcRuns = Number(args[i + 1]);
        }
        const bcCallable1 = () => typeof bcFn1 === 'function' ? bcFn1() : callFnVal(bcFn1, []);
        const bcCallable2 = () => typeof bcFn2 === 'function' ? bcFn2() : callFnVal(bcFn2, []);
        const bcResult = globalBenchmark.compare("fn1", bcCallable1, "fn2", bcCallable2, bcRuns);
        const bcToMap = (r: BenchmarkResult) => new Map<string, any>([
          ["name", r.name], ["runs", r.runs], ["avgMs", r.avgMs],
          ["minMs", r.minMs], ["maxMs", r.maxMs], ["p50", r.p50],
          ["p95", r.p95], ["p99", r.p99], ["opsPerSec", r.opsPerSec],
        ]);
        return new Map<string, any>([
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
        return new SelfBenchmark(bsName);
      }

      // bench-add: (bench-add $suite "test" $fn) → suite에 추가
      if (op === "bench-add") {
        const baSuite = args[0];
        const baName = String(args[1] ?? "test");
        const baFn = args[2];
        if (baSuite instanceof SelfBenchmark) {
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
          if (k === "runs") brRuns = Number(args[i + 1]);
        }
        if (brSuite instanceof SelfBenchmark) {
          const brResult = brSuite.run(brRuns);
          const brToMap = (r: BenchmarkResult) => new Map<string, any>([
            ["name", r.name], ["runs", r.runs], ["avgMs", r.avgMs],
            ["minMs", r.minMs], ["maxMs", r.maxMs], ["opsPerSec", r.opsPerSec],
          ]);
          return new Map<string, any>([
            ["name", brResult.name],
            ["results", brResult.results.map(brToMap)],
            ["startTime", brResult.startTime.toISOString()],
            ["endTime", brResult.endTime?.toISOString() ?? ""],
            ["summary", new Map<string, any>([
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
          const r: BenchmarkResult = {
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
          return globalBenchmark.report(r);
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
          return new Map<string, any>([
            ["avg", stResult.get("avgMs")],
            ["min", stResult.get("minMs")],
            ["max", stResult.get("maxMs")],
            ["p95", stResult.get("p95")],
            ["p99", stResult.get("p99")],
            ["opsPerSec", stResult.get("opsPerSec")],
          ]);
        }
        return new Map<string, any>([
          ["avg", 0], ["min", 0], ["max", 0],
          ["p95", 0], ["p99", 0], ["opsPerSec", 0],
        ]);
      }

      // === Phase 140: SELF-EVOLUTION HUB ===

      // (self-evolve $population $fitness $mutate $crossover :gens 50) → EvolutionCycleResult
      if (op === "self-evolve") {
        const [popArg, fitnessFnArg, mutateFnArg, crossoverFnArg, ...rest] = args;
        const population: unknown[] = Array.isArray(popArg) ? popArg : [];
        const cfg: Partial<EvolutionCycleConfig> = {};
        for (let i = 0; i < rest.length - 1; i += 2) {
          const k = String(rest[i]).replace(/^:/, "");
          const v = rest[i + 1];
          if (k === "gens" || k === "generations") cfg.generations = Number(v);
          else if (k === "pop" || k === "populationSize") cfg.populationSize = Number(v);
          else if (k === "rate" || k === "mutationRate") cfg.mutationRate = Number(v);
          else if (k === "elite" || k === "eliteRatio") cfg.eliteRatio = Number(v);
          else if (k === "prune" || k === "pruneThreshold") cfg.pruneThreshold = Number(v);
          else if (k === "versioning" || k === "enableVersioning") cfg.enableVersioning = v === true || v === "true";
          else if (k === "benchmark" || k === "enableBenchmark") cfg.enableBenchmark = v === true || v === "true";
          else if (k === "refactor" || k === "enableRefactor") cfg.enableRefactor = v === true || v === "true";
        }
        const mkFn1 = (fnArg: unknown) => (item: unknown): unknown => {
          if (typeof fnArg === "function") return (fnArg as Function)(item);
          if ((fnArg as any)?.kind === "function-value") return callFn(fnArg, [item]);
          return item;
        };
        const fitnessFunc140 = (item: unknown): number => Number(mkFn1(fitnessFnArg)(item));
        const mutateFunc140 = (item: unknown): unknown => mkFn1(mutateFnArg)(item);
        const crossoverFunc140 = (a: unknown, b: unknown): unknown => {
          if (typeof crossoverFnArg === "function") return (crossoverFnArg as Function)(a, b);
          if ((crossoverFnArg as any)?.kind === "function-value") return callFn(crossoverFnArg, [a, b]);
          return a;
        };
        const r140 = globalSelfEvolution.runCycle(population, fitnessFunc140, mutateFunc140, crossoverFunc140, cfg);
        return new Map<string, any>([
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
        const cfg140: Partial<EvolutionCycleConfig> = {};
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "gens" || k === "generations") cfg140.generations = Number(v);
          else if (k === "pop" || k === "populationSize") cfg140.populationSize = Number(v);
          else if (k === "rate" || k === "mutationRate") cfg140.mutationRate = Number(v);
          else if (k === "versioning" || k === "enableVersioning") cfg140.enableVersioning = v === true || v === "true";
          else if (k === "benchmark" || k === "enableBenchmark") cfg140.enableBenchmark = v === true || v === "true";
          else if (k === "refactor" || k === "enableRefactor") cfg140.enableRefactor = v === true || v === "true";
        }
        const r140n = globalSelfEvolution.evolveNumbers(target140, cfg140);
        return new Map<string, any>([
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
        const cfg140s: Partial<EvolutionCycleConfig> = {};
        for (let i = 1; i < args.length - 1; i += 2) {
          const k = String(args[i]).replace(/^:/, "");
          const v = args[i + 1];
          if (k === "gens" || k === "generations") cfg140s.generations = Number(v);
          else if (k === "pop" || k === "populationSize") cfg140s.populationSize = Number(v);
          else if (k === "rate" || k === "mutationRate") cfg140s.mutationRate = Number(v);
          else if (k === "versioning" || k === "enableVersioning") cfg140s.enableVersioning = v === true || v === "true";
          else if (k === "benchmark" || k === "enableBenchmark") cfg140s.enableBenchmark = v === true || v === "true";
        }
        const r140s = globalSelfEvolution.evolveString(target140s, cfg140s);
        return new Map<string, any>([
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
        const results140: EvolutionCycleResult[] = rawResults140.map((r: any) => {
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
            } as EvolutionCycleResult;
          }
          return r as EvolutionCycleResult;
        });
        const rep140 = globalSelfEvolution.generateReport(results140);
        return new Map<string, any>([
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
        const cfg140i: Partial<EvolutionCycleConfig> = {};
        if (rawCfg140 instanceof Map) {
          const gens = rawCfg140.get("generations") ?? rawCfg140.get("gens");
          const pop = rawCfg140.get("populationSize") ?? rawCfg140.get("pop");
          const rate = rawCfg140.get("mutationRate") ?? rawCfg140.get("rate");
          if (gens !== undefined) cfg140i.generations = Number(gens);
          if (pop !== undefined) cfg140i.populationSize = Number(pop);
          if (rate !== undefined) cfg140i.mutationRate = Number(rate);
        }
        const imp140 = globalSelfEvolution.selfImprove(cfg140i);
        return new Map<string, any>([
          ["optimized", new Map<string, any>(Object.entries(imp140.optimized) as [string, any][])],
          ["improvement", imp140.improvement],
        ]);
      }

      // (evolve-cycle $pop $fitness) → 기본 설정으로 진화 실행
      if (op === "evolve-cycle") {
        const [popArg140, fitnessFnArg140] = args;
        const population140: unknown[] = Array.isArray(popArg140) ? popArg140 : [];
        const fitnessFunc140c = (item: unknown): number => {
          if (typeof fitnessFnArg140 === "function") return Number((fitnessFnArg140 as Function)(item));
          if ((fitnessFnArg140 as any)?.kind === "function-value") return Number(callFn(fitnessFnArg140, [item]));
          return typeof item === "number" ? item : 0;
        };
        const mutateFunc140c = (item: unknown): unknown => {
          if (Array.isArray(item)) {
            const arr = [...item] as number[];
            const idx = Math.floor(Math.random() * arr.length);
            arr[idx] += (Math.random() - 0.5) * 0.2;
            return arr;
          }
          return item;
        };
        const crossoverFunc140c = (a: unknown, b: unknown): unknown => {
          if (Array.isArray(a) && Array.isArray(b)) {
            const point = Math.floor(Math.random() * a.length);
            return [...a.slice(0, point), ...b.slice(point)];
          }
          return a;
        };
        const rc140 = globalSelfEvolution.runCycle(population140, fitnessFunc140c, mutateFunc140c, crossoverFunc140c);
        return new Map<string, any>([
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
        if (arg140 instanceof Map) return arg140.get("best") ?? null;
        return null;
      }

      // (evolution-fitness $result) → bestFitness
      if (op === "evolution-fitness") {
        const [arg140f] = args;
        if (arg140f instanceof Map) return arg140f.get("bestFitness") ?? 0;
        return 0;
      }

      // === Phase 141: WORLD-MODEL ===
      if (op.startsWith("world-")) { const r141 = evalWorldModel141(op, args); if (r141 !== undefined) return r141; }

      // === Phase 143: COUNTERFACTUAL ===
      if (op.startsWith("cf-")) {
        const r143 = evalCounterfactual(op, args, callFn);
        if (r143 !== null) return r143;
      }

      // === Phase 146: ALIGN ===
      if (op.startsWith("align-")) {
        const r146 = evalAlign(op, args);
        if (r146 !== null) return r146;
      }


      // === Phase 142: CAUSAL (inline) ===
      if (op === 'causal-add-node') {
        const kw142: Record<string, any> = {};
        for (let i = 0; i < args.length - 1; i += 2) {
          const key = String(args[i]).replace(/^:/, '');
          kw142[key] = args[i + 1];
        }
        const node142 = { id: String(kw142['id'] ?? ''), name: String(kw142['name'] ?? kw142['id'] ?? ''), description: String(kw142['desc'] ?? kw142['description'] ?? ''), value: kw142['value'] !== undefined ? Number(kw142['value']) : undefined };
        globalCausal.addNode(node142);
        return new Map<string, any>([['id', node142.id], ['name', node142.name], ['description', node142.description]]);
      }
      if (op === 'causal-add-edge') {
        const kw142e: Record<string, any> = {};
        for (let i = 0; i < args.length - 1; i += 2) {
          const key = String(args[i]).replace(/^:/, '');
          kw142e[key] = args[i + 1];
        }
        const edge142 = { from: String(kw142e['from'] ?? ''), to: String(kw142e['to'] ?? ''), strength: Number(kw142e['strength'] ?? 1), confidence: Number(kw142e['confidence'] ?? 1), delay: kw142e['delay'] !== undefined ? Number(kw142e['delay']) : undefined, mechanism: kw142e['mechanism'] !== undefined ? String(kw142e['mechanism']) : undefined };
        globalCausal.addEdge(edge142);
        return new Map<string, any>([['from', edge142.from], ['to', edge142.to], ['strength', edge142.strength], ['confidence', edge142.confidence]]);
      }
      if (op === 'causal-explain') {
        const expl142 = globalCausal.explain(String(args[0] ?? ''));
        return new Map<string, any>([
          ['effect', expl142.effect], ['primaryCause', expl142.primaryCause],
          ['explanation', expl142.explanation], ['confidence', expl142.confidence],
          ['causes', expl142.causes.map((c: any) => new Map<string, any>([
            ['cause', c.cause], ['contribution', c.contribution],
            ['chain', new Map<string, any>([
              ['path', c.chain.path], ['totalStrength', c.chain.totalStrength],
              ['explanation', c.chain.explanation], ['confidence', c.chain.confidence],
            ])],
          ]))],
        ]);
      }
      if (op === 'causal-chains') { const ch142 = globalCausal.findCausalChains(String(args[0] ?? ''), String(args[1] ?? '')); return ch142.map((c: any) => new Map<string, any>([['path', c.path], ['totalStrength', c.totalStrength], ['explanation', c.explanation], ['confidence', c.confidence]])); }
      if (op === 'causal-causes') { return globalCausal.getDirectCauses(String(args[0] ?? '')).map((e: any) => new Map<string, any>([['from', e.from], ['to', e.to], ['strength', e.strength], ['confidence', e.confidence]])); }
      if (op === 'causal-effects') { return globalCausal.getDirectEffects(String(args[0] ?? '')).map((e: any) => new Map<string, any>([['from', e.from], ['to', e.to], ['strength', e.strength], ['confidence', e.confidence]])); }
      if (op === 'causal-roots') { return globalCausal.findRootCauses(String(args[0] ?? '')); }
      if (op === 'causal-simulate') { const arg142 = args[0]; const iv142: Record<string, number> = {}; if (arg142 instanceof Map) { for (const [k, v] of arg142.entries()) iv142[String(k)] = Number(v); } return new Map<string, any>(Object.entries(globalCausal.simulate(iv142))); }
      if (op === 'causal-why') { const chain142 = whyCaused(String(args[0] ?? ''), String(args[1] ?? '')); if (chain142 === null) return null; return new Map<string, any>([['path', chain142.path], ['totalStrength', chain142.totalStrength], ['explanation', chain142.explanation], ['confidence', chain142.confidence]]); }
      if (op === 'causal-summary') { return globalCausal.summarize(String(args[0] ?? '')); }


      // === Phase 144: PREDICT ===
      if (op.startsWith("predict-")) {
        const r144 = evalPredict_PHASE144(op, args);
        if (r144 !== null) return r144;
      }

      // === Phase 148: CURIOSITY ===
      if (op.startsWith("curiosity-")) {
        const r148 = evalCuriosity(op, args, callFn);
        if (r148 !== null) return r148;
      }

      // === Phase 149: WISDOM ===
      if (op.startsWith("wisdom-")) {
        const r149 = evalWisdom(op, args);
        if (r149 !== null) return r149;
      }

      // === Phase 145: EXPLAIN ===
      if (op.startsWith("explain-")) {
        const r145 = evalExplain_PHASE145(op, args, callFnVal);
        if (r145 !== null) return r145;
      }

      // === Phase A-2: File/HTTP builtins ===
      switch (normalizedOp) {
        case "file-mkdir": case "file_mkdir": {
          const dirPath = String(args[0] ?? "");
          const fs = require("fs");
          try {
            fs.mkdirSync(dirPath, { recursive: true });
            return true;
          } catch {
            return false;
          }
        }
        case "http-get": case "http_get": {
          const url = String(args[0] ?? "");
          try {
            const { execSync } = require("child_process");
            const { writeFileSync, unlinkSync } = require("fs");
            const { randomUUID } = require("crypto");
            const tmpFile = `/tmp/fl-http-${randomUUID()}.js`;
            const nodeScript = `process.env.FL_URL=${JSON.stringify(url)};
const u=require('url').parse(process.env.FL_URL);
const mod=u.protocol==='https:'?require('https'):require('http');
const chunks=[];
const req=mod.request({hostname:u.hostname,port:u.port||undefined,path:u.path||'/',method:'GET'},res=>{
  res.on('data',d=>chunks.push(d));
  res.on('end',()=>{process.stdout.write(JSON.stringify({s:res.statusCode,b:Buffer.concat(chunks).toString()}))});
});
req.on('error',e=>process.stdout.write(JSON.stringify({s:0,b:'',e:e.message})));
req.setTimeout(10000,()=>{req.destroy();process.stdout.write(JSON.stringify({s:0,b:'',e:'timeout'}))});
req.end();`;
            writeFileSync(tmpFile, nodeScript, "utf-8");
            const result = execSync(`node ${tmpFile}`, { encoding: "utf-8", timeout: 15000 });
            try { unlinkSync(tmpFile); } catch {}
            const parsed = JSON.parse(result);
            return { status: parsed.s || 0, body: parsed.b || "", headers: {} };
          } catch (e: any) {
            return { status: 0, body: "", headers: {}, error: e.message };
          }
        }
        case "now-iso": case "now_iso": {
          return new Date().toISOString();
        }
        // AI-First #5: (help "keyword") — 런타임 함수 검색
        case "help": {
          const query = String(args[0] ?? "").toLowerCase();
          let sigs: Array<{module:string;name:string;params:string;returns:string}> = [];
          try { sigs = require("./_stdlib-signatures.json"); } catch { sigs = []; }
          if (sigs.length === 0) {
            console.log("⚠️  stdlib 시그니처 없음 — npm run build 실행 필요");
            return null;
          }
          if (!query) {
            const modules = [...new Set(sigs.map((s:any) => s.module))].sort();
            console.log(`\x1b[36m[help]\x1b[0m 카테고리: ${modules.join(", ")}`);
            console.log(`사용법: (help "keyword")  예: (help "server"), (help "file"), (help "str")`);
            return null;
          }
          const exact = sigs.filter((s:any) => s.name === query || s.name.replace(/-/g,"_") === query);
          const partial = sigs.filter((s:any) =>
            s.name !== query &&
            s.name.replace(/-/g,"_") !== query &&
            (s.name.toLowerCase().includes(query) || s.module.toLowerCase().includes(query))
          ).slice(0, 15);
          const results = [...exact, ...partial];
          if (results.length === 0) {
            console.log(`\x1b[33m[help]\x1b[0m '${query}' 검색 결과 없음`);
            return null;
          }
          console.log(`\x1b[36m[help]\x1b[0m '${query}' 검색 결과 ${results.length}개:`);
          for (const s of results) {
            const tag = exact.includes(s) ? "\x1b[32m●\x1b[0m" : " ";
            console.log(`  ${tag} \x1b[1m${s.name}\x1b[0m (${s.params || "-"}) → ${s.returns || "any"}`);
          }
          return null;
        }
      }

      // Phase 59: callUserFunction을 통해 FunctionNotFoundError(유사 함수 힌트 포함) 발생
      return callUser(op, args);
    }
  }
}

