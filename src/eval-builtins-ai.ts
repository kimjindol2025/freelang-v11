// eval-builtins-ai.ts — AI Phase 함수들 분리 모듈
// Phase 137: REFACTOR-SELF
// Phase 141: WORLD-MODEL
// Phase 143: COUNTERFACTUAL
// Phase 144: PREDICT
// Phase 145: EXPLAIN
// Phase 146: ALIGN
// Phase 147: ETHICS-CHECK
// Phase 148: CURIOSITY
// Phase 149: WISDOM
// (eval-builtins.ts에서 lines 5162-6793 분리)

import { Interpreter } from "./interpreter";
import { PruneResult } from "./prune";
import { SelfRefactorer, globalRefactorer, RefactorSuggestion, RefactorResult } from "./refactor-self";
import { AlignmentSystem, globalAlignment, Goal, Value, Action } from "./align";
import { globalEthics, EthicsChecker, EthicsViolation, EthicsCheckResult, EthicsPrinciple, EthicsFramework } from "./ethics-check";
import { CuriosityEngine, globalCuriosity, KnowledgeGap, ExplorationResult, CuriosityState } from "./curiosity";
import { WisdomEngine, globalWisdom, Experience, Heuristic, WisdomJudgment } from "./wisdom";
import { CausalGraph, globalCausal, CausalNode, CausalEdge, CausalChain, CausalExplanation, whyCaused } from "./causal";
import { globalExplainer, DecisionExplanation, FeatureImportance, LocalExplanation } from "./explain";
import { globalWorldModel } from "./world-model";
import { globalCounterfactual, CounterfactualReasoner, Scenario } from "./counterfactual";
import { globalPredictor } from "./predict";
import { SelfBenchmark, globalBenchmark, BenchmarkResult, ComparisonResult, BenchmarkSuite } from "./benchmark-self";

// Phase 136: PruneResult → Map 변환 헬퍼
function pruneResultToMap<T>(result: PruneResult<T>): Map<string, any> {
  const statsMap = new Map<string, any>([
    ["originalCount", result.stats.originalCount],
    ["keptCount", result.stats.keptCount],
    ["removedCount", result.stats.removedCount],
    ["avgFitnessKept", result.stats.avgFitnessKept],
    ["avgFitnessRemoved", result.stats.avgFitnessRemoved],
  ]);
  return new Map<string, any>([
    ["kept", result.kept],
    ["removed", result.removed],
    ["keptRatio", result.keptRatio],
    ["strategy", result.strategy],
    ["stats", statsMap],
  ]);
}

// === Phase 137: REFACTOR-SELF 독립 헬퍼 ===
// (eval-builtins.ts 내 switch 블록 외부에서 refactor-* op 처리를 위해 export)
export function evalRefactorSelf(op: string, args: any[]): any | null {
  if (op === "refactor-analyze") {
    const code = String(args[0] ?? "");
    const result = globalRefactorer.refactor(code, true);
    return new Map<string, any>([
      ["suggestions", result.suggestions.map((s: RefactorSuggestion) => new Map<string, any>([
        ["pattern", s.pattern], ["location", s.location], ["original", s.original],
        ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
      ]))],
      ["applied", result.applied],
      ["skipped", result.skipped],
      ["score", new Map<string, any>([
        ["before", result.score.before], ["after", result.score.after], ["improvement", result.score.improvement],
      ])],
    ]);
  }
  if (op === "refactor-suggest") {
    const code = String(args[0] ?? "");
    return globalRefactorer.suggest(code).map((s: RefactorSuggestion) => new Map<string, any>([
      ["pattern", s.pattern], ["location", s.location], ["original", s.original],
      ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
    ]));
  }
  if (op === "refactor-apply") {
    const code = String(args[0] ?? "");
    const rawSuggestions = Array.isArray(args[1]) ? args[1] : [];
    const suggestions: RefactorSuggestion[] = rawSuggestions.map((s: any) => {
      if (s instanceof Map) return {
        pattern: s.get("pattern") ?? "extract-duplicate", location: s.get("location") ?? "",
        original: s.get("original") ?? "", suggested: s.get("suggested") ?? "",
        reason: s.get("reason") ?? "", impact: s.get("impact") ?? "low",
      } as RefactorSuggestion;
      return s as RefactorSuggestion;
    });
    const applyResult = globalRefactorer.apply(code, suggestions);
    return new Map<string, any>([
      ["code", applyResult.code],
      ["applied", applyResult.applied.map((s: RefactorSuggestion) => new Map<string, any>([
        ["pattern", s.pattern], ["location", s.location], ["impact", s.impact],
      ]))],
    ]);
  }
  if (op === "refactor-complexity") {
    const code = String(args[0] ?? "");
    const c = globalRefactorer.analyzeComplexity(code);
    return new Map<string, any>([["lines", c.lines], ["depth", c.depth], ["conditions", c.conditions], ["score", c.score]]);
  }
  if (op === "refactor-quality") {
    const code = String(args[0] ?? "");
    return globalRefactorer.qualityScore(code);
  }
  if (op === "refactor-naming") {
    const code = String(args[0] ?? "");
    const n = globalRefactorer.analyzeNaming(code);
    return new Map<string, any>([
      ["issues", n.issues.map((i: { name: string; suggestion: string; reason: string }) => new Map<string, any>([
        ["name", i.name], ["suggestion", i.suggestion], ["reason", i.reason],
      ]))],
      ["score", n.score],
    ]);
  }
  if (op === "refactor-duplicates") {
    const code = String(args[0] ?? "");
    return globalRefactorer.findDuplicates(code).map((s: RefactorSuggestion) => new Map<string, any>([
      ["pattern", s.pattern], ["location", s.location], ["original", s.original],
      ["suggested", s.suggested], ["reason", s.reason], ["impact", s.impact],
    ]));
  }
  if (op === "refactor-score") {
    const r = args[0];
    if (r instanceof Map) {
      const score = r.get("score");
      if (score instanceof Map) return new Map<string, any>([
        ["before", score.get("before") ?? 0], ["after", score.get("after") ?? 0], ["improvement", score.get("improvement") ?? 0],
      ]);
    }
    return new Map<string, any>([["before", 0], ["after", 0], ["improvement", 0]]);
  }
  // === Phase 142: CAUSAL ===
  // (causal-add-node :id "rain" :name "비" :desc "강수")
  if (op === "causal-add-node") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const node: CausalNode = {
      id: String(kw["id"] ?? ""),
      name: String(kw["name"] ?? kw["id"] ?? ""),
      description: String(kw["desc"] ?? kw["description"] ?? ""),
      value: kw["value"] !== undefined ? Number(kw["value"]) : undefined,
    };
    globalCausal.addNode(node);
    return new Map<string, any>([["id", node.id], ["name", node.name], ["description", node.description]]);
  }

  // (causal-add-edge :from "rain" :to "wet-road" :strength 0.9 :confidence 0.95)
  if (op === "causal-add-edge") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const edge: CausalEdge = {
      from: String(kw["from"] ?? ""),
      to: String(kw["to"] ?? ""),
      strength: Number(kw["strength"] ?? 1),
      confidence: Number(kw["confidence"] ?? 1),
      delay: kw["delay"] !== undefined ? Number(kw["delay"]) : undefined,
      mechanism: kw["mechanism"] !== undefined ? String(kw["mechanism"]) : undefined,
    };
    globalCausal.addEdge(edge);
    return new Map<string, any>([["from", edge.from], ["to", edge.to], ["strength", edge.strength], ["confidence", edge.confidence]]);
  }

  // (causal-explain "wet-road") → CausalExplanation
  if (op === "causal-explain") {
    const effectId = String(args[0] ?? "");
    const expl = globalCausal.explain(effectId);
    return new Map<string, any>([
      ["effect", expl.effect],
      ["primaryCause", expl.primaryCause],
      ["explanation", expl.explanation],
      ["confidence", expl.confidence],
      ["causes", expl.causes.map(c => new Map<string, any>([
        ["cause", c.cause], ["contribution", c.contribution],
        ["chain", new Map<string, any>([
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
    const chains = globalCausal.findCausalChains(causeId, effectId);
    return chains.map(c => new Map<string, any>([
      ["path", c.path], ["totalStrength", c.totalStrength],
      ["explanation", c.explanation], ["confidence", c.confidence],
    ]));
  }

  // (causal-causes "wet-road") → 직접 원인들
  if (op === "causal-causes") {
    const nodeId = String(args[0] ?? "");
    const causes = globalCausal.getDirectCauses(nodeId);
    return causes.map(e => new Map<string, any>([
      ["from", e.from], ["to", e.to], ["strength", e.strength], ["confidence", e.confidence],
    ]));
  }

  // (causal-effects "rain") → 직접 결과들
  if (op === "causal-effects") {
    const nodeId = String(args[0] ?? "");
    const effects = globalCausal.getDirectEffects(nodeId);
    return effects.map(e => new Map<string, any>([
      ["from", e.from], ["to", e.to], ["strength", e.strength], ["confidence", e.confidence],
    ]));
  }

  // (causal-roots "accident") → 루트 원인들
  if (op === "causal-roots") {
    const nodeId = String(args[0] ?? "");
    return globalCausal.findRootCauses(nodeId);
  }

  // (causal-simulate {:rain 1.0}) → 파급효과 맵
  if (op === "causal-simulate") {
    const arg = args[0];
    const interventions: Record<string, number> = {};
    if (arg instanceof Map) {
      for (const [k, v] of arg.entries()) {
        interventions[String(k)] = Number(v);
      }
    }
    const result = globalCausal.simulate(interventions);
    return new Map<string, any>(Object.entries(result));
  }

  // (causal-why "effect-id" "cause-id") → CausalChain or nil
  if (op === "causal-why") {
    const effectId = String(args[0] ?? "");
    const causeId = String(args[1] ?? "");
    const chain = whyCaused(effectId, causeId);
    if (chain === null) return null;
    return new Map<string, any>([
      ["path", chain.path], ["totalStrength", chain.totalStrength],
      ["explanation", chain.explanation], ["confidence", chain.confidence],
    ]);
  }

  // (causal-summary "rain") → 요약 문자열
  if (op === "causal-summary") {
    const nodeId = String(args[0] ?? "");
    return globalCausal.summarize(nodeId);
  }

  return null;
}
// === Phase 146: ALIGN ===
export function evalAlign(op: string, args: any[]): any | null {
  // (align-add-goal :id "g1" :desc "설명" :priority 9 :measurable true :metric "m" :target 100)
  if (op === "align-add-goal") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const goal: Goal = {
      id: String(kw["id"] ?? `goal_${Date.now()}`),
      description: String(kw["desc"] ?? kw["description"] ?? ""),
      priority: Number(kw["priority"] ?? 5),
      measurable: Boolean(kw["measurable"] ?? false),
      metric: kw["metric"] !== undefined ? String(kw["metric"]) : undefined,
      target: kw["target"] !== undefined ? Number(kw["target"]) : undefined,
    };
    globalAlignment.addGoal(goal);
    return new Map<string, any>([
      ["id", goal.id], ["description", goal.description],
      ["priority", goal.priority], ["measurable", goal.measurable],
    ]);
  }

  // (align-add-value :id "v1" :name "정직" :desc "거짓말 안 함" :weight 0.9)
  if (op === "align-add-value") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const value: Value = {
      id: String(kw["id"] ?? `value_${Date.now()}`),
      name: String(kw["name"] ?? ""),
      description: String(kw["desc"] ?? kw["description"] ?? ""),
      weight: Number(kw["weight"] ?? 0.5),
    };
    globalAlignment.addValue(value);
    return new Map<string, any>([
      ["id", value.id], ["name", value.name],
      ["description", value.description], ["weight", value.weight],
    ]);
  }

  // (align-score $action) → AlignmentScore
  if (op === "align-score") {
    const actionRaw = args[0];
    // FL map은 Map 또는 일반 object를 반환할 수 있음
    const _getF = (obj: any, key: string): any => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
    const _getEO = (obj: any): Record<string, number> => {
      const eo = _getF(obj, "expectedOutcomes");
      if (eo instanceof Map) return Object.fromEntries(eo);
      if (eo && typeof eo === "object") return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
      return {};
    };
    const action: Action = {
      id: String(_getF(actionRaw, "id") ?? ""),
      description: String(_getF(actionRaw, "description") ?? ""),
      expectedOutcomes: _getEO(actionRaw),
      risks: Array.isArray(_getF(actionRaw, "risks")) ? _getF(actionRaw, "risks") : [],
    };
    const result = globalAlignment.score(action);
    return new Map<string, any>([
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
    const _getF2 = (obj: any, key: string): any => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
    const _getEO2 = (obj: any): Record<string, number> => {
      const eo = _getF2(obj, "expectedOutcomes");
      if (eo instanceof Map) return Object.fromEntries(eo);
      if (eo && typeof eo === "object") return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
      return {};
    };
    const actions: Action[] = actionsList.map((m: any) => ({
      id: String(_getF2(m, "id") ?? ""),
      description: String(_getF2(m, "description") ?? ""),
      expectedOutcomes: _getEO2(m),
      risks: Array.isArray(_getF2(m, "risks")) ? _getF2(m, "risks") : [],
    }));
    if (actions.length === 0) return null;
    const best = globalAlignment.selectBestAligned(actions);
    return new Map<string, any>([
      ["id", best.id], ["description", best.description],
    ]);
  }

  // (align-conflicts) → 충돌 목록
  if (op === "align-conflicts") {
    const conflicts = globalAlignment.detectConflicts();
    return conflicts.map(c => new Map<string, any>([
      ["goal1", c.goal1], ["goal2", c.goal2], ["description", c.description],
    ]));
  }

  // (align-plan $actions) → 계획 평가
  if (op === "align-plan") {
    const actionsList = Array.isArray(args[0]) ? args[0] : [];
    const _gFP = (obj: any, key: string): any => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
    const _gEOP = (obj: any): Record<string, number> => {
      const eo = _gFP(obj, "expectedOutcomes");
      if (eo instanceof Map) return Object.fromEntries(eo);
      if (eo && typeof eo === "object") return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
      return {};
    };
    const actions: Action[] = actionsList.map((m: any) => ({
      id: String(_gFP(m, "id") ?? ""),
      description: String(_gFP(m, "description") ?? ""),
      expectedOutcomes: _gEOP(m),
      risks: Array.isArray(_gFP(m, "risks")) ? _gFP(m, "risks") : [],
    }));
    const result = globalAlignment.evaluatePlan(actions);
    return new Map<string, any>([
      ["overallAlignment", result.overallAlignment],
      ["weakLinks", result.weakLinks.map(a => new Map([["id", a.id], ["description", a.description]]))],
      ["summary", result.summary],
    ]);
  }

  // (align-improve $action) → 개선 제안 목록
  if (op === "align-improve") {
    const actionRaw3 = args[0];
    const _getF3 = (obj: any, key: string): any => obj instanceof Map ? obj.get(key) : (obj && typeof obj === "object" ? obj[key] : undefined);
    const _getEO3 = (obj: any): Record<string, number> => {
      const eo = _getF3(obj, "expectedOutcomes");
      if (eo instanceof Map) return Object.fromEntries(eo);
      if (eo && typeof eo === "object") return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, Number(v)]));
      return {};
    };
    const action: Action = {
      id: String(_getF3(actionRaw3, "id") ?? ""),
      description: String(_getF3(actionRaw3, "description") ?? ""),
      expectedOutcomes: _getEO3(actionRaw3),
      risks: Array.isArray(_getF3(actionRaw3, "risks")) ? _getF3(actionRaw3, "risks") : [],
    };
    return globalAlignment.suggestImprovements(action);
  }

  // (align-goals) → 우선순위 정렬된 Goal 목록
  if (op === "align-goals") {
    const goals = globalAlignment.prioritizeGoals();
    return goals.map(g => new Map<string, any>([
      ["id", g.id], ["description", g.description],
      ["priority", g.priority], ["measurable", g.measurable],
    ]));
  }

  return null;
}

// NOTE: Phase 144 code below is in separate evalPredict (called by evalBuiltin)
export function evalPredict_PHASE144(op: string, args: any[]): any | null {
  // === Phase 144: PREDICT ===
  // (predict-linear [1 2 3 4 5] :horizon 3) → Prediction
  if (op === "predict-linear") {
    const data144 = Array.isArray(args[0]) ? args[0].map(Number) : [];
    let horizon144 = 1;
    for (let i = 1; i < args.length - 1; i += 2) {
      const k = String(args[i]).replace(/^:/, "");
      if (k === "horizon") horizon144 = Number(args[i + 1]);
    }
    const p144 = globalPredictor.linearRegression(data144, horizon144);
    return new Map<string, any>([
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
      if (k === "window") window144 = Number(args[i + 1]);
      else if (k === "horizon") horizon144ma = Number(args[i + 1]);
    }
    const pma = globalPredictor.movingAverage(data144ma, window144, horizon144ma);
    return new Map<string, any>([
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
      if (k === "alpha") alpha144 = Number(args[i + 1]);
      else if (k === "horizon") horizon144exp = Number(args[i + 1]);
    }
    const pexp = globalPredictor.exponentialSmoothing(data144exp, alpha144, horizon144exp);
    return new Map<string, any>([
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
      if (k === "steps") steps144 = Number(args[i + 1]);
    }
    const tsResult = globalPredictor.forecastTimeSeries(data144ts, steps144);
    return new Map<string, any>([
      ["predictions", tsResult.predictions.map(p => new Map<string, any>([
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
      if (k === "confidence") conf144 = Number(args[i + 1]);
    }
    const ci = globalPredictor.confidenceInterval(samples144, conf144);
    return new Map<string, any>([["lower", ci.lower], ["upper", ci.upper]]);
  }

  // (predict-classify {:age 25 :income 50000} $training) → ClassificationPrediction
  if (op === "predict-classify") {
    const rawFeatures = args[0];
    const features144: Record<string, number> = {};
    if (rawFeatures instanceof Map) {
      rawFeatures.forEach((v: any, k: any) => {
        features144[String(k).replace(/^:/, "")] = Number(v);
      });
    } else if (typeof rawFeatures === "object" && rawFeatures !== null) {
      Object.entries(rawFeatures).forEach(([k, v]) => {
        features144[k.replace(/^:/, "")] = Number(v);
      });
    }
    const rawTraining = Array.isArray(args[1]) ? args[1] : [];
    const trainingData144 = rawTraining.map((item: any) => {
      if (item instanceof Map) {
        const rawF = item.get("features") ?? item.get(":features");
        const label = String(item.get("label") ?? item.get(":label") ?? "unknown");
        const feats: Record<string, number> = {};
        if (rawF instanceof Map) {
          rawF.forEach((v: any, k: any) => { feats[String(k).replace(/^:/, "")] = Number(v); });
        }
        return { features: feats, label };
      }
      return { features: {}, label: "unknown" };
    });
    const clf = globalPredictor.classify(features144, trainingData144);
    return new Map<string, any>([
      ["classes", clf.classes.map(c => new Map<string, any>([["label", c.label], ["probability", c.probability]]))],
      ["predicted", clf.predicted],
      ["confidence", clf.confidence],
    ]);
  }

  // (predict-evaluate [1 2 3] [1.1 2.2 2.9]) → {mae, rmse, mape}
  if (op === "predict-evaluate") {
    const preds144 = Array.isArray(args[0]) ? args[0].map(Number) : [];
    const actuals144 = Array.isArray(args[1]) ? args[1].map(Number) : [];
    const evalResult = globalPredictor.evaluate(preds144, actuals144);
    return new Map<string, any>([
      ["mae", evalResult.mae], ["rmse", evalResult.rmse], ["mape", evalResult.mape],
    ]);
  }

  // (predict-trend [1 2 3 4 5]) → "up"/"down"/"flat"/"volatile"
  if (op === "predict-trend") {
    const data144tr = Array.isArray(args[0]) ? args[0].map(Number) : [];
    return globalPredictor.detectTrend(data144tr);
  }


  return null;
}


// === Phase 148: CURIOSITY ===
export function evalCuriosity(op: string, args: any[], callFn?: (fn: any, a: any[]) => any): any | null {
  // (curiosity-score "주제" ["알려진것1" "알려진것2"]) → 0~1 호기심 점수
  if (op === "curiosity-score") {
    const topic = String(args[0] ?? "");
    const knownFacts: string[] = Array.isArray(args[1])
      ? args[1].map((f: any) => String(f))
      : [];
    return globalCuriosity.computeCuriosity(topic, knownFacts);
  }

  // (curiosity-next) → 다음 탐색 주제 or null
  if (op === "curiosity-next") {
    return globalCuriosity.selectNextTopic();
  }

  // (curiosity-explore "주제" $explorer-fn) → ExplorationResult as Map
  if (op === "curiosity-explore") {
    const topic = String(args[0] ?? "");
    const fn = args[1];
    const explorerFunc = (t: string) => {
      const result = callFn ? callFn(fn, [t]) : (typeof fn === "function" ? fn(t) : null);
      if (result instanceof Map) {
        const facts = Array.isArray(result.get("facts")) ? result.get("facts").map(String) : [];
        const questions = Array.isArray(result.get("questions")) ? result.get("questions").map(String) : [];
        return { facts, questions };
      }
      return { facts: [], questions: [] };
    };
    const res: ExplorationResult = globalCuriosity.explore(topic, explorerFunc);
    return new Map<string, any>([
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
    const known: string[] = Array.isArray(args[0]) ? args[0].map((s: any) => String(s)) : [];
    const all: string[] = Array.isArray(args[1]) ? args[1].map((s: any) => String(s)) : [];
    const gaps: KnowledgeGap[] = globalCuriosity.identifyGaps(known, all);
    return gaps.map((g: KnowledgeGap) => new Map<string, any>([
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
    const context: string[] = Array.isArray(args[1]) ? args[1].map((s: any) => String(s)) : [];
    return globalCuriosity.generateQuestions(topic, context);
  }

  // (curiosity-prioritize ["주제1" "주제2" "주제3"]) → 우선순위 정렬된 배열
  if (op === "curiosity-prioritize") {
    const topics: string[] = Array.isArray(args[0]) ? args[0].map((s: any) => String(s)) : [];
    return globalCuriosity.prioritize(topics);
  }

  // (curiosity-analyze) → 탐색 이력 분석 Map
  if (op === "curiosity-analyze") {
    const analysis = globalCuriosity.analyzeExplorationHistory();
    return new Map<string, any>([
      ["totalExplored", analysis.totalExplored],
      ["avgInfoGain", analysis.avgInfoGain],
      ["mostSurprising", analysis.mostSurprising],
      ["recommendations", analysis.recommendations],
    ]);
  }

  // (curiosity-state) → CuriosityState as Map
  if (op === "curiosity-state") {
    const st: CuriosityState = globalCuriosity.getState();
    return new Map<string, any>([
      ["explored", Array.from(st.explored)],
      ["frontier", st.frontier],
      ["knowledgeGaps", st.knowledgeGaps.map((g: KnowledgeGap) => new Map<string, any>([
        ["topic", g.topic],
        ["unknownAspects", g.unknownAspects],
        ["priority", g.priority],
        ["explorationCost", g.explorationCost],
        ["expectedGain", g.expectedGain],
      ]))],
      ["curiosityScore", st.curiosityScore],
      ["explorationHistory", st.explorationHistory.map(h => new Map<string, any>([
        ["topic", h.topic],
        ["gain", h.gain],
        ["timestamp", h.timestamp.toISOString()],
      ]))],
    ]);
  }

  // === Phase 149: WISDOM ===
  // (wisdom-add-exp :situation "..." :action "..." :outcome "..." :lesson "..." :success true :importance 0.8 :domain "engineering")
  if (op === "wisdom-add-exp") {
    const kwargs: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kwargs[key] = args[i + 1];
    }
    const exp = globalWisdom.addExperience({
      situation: String(kwargs["situation"] ?? ""),
      action: String(kwargs["action"] ?? ""),
      outcome: String(kwargs["outcome"] ?? ""),
      lesson: String(kwargs["lesson"] ?? ""),
      success: kwargs["success"] === true || kwargs["success"] === "true",
      importance: typeof kwargs["importance"] === "number" ? kwargs["importance"] : 0.5,
      domain: String(kwargs["domain"] ?? "general"),
    });
    return new Map<string, any>([
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
    const judgment = globalWisdom.judge(situation);
    return new Map<string, any>([
      ["situation", judgment.situation],
      ["recommendation", judgment.recommendation],
      ["reasoning", judgment.reasoning],
      ["relevantExperiences", judgment.relevantExperiences.map(e => new Map<string, any>([
        ["id", e.id], ["situation", e.situation], ["lesson", e.lesson],
        ["success", e.success], ["importance", e.importance], ["domain", e.domain],
      ]))],
      ["applicableHeuristics", judgment.applicableHeuristics.map(h => new Map<string, any>([
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
    return globalWisdom.getHeuristics().map(h => new Map<string, any>([
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
    const heuristics = globalWisdom.extractHeuristics();
    return heuristics.map(h => new Map<string, any>([
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
    return globalWisdom.findRelevantExperiences(situation, limit).map(e => new Map<string, any>([
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
    let domain: string | undefined;
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      if (key === "domain") domain = String(args[i + 1]);
    }
    return globalWisdom.getLessons(domain);
  }

  // (wisdom-score)
  if (op === "wisdom-score") {
    return globalWisdom.wisdomScore();
  }

  // (wisdom-domain "engineering")
  if (op === "wisdom-domain") {
    const domain = String(args[0] ?? "general");
    const summary = globalWisdom.summarizeDomain(domain);
    return new Map<string, any>([
      ["topLessons", summary.topLessons],
      ["bestHeuristics", summary.bestHeuristics.map(h => new Map<string, any>([
        ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
        ["successCount", h.successCount], ["totalCount", h.totalCount],
      ]))],
      ["successRate", summary.successRate],
    ]);
  }

  // (wisdom-valid? $experience)
  if (op === "wisdom-valid?") {
    const expMap = args[0];
    if (!(expMap instanceof Map)) return false;
    const exp: Experience = {
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
    return globalWisdom.isStillValid(exp);
  }

  // (wisdom-similar "상황")
  if (op === "wisdom-similar") {
    const situation = String(args[0] ?? "");
    return globalWisdom.findSimilarCases(situation).map(e => new Map<string, any>([
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
export function evalEthicsCheck(interp: Interpreter, op: string, args: any[]): any | null {
  const callFnVal = (fn: any, a: any[]) => (interp as any).callFunctionValue(fn, a);

  // (ethics-check "내용" {:context "의료 AI"}) → EthicsCheckResult Map
  if (op === "ethics-check") {
    const subject = String(args[0] ?? "");
    const ctx: Record<string, unknown> = {};
    if (args[1] instanceof Map) {
      for (const [k, v] of (args[1] as Map<string, unknown>).entries()) {
        ctx[String(k)] = v;
      }
    } else if (args[1] && typeof args[1] === 'object') {
      Object.assign(ctx, args[1]);
    }
    const result = globalEthics.check(subject, ctx);
    const fwMap = new Map<string, any>();
    for (const [fw, data] of Object.entries(result.frameworks)) {
      fwMap.set(fw, new Map<string, any>([["passed", data.passed], ["score", data.score]]));
    }
    return new Map<string, any>([
      ["subject", result.subject],
      ["passed", result.passed],
      ["violations", result.violations.map((v: EthicsViolation) => new Map<string, any>([
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
    const framework = String(args[1] ?? "utilitarian") as EthicsFramework;
    const result = globalEthics.checkByFramework(subject, framework);
    return new Map<string, any>([
      ["passed", result.passed],
      ["score", result.score],
      ["violations", result.violations.map((v: EthicsViolation) => new Map<string, any>([
        ["principle", v.principle], ["severity", v.severity],
        ["description", v.description], ["suggestion", v.suggestion],
        ["framework", v.framework],
      ]))],
    ]);
  }

  // (ethics-is-ethical "내용") → boolean
  if (op === "ethics-is-ethical") {
    const subject = String(args[0] ?? "");
    const ctx: Record<string, unknown> = {};
    if (args[1] instanceof Map) {
      for (const [k, v] of (args[1] as Map<string, unknown>).entries()) {
        ctx[String(k)] = v;
      }
    }
    return globalEthics.isEthical(subject, ctx);
  }

  // (ethics-add-principle :id "p1" :name "해악금지" :framework "deontological")
  if (op === "ethics-add-principle") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const principle: EthicsPrinciple = {
      id: String(kw["id"] ?? "custom-principle"),
      name: String(kw["name"] ?? "커스텀 원칙"),
      description: String(kw["description"] ?? kw["desc"] ?? ""),
      framework: (String(kw["framework"] ?? "virtue")) as EthicsFramework,
      check: typeof kw["check-fn"] === "function"
        ? (subject: string, ctx: Record<string, unknown>) => {
            const r = callFnVal(kw["check-fn"], [subject, ctx]);
            if (r instanceof Map) {
              return { passed: Boolean(r.get("passed")), reason: String(r.get("reason") ?? "") };
            }
            return { passed: Boolean(r), reason: "" };
          }
        : (_subject: string, _ctx: Record<string, unknown>) => ({ passed: true, reason: "커스텀 원칙 통과" }),
    };
    globalEthics.addPrinciple(principle);
    return new Map<string, any>([
      ["id", principle.id], ["name", principle.name],
      ["framework", principle.framework], ["description", principle.description],
    ]);
  }

  // (ethics-suggest "내용" $violations) → 윤리적 대안 문자열
  if (op === "ethics-suggest") {
    const subject = String(args[0] ?? "");
    const rawViolations = args[1];
    const violations: EthicsViolation[] = [];
    if (Array.isArray(rawViolations)) {
      for (const rv of rawViolations) {
        if (rv instanceof Map) {
          violations.push({
            principle: String(rv.get("principle") ?? ""),
            severity: (rv.get("severity") ?? "low") as EthicsViolation["severity"],
            description: String(rv.get("description") ?? ""),
            suggestion: String(rv.get("suggestion") ?? ""),
            framework: (rv.get("framework") ?? "virtue") as EthicsFramework,
          });
        }
      }
    }
    return globalEthics.suggestEthicalAlternative(subject, violations);
  }

  // (ethics-risk $result) → "none"/"low"/"medium"/"high"/"critical"
  if (op === "ethics-risk") {
    const rawResult = args[0];
    if (rawResult instanceof Map) {
      const violations: EthicsViolation[] = [];
      const rawViolations = rawResult.get("violations") ?? [];
      if (Array.isArray(rawViolations)) {
        for (const rv of rawViolations) {
          if (rv instanceof Map) {
            violations.push({
              principle: String(rv.get("principle") ?? ""),
              severity: (rv.get("severity") ?? "low") as EthicsViolation["severity"],
              description: String(rv.get("description") ?? ""),
              suggestion: String(rv.get("suggestion") ?? ""),
              framework: (rv.get("framework") ?? "virtue") as EthicsFramework,
            });
          }
        }
      }
      const result: EthicsCheckResult = {
        subject: String(rawResult.get("subject") ?? ""),
        passed: Boolean(rawResult.get("passed")),
        violations,
        score: Number(rawResult.get("score") ?? 1),
        frameworks: {} as EthicsCheckResult["frameworks"],
        recommendation: String(rawResult.get("recommendation") ?? ""),
        requiresHumanReview: Boolean(rawResult.get("requiresHumanReview")),
      };
      return globalEthics.riskLevel(result);
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
export function evalCounterfactual(op: string, args: any[], callFn: (fn: any, a: any[]) => any): any {
  // (cf-scenario :id "s1" :name "비오는날" :vars {:rain true :speed 60} :outcome "accident")
  if (op === "cf-scenario") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kw[key] = args[i + 1];
    }
    const id = String(kw["id"] ?? `s-${Date.now()}`);
    const name = String(kw["name"] ?? id);
    let variables: Record<string, unknown> = {};
    if (kw["vars"] instanceof Map) {
      for (const [k, v] of kw["vars"]) variables[String(k).replace(/^:/, "")] = v;
    } else if (kw["vars"] && typeof kw["vars"] === "object") {
      variables = kw["vars"] as Record<string, unknown>;
    }
    const outcome = kw["outcome"] ?? null;
    const scenario: Scenario = { id, name, variables, outcome };
    globalCounterfactual.registerScenario(scenario);
    return new Map<string, any>([
      ["id", id], ["name", name],
      ["variables", new Map(Object.entries(variables))],
      ["outcome", outcome],
    ]);
  }

  // (cf-what-if $vars $change $outcome-fn)
  if (op === "cf-what-if") {
    let variables: Record<string, unknown> = {};
    let change: Record<string, unknown> = {};
    if (args[0] instanceof Map) {
      for (const [k, v] of (args[0] as Map<any,any>)) variables[String(k).replace(/^:/, "")] = v;
    }
    if (args[1] instanceof Map) {
      for (const [k, v] of (args[1] as Map<any,any>)) change[String(k).replace(/^:/, "")] = v;
    }
    const fn = args[2];
    const outcomeFunc = (vars: Record<string, unknown>) => callFn(fn, [new Map(Object.entries(vars))]);
    const cf = globalCounterfactual.whatIf(variables, change, outcomeFunc);
    return new Map<string, any>([
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
    const interventionsList: Array<Record<string, unknown>> = [];
    if (Array.isArray(args[1])) {
      for (const iv of args[1]) {
        const obj: Record<string, unknown> = {};
        if (iv instanceof Map) {
          for (const [k, v] of (iv as Map<any,any>)) obj[String(k).replace(/^:/, "")] = v;
        }
        interventionsList.push(obj);
      }
    }
    const fn = args[2];
    const outcomeFunc = (vars: Record<string, unknown>) => callFn(fn, [new Map(Object.entries(vars))]);
    const analysis = globalCounterfactual.analyze(scenarioId, interventionsList, outcomeFunc);
    return new Map<string, any>([
      ["original", new Map<string, any>([
        ["id", analysis.original.id], ["name", analysis.original.name], ["outcome", analysis.original.outcome],
      ])],
      ["counterfactuals", analysis.counterfactuals.map(cf => new Map<string, any>([
        ["id", cf.id], ["probability", cf.probability], ["counterfactualOutcome", cf.counterfactualOutcome],
        ["explanation", cf.explanation],
      ]))],
      ["mostLikelyAlternative", new Map<string, any>([
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
    const outcomeFunc = (vars: Record<string, unknown>) => callFn(fn, [new Map(Object.entries(vars))]);
    const minimal = globalCounterfactual.findMinimalIntervention(scenarioId, targetOutcome, outcomeFunc);
    if (minimal === null) return null;
    return new Map(Object.entries(minimal));
  }

  // (cf-sensitivity $vars $fn)
  if (op === "cf-sensitivity") {
    let variables: Record<string, unknown> = {};
    const rawVars = args[0];
    if (rawVars instanceof Map) {
      for (const [k, v] of (rawVars as Map<any,any>)) variables[String(k).replace(/^:/, "")] = v;
    } else if (rawVars && typeof rawVars === "object" && !Array.isArray(rawVars)) {
      // FL {: } map literal은 plain object로 평가됨
      for (const [k, v] of Object.entries(rawVars)) variables[String(k).replace(/^:/, "")] = v;
    }
    const fn = args[1];
    // FL imm-get은 plain object m[k]를 사용하므로 plain object로 전달
    const outcomeFunc = (vars: Record<string, unknown>) => {
      try { return Number(callFn(fn, [vars as any])); } catch { return 0; }
    };
    const sens = globalCounterfactual.sensitivityAnalysis(variables, outcomeFunc);
    return new Map(Object.entries(sens));
  }

  // (cf-key-factors $analysis)
  if (op === "cf-key-factors") {
    const analysis = args[0];
    if (analysis instanceof Map) {
      const factors = (analysis as Map<any,any>).get("keyFactors");
      if (Array.isArray(factors)) return factors;
    }
    return [];
  }

  // (cf-best-alt $analysis)
  if (op === "cf-best-alt") {
    const analysis = args[0];
    if (analysis instanceof Map) {
      return (analysis as Map<any,any>).get("mostLikelyAlternative") ?? null;
    }
    return null;
  }

  // (cf-explain $counterfactual)
  if (op === "cf-explain") {
    const cf = args[0];
    if (cf instanceof Map) {
      return (cf as Map<any,any>).get("explanation") ?? "";
    }
    return "";
  }


  // === Phase 145: EXPLAIN ===

  // (explain-decision $decision {:accuracy 0.9 :speed 0.7} "context")
  if (op === "explain-decision") {
    const decision = args[0];
    const rawFactors = args[1];
    const context = args[2] !== undefined ? String(args[2]) : undefined;
    const factors: Record<string, number> = {};
    if (rawFactors instanceof Map) {
      for (const [k, v] of rawFactors.entries()) factors[String(k).replace(/^:/, "")] = Number(v);
    } else if (rawFactors && typeof rawFactors === "object") {
      for (const [k, v] of Object.entries(rawFactors)) factors[String(k).replace(/^:/, "")] = Number(v);
    }
    const explanation = globalExplainer.explain(decision, factors, context);
    return new Map<string, any>([
      ["decision", explanation.decision],
      ["reasoning", explanation.reasoning],
      ["features", explanation.features.map((f: FeatureImportance) => new Map<string, any>([
        ["feature", f.feature], ["importance", f.importance],
        ["direction", f.direction], ["description", f.description],
      ]))],
      ["confidence", explanation.confidence],
      ["alternatives", explanation.alternatives.map((a: any) => new Map<string, any>([
        ["decision", a.decision], ["reason", a.reason], ["probability", a.probability],
      ]))],
      ["summary", explanation.summary],
      ["audience", explanation.audience],
    ]);
  }

  // (explain-features {:x 1 :y 2} {:out 0.8})
  if (op === "explain-features") {
    const toRecord145 = (v: any): Record<string, number> => {
      const result: Record<string, number> = {};
      if (v instanceof Map) {
        for (const [k, val] of v.entries()) result[String(k).replace(/^:/, "")] = Number(val);
      } else if (v && typeof v === "object") {
        for (const [k, val] of Object.entries(v)) result[String(k).replace(/^:/, "")] = Number(val);
      }
      return result;
    };
    const inputs145 = toRecord145(args[0]);
    const outputs145 = toRecord145(args[1]);
    const baseline145 = args[2] !== undefined ? toRecord145(args[2]) : undefined;
    const features145 = globalExplainer.featureImportance(inputs145, outputs145, baseline145);
    return features145.map((f: FeatureImportance) => new Map<string, any>([
      ["feature", f.feature], ["importance", f.importance],
      ["direction", f.direction], ["description", f.description],
    ]));
  }

  // (explain-local {:age 25} "approved" $model)
  if (op === "explain-local") {
    const rawInput145 = args[0];
    const output145 = args[1];
    const modelFn145 = args[2];
    const input145: Record<string, unknown> = {};
    if (rawInput145 instanceof Map) {
      for (const [k, v] of rawInput145.entries()) input145[String(k).replace(/^:/, "")] = v;
    } else if (rawInput145 && typeof rawInput145 === "object") {
      for (const [k, v] of Object.entries(rawInput145)) input145[String(k).replace(/^:/, "")] = v;
    }
    const model145 = (inp: Record<string, unknown>): unknown => {
      if (modelFn145) {
        try { return callFn(modelFn145, [new Map(Object.entries(inp))]); }
        catch { return output145; }
      }
      return output145;
    };
    const local145 = globalExplainer.localExplain(input145, output145, model145);
    return new Map<string, any>([
      ["input", new Map(Object.entries(local145.input))],
      ["output", local145.output],
      ["topFactors", local145.topFactors.map((f: FeatureImportance) => new Map<string, any>([
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
    let audience145: 'technical' | 'general' = 'technical';
    for (let i = 1; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      if (key === "audience") audience145 = String(args[i + 1]) as 'technical' | 'general';
    }
    if (!(rawExpl145 instanceof Map)) return "설명을 변환할 수 없습니다";
    const featuresRaw145 = rawExpl145.get("features") ?? [];
    const features145n: FeatureImportance[] = (Array.isArray(featuresRaw145) ? featuresRaw145 : []).map((f: any) => {
      if (f instanceof Map) {
        return {
          feature: String(f.get("feature") ?? ""),
          importance: Number(f.get("importance") ?? 0),
          direction: String(f.get("direction") ?? "positive") as 'positive' | 'negative',
          description: String(f.get("description") ?? ""),
        };
      }
      return { feature: "", importance: 0, direction: "positive" as const, description: "" };
    });
    const altsRaw145 = rawExpl145.get("alternatives") ?? [];
    const alternatives145 = (Array.isArray(altsRaw145) ? altsRaw145 : []).map((a: any) => {
      if (a instanceof Map) return { decision: a.get("decision"), reason: String(a.get("reason") ?? ""), probability: Number(a.get("probability") ?? 0) };
      return { decision: null, reason: "", probability: 0 };
    });
    const explanation145n: DecisionExplanation = {
      decision: rawExpl145.get("decision"),
      reasoning: rawExpl145.get("reasoning") ?? [],
      features: features145n,
      confidence: Number(rawExpl145.get("confidence") ?? 0.5),
      alternatives: alternatives145,
      summary: String(rawExpl145.get("summary") ?? ""),
      audience: (rawExpl145.get("audience") ?? "technical") as 'technical' | 'general',
    };
    return globalExplainer.toNaturalLanguage(explanation145n, audience145);
  }

  // (explain-contrast "approved" "denied" {:score 0.8})
  if (op === "explain-contrast") {
    const decision145c = args[0];
    const alternative145c = args[1];
    const rawFactors145c = args[2];
    const factors145c: Record<string, number> = {};
    if (rawFactors145c instanceof Map) {
      for (const [k, v] of rawFactors145c.entries()) factors145c[String(k).replace(/^:/, "")] = Number(v);
    } else if (rawFactors145c && typeof rawFactors145c === "object") {
      for (const [k, v] of Object.entries(rawFactors145c)) factors145c[String(k).replace(/^:/, "")] = Number(v);
    }
    return globalExplainer.contrastiveExplain(decision145c, alternative145c, factors145c);
  }

  // (explain-rules $examples)
  if (op === "explain-rules") {
    const rawExamples145 = args[0];
    const examples145: Array<{ input: Record<string, unknown>; output: unknown }> = [];
    const toRecord145r = (v: any): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      if (v instanceof Map) {
        for (const [k, val] of v.entries()) result[String(k).replace(/^:/, "")] = val;
      } else if (v && typeof v === "object") {
        Object.assign(result, v);
      }
      return result;
    };
    if (Array.isArray(rawExamples145)) {
      for (const ex of rawExamples145) {
        if (ex instanceof Map) {
          examples145.push({ input: toRecord145r(ex.get("input")), output: ex.get("output") });
        } else if (ex && typeof ex === "object") {
          examples145.push({ input: toRecord145r((ex as any).input), output: (ex as any).output });
        }
      }
    }
    const rules145 = globalExplainer.extractRules(examples145);
    return rules145.map((r: any) => new Map<string, any>([
      ["condition", r.condition], ["outcome", r.outcome], ["support", r.support],
    ]));
  }

  // (explain-top-factors $explanation :n 3)
  if (op === "explain-top-factors") {
    const rawExpl145tf = args[0];
    let n145 = 3;
    for (let i = 1; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      if (key === "n") n145 = Number(args[i + 1]);
    }
    let features145tf: any[] = [];
    if (rawExpl145tf instanceof Map) features145tf = rawExpl145tf.get("features") ?? [];
    if (!Array.isArray(features145tf)) features145tf = [];
    return features145tf.slice(0, n145);
  }

  // (explain-summary $explanation)
  if (op === "explain-summary") {
    const rawExpl145s = args[0];
    if (rawExpl145s instanceof Map) return String(rawExpl145s.get("summary") ?? "");
    return "";
  }

  return null;
}

// === Phase 149: WISDOM ===
export function evalWisdom(op: string, args: any[]): any | null {

  if (op === "wisdom-add-exp") {
    const kwargs: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      kwargs[key] = args[i + 1];
    }
    const exp = globalWisdom.addExperience({
      situation: String(kwargs["situation"] ?? ""),
      action: String(kwargs["action"] ?? ""),
      outcome: String(kwargs["outcome"] ?? ""),
      lesson: String(kwargs["lesson"] ?? ""),
      success: kwargs["success"] === true || kwargs["success"] === "true",
      importance: typeof kwargs["importance"] === "number" ? kwargs["importance"] : 0.5,
      domain: String(kwargs["domain"] ?? "general"),
    });
    return new Map<string, any>([
      ["id", exp.id], ["situation", exp.situation], ["action", exp.action],
      ["outcome", exp.outcome], ["lesson", exp.lesson], ["success", exp.success],
      ["importance", exp.importance], ["domain", exp.domain],
      ["timestamp", exp.timestamp.toISOString()],
    ]);
  }

  if (op === "wisdom-judge") {
    const situation = String(args[0] ?? "");
    const judgment = globalWisdom.judge(situation);
    return new Map<string, any>([
      ["situation", judgment.situation],
      ["recommendation", judgment.recommendation],
      ["reasoning", judgment.reasoning],
      ["relevantExperiences", judgment.relevantExperiences.map((e: Experience) => new Map<string, any>([
        ["id", e.id], ["situation", e.situation], ["lesson", e.lesson],
        ["success", e.success], ["importance", e.importance], ["domain", e.domain],
      ]))],
      ["applicableHeuristics", judgment.applicableHeuristics.map((h: Heuristic) => new Map<string, any>([
        ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
        ["successCount", h.successCount], ["totalCount", h.totalCount], ["domain", h.domain],
      ]))],
      ["confidence", judgment.confidence],
      ["caveats", judgment.caveats],
      ["alternatives", judgment.alternatives],
    ]);
  }

  if (op === "wisdom-heuristics") {
    return globalWisdom.getHeuristics().map((h: Heuristic) => new Map<string, any>([
      ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
      ["successCount", h.successCount], ["totalCount", h.totalCount],
      ["domain", h.domain], ["derivedFrom", h.derivedFrom],
    ]));
  }

  if (op === "wisdom-extract") {
    const heuristics = globalWisdom.extractHeuristics();
    return heuristics.map((h: Heuristic) => new Map<string, any>([
      ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
      ["successCount", h.successCount], ["totalCount", h.totalCount],
      ["domain", h.domain], ["derivedFrom", h.derivedFrom],
    ]));
  }

  if (op === "wisdom-relevant") {
    const situation = String(args[0] ?? "");
    const limit = typeof args[1] === "number" ? args[1] : 5;
    return globalWisdom.findRelevantExperiences(situation, limit).map((e: Experience) => new Map<string, any>([
      ["id", e.id], ["situation", e.situation], ["action", e.action],
      ["outcome", e.outcome], ["lesson", e.lesson], ["success", e.success],
      ["importance", e.importance], ["domain", e.domain],
    ]));
  }

  if (op === "wisdom-lessons") {
    let domain: string | undefined;
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      if (key === "domain") domain = String(args[i + 1]);
    }
    return globalWisdom.getLessons(domain);
  }

  if (op === "wisdom-score") {
    return globalWisdom.wisdomScore();
  }

  if (op === "wisdom-domain") {
    const domain = String(args[0] ?? "general");
    const summary = globalWisdom.summarizeDomain(domain);
    return new Map<string, any>([
      ["topLessons", summary.topLessons],
      ["bestHeuristics", summary.bestHeuristics.map((h: Heuristic) => new Map<string, any>([
        ["id", h.id], ["rule", h.rule], ["confidence", h.confidence],
        ["successCount", h.successCount], ["totalCount", h.totalCount],
      ]))],
      ["successRate", summary.successRate],
    ]);
  }

  if (op === "wisdom-valid?") {
    const expMap = args[0];
    if (!(expMap instanceof Map)) return false;
    const exp: Experience = {
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
    return globalWisdom.isStillValid(exp);
  }

  if (op === "wisdom-similar") {
    const situation = String(args[0] ?? "");
    return globalWisdom.findSimilarCases(situation).map((e: Experience) => new Map<string, any>([
      ["id", e.id], ["situation", e.situation], ["action", e.action],
      ["outcome", e.outcome], ["lesson", e.lesson], ["success", e.success],
      ["importance", e.importance], ["domain", e.domain],
    ]));
  }

  return null;
}

// === Phase 145: EXPLAIN ===
export function evalExplain_PHASE145(op: string, args: any[], callFnVal?: (fn: any, a: any[]) => any): any | null {
  if (op === "explain-decision") {
    const decision = args[0];
    const rawFactors = args[1];
    const context = args[2] !== undefined ? String(args[2]) : undefined;
    const factors: Record<string, number> = {};
    if (rawFactors instanceof Map) {
      for (const [k, v] of rawFactors.entries()) factors[String(k).replace(/^:/, "")] = Number(v);
    } else if (rawFactors && typeof rawFactors === "object") {
      for (const [k, v] of Object.entries(rawFactors)) factors[String(k).replace(/^:/, "")] = Number(v);
    }
    const explanation = globalExplainer.explain(decision, factors, context);
    return new Map<string, any>([
      ["decision", explanation.decision],
      ["reasoning", explanation.reasoning],
      ["features", explanation.features.map((f: FeatureImportance) => new Map<string, any>([
        ["feature", f.feature], ["importance", f.importance],
        ["direction", f.direction], ["description", f.description],
      ]))],
      ["confidence", explanation.confidence],
      ["alternatives", explanation.alternatives.map((a: any) => new Map<string, any>([
        ["decision", a.decision], ["reason", a.reason], ["probability", a.probability],
      ]))],
      ["summary", explanation.summary],
      ["audience", explanation.audience],
    ]);
  }

  if (op === "explain-features") {
    const toRecord = (v: any): Record<string, number> => {
      const result: Record<string, number> = {};
      if (v instanceof Map) {
        for (const [k, val] of v.entries()) result[String(k).replace(/^:/, "")] = Number(val);
      } else if (v && typeof v === "object") {
        for (const [k, val] of Object.entries(v)) result[String(k).replace(/^:/, "")] = Number(val);
      }
      return result;
    };
    const features = globalExplainer.featureImportance(toRecord(args[0]), toRecord(args[1]), args[2] !== undefined ? toRecord(args[2]) : undefined);
    return features.map((f: FeatureImportance) => new Map<string, any>([
      ["feature", f.feature], ["importance", f.importance],
      ["direction", f.direction], ["description", f.description],
    ]));
  }

  if (op === "explain-local") {
    const rawInput = args[0];
    const output = args[1];
    const modelFn = args[2];
    const input: Record<string, unknown> = {};
    if (rawInput instanceof Map) {
      for (const [k, v] of rawInput.entries()) input[String(k).replace(/^:/, "")] = v;
    } else if (rawInput && typeof rawInput === "object") {
      for (const [k, v] of Object.entries(rawInput)) input[String(k).replace(/^:/, "")] = v;
    }
    const model = (inp: Record<string, unknown>): unknown => {
      if (modelFn && callFnVal) {
        try { return callFnVal(modelFn, [new Map(Object.entries(inp))]); }
        catch { return output; }
      }
      return output;
    };
    const local = globalExplainer.localExplain(input, output, model);
    return new Map<string, any>([
      ["input", new Map(Object.entries(local.input))],
      ["output", local.output],
      ["topFactors", local.topFactors.map((f: FeatureImportance) => new Map<string, any>([
        ["feature", f.feature], ["importance", f.importance],
        ["direction", f.direction], ["description", f.description],
      ]))],
      ["counterfactual", local.counterfactual],
      ["confidence", local.confidence],
    ]);
  }

  if (op === "explain-natural") {
    const rawExpl = args[0];
    let audience: 'technical' | 'general' = 'technical';
    for (let i = 1; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, "");
      if (key === "audience") audience = String(args[i + 1]) as 'technical' | 'general';
    }
    if (!(rawExpl instanceof Map)) return "설명을 변환할 수 없습니다";
    const featuresRaw = rawExpl.get("features") ?? [];
    const features: FeatureImportance[] = (Array.isArray(featuresRaw) ? featuresRaw : []).map((f: any) => {
      if (f instanceof Map) {
        return {
          feature: String(f.get("feature") ?? ""),
          importance: Number(f.get("importance") ?? 0),
          direction: String(f.get("direction") ?? "positive") as 'positive' | 'negative',
          description: String(f.get("description") ?? ""),
        };
      }
      return { feature: "", importance: 0, direction: "positive" as const, description: "" };
    });
    const altsRaw = rawExpl.get("alternatives") ?? [];
    const alternatives = (Array.isArray(altsRaw) ? altsRaw : []).map((a: any) => {
      if (a instanceof Map) return { decision: a.get("decision"), reason: String(a.get("reason") ?? ""), probability: Number(a.get("probability") ?? 0) };
      return { decision: null, reason: "", probability: 0 };
    });
    const explanation: DecisionExplanation = {
      decision: rawExpl.get("decision"),
      reasoning: rawExpl.get("reasoning") ?? [],
      features,
      confidence: Number(rawExpl.get("confidence") ?? 0.5),
      alternatives,
      summary: String(rawExpl.get("summary") ?? ""),
      audience: (rawExpl.get("audience") ?? "technical") as 'technical' | 'general',
    };
    return globalExplainer.toNaturalLanguage(explanation, audience);
  }

  if (op === "explain-contrast") {
    const factors: Record<string, number> = {};
    const rawF = args[2];
    if (rawF instanceof Map) {
      for (const [k, v] of rawF.entries()) factors[String(k).replace(/^:/, "")] = Number(v);
    } else if (rawF && typeof rawF === "object") {
      for (const [k, v] of Object.entries(rawF)) factors[String(k).replace(/^:/, "")] = Number(v);
    }
    return globalExplainer.contrastiveExplain(args[0], args[1], factors);
  }

  if (op === "explain-rules") {
    const examples: Array<{ input: Record<string, unknown>; output: unknown }> = [];
    const toRec = (v: any): Record<string, unknown> => {
      const r: Record<string, unknown> = {};
      if (v instanceof Map) { for (const [k, val] of v.entries()) r[String(k).replace(/^:/, "")] = val; }
      else if (v && typeof v === "object") { Object.assign(r, v); }
      return r;
    };
    if (Array.isArray(args[0])) {
      for (const ex of args[0]) {
        if (ex instanceof Map) examples.push({ input: toRec(ex.get("input")), output: ex.get("output") });
        else if (ex && typeof ex === "object") examples.push({ input: toRec((ex as any).input), output: (ex as any).output });
      }
    }
    return globalExplainer.extractRules(examples).map((r: any) => new Map<string, any>([
      ["condition", r.condition], ["outcome", r.outcome], ["support", r.support],
    ]));
  }

  if (op === "explain-top-factors") {
    let n = 3;
    for (let i = 1; i < args.length - 1; i += 2) {
      if (String(args[i]).replace(/^:/, "") === "n") n = Number(args[i + 1]);
    }
    const rawExpl = args[0];
    let features: any[] = [];
    if (rawExpl instanceof Map) features = rawExpl.get("features") ?? [];
    if (!Array.isArray(features)) features = [];
    return features.slice(0, n);
  }

  if (op === "explain-summary") {
    const rawExpl = args[0];
    if (rawExpl instanceof Map) return String(rawExpl.get("summary") ?? "");
    return "";
  }

  return null;
}

// === Phase 141: WORLD-MODEL ===
export function evalWorldModel141(op: string, args: any[]): any {
  if (op === "world-add-entity") {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) { kw[String(args[i]).replace(/^:/, "")] = args[i + 1]; }
    const rawP = kw["props"] ?? kw["properties"] ?? {};
    const props: Record<string, unknown> = rawP instanceof Map ? Object.fromEntries(rawP.entries()) : (typeof rawP === "object" && rawP !== null ? rawP : {});
    const e = globalWorldModel.addEntity({ id: String(kw["id"] ?? `entity-${Date.now()}`), type: String(kw["type"] ?? "unknown"), confidence: typeof kw["confidence"] === "number" ? kw["confidence"] : 1.0, properties: props });
    return new Map<string, any>([["id", e.id], ["type", e.type], ["properties", new Map(Object.entries(e.properties))], ["confidence", e.confidence], ["lastUpdated", e.lastUpdated.toISOString()]]);
  }
  if (op === "world-update-entity") {
    const rawPu = args[1] ?? {};
    const propsu: Record<string, unknown> = rawPu instanceof Map ? Object.fromEntries(rawPu.entries()) : (typeof rawPu === "object" && rawPu !== null ? rawPu : {});
    const eu = globalWorldModel.updateEntity(String(args[0] ?? ""), propsu);
    if (!eu) return null;
    return new Map<string, any>([["id", eu.id], ["type", eu.type], ["properties", new Map(Object.entries(eu.properties))], ["confidence", eu.confidence], ["lastUpdated", eu.lastUpdated.toISOString()]]);
  }
  if (op === "world-get-entity") {
    const eg = globalWorldModel.getEntity(String(args[0] ?? ""));
    if (!eg) return null;
    return new Map<string, any>([["id", eg.id], ["type", eg.type], ["properties", new Map(Object.entries(eg.properties))], ["confidence", eg.confidence], ["lastUpdated", eg.lastUpdated.toISOString()]]);
  }
  if (op === "world-remove-entity") { return globalWorldModel.removeEntity(String(args[0] ?? "")); }
  if (op === "world-add-relation") {
    const kwr: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) { kwr[String(args[i]).replace(/^:/, "")] = args[i + 1]; }
    const rel = globalWorldModel.addRelation({ from: String(kwr["from"] ?? ""), to: String(kwr["to"] ?? ""), type: String(kwr["type"] ?? "related"), strength: typeof kwr["strength"] === "number" ? kwr["strength"] : 1.0, bidirectional: kwr["bidirectional"] === true });
    return new Map<string, any>([["id", rel.id], ["from", rel.from], ["to", rel.to], ["type", rel.type], ["strength", rel.strength], ["bidirectional", rel.bidirectional]]);
  }
  if (op === "world-get-relations") {
    return globalWorldModel.getRelations(String(args[0] ?? "")).map(r => new Map<string, any>([["id", r.id], ["from", r.from], ["to", r.to], ["type", r.type], ["strength", r.strength], ["bidirectional", r.bidirectional]]));
  }
  if (op === "world-find-path") { return globalWorldModel.findPath(String(args[0] ?? ""), String(args[1] ?? "")); }
  if (op === "world-set-fact") { globalWorldModel.setFact(String(args[0] ?? ""), args[1]); return null; }
  if (op === "world-get-fact") { return globalWorldModel.getFact(String(args[0] ?? "")); }
  if (op === "world-add-rule") {
    const kwrule: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) { kwrule[String(args[i]).replace(/^:/, "")] = args[i + 1]; }
    const rule = globalWorldModel.addRule({ condition: String(kwrule["condition"] ?? ""), consequence: String(kwrule["consequence"] ?? ""), confidence: typeof kwrule["confidence"] === "number" ? kwrule["confidence"] : 0.8 });
    return new Map<string, any>([["id", rule.id], ["condition", rule.condition], ["consequence", rule.consequence], ["confidence", rule.confidence]]);
  }
  if (op === "world-apply-rules") { return globalWorldModel.applyRules().map(u => new Map<string, any>([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]])); }
  if (op === "world-query") {
    const kwq: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) { kwq[String(args[i]).replace(/^:/, "")] = args[i + 1]; }
    return globalWorldModel.query(kwq["type"] !== undefined ? String(kwq["type"]) : undefined, kwq["min-confidence"] !== undefined ? Number(kwq["min-confidence"]) : undefined).map(e => new Map<string, any>([["id", e.id], ["type", e.type], ["properties", new Map(Object.entries(e.properties))], ["confidence", e.confidence], ["lastUpdated", e.lastUpdated.toISOString()]]));
  }
  if (op === "world-snapshot") {
    const snap = globalWorldModel.snapshot();
    return new Map<string, any>([["entityCount", snap.entities.size], ["relationCount", snap.relations.length], ["factCount", snap.facts.size], ["ruleCount", snap.rules.length], ["version", snap.version], ["timestamp", snap.timestamp.toISOString()]]);
  }
  if (op === "world-summarize") { return globalWorldModel.summarize(); }
  if (op === "world-history") { return globalWorldModel.getHistory().map(u => new Map<string, any>([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]])); }
  return undefined;
}
