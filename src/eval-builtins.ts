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

// Phase L1.5: Module Cache Layer (비활성화)
// NOTE: Global cache causes issues with multiple interpreter instances
// Each interpreter should manage its own module cache to avoid cross-interpreter conflicts
// TODO: Move MODULE_CACHE to per-interpreter context
const MODULE_CACHE_DISABLED = true;
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
  switch (op) {
    case "+": return vals.reduce((a: number, b: number) => a + b, 0);
    case "-": return vals.length === 1 ? -v0 : vals.reduce((a: number, b: number) => a - b);
    case "*": return vals.reduce((a: number, b: number) => a * b, 1);
    case "/": return vals.length === 1 ? 1 / v0 : vals.reduce((a: number, b: number) => a / b);
    case "%": return v0 % v1;
    case "=": return v0 === v1;
    case "!=": return v0 !== v1;
    case "<": return v0 < v1;
    case ">": return v0 > v1;
    case "<=": return v0 <= v1;
    case ">=": return v0 >= v1;
    case "not": return !v0;
    case "nil?": case "null?": return v0 === null || v0 === undefined;
    case "nil-or-empty?": return v0 === null || v0 === undefined || (v0 && v0.length === 0);
    case "true?": return v0 === true;
    case "false?": return v0 === false;
    case "and": return !!(v0 && v1);
    case "or": return !!(v0 || v1);
