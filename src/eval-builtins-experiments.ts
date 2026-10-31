// eval-builtins-experiments.ts — Lazy Builtin Registry for Experimental Features
// Phase 141-149 + Phase 121-130 (higher-order AI reasoning + consensus)
// Imported only if experimental features are used
// Delegates to external modules to keep eval-builtins.ts focused on Core

import { CausalGraph, globalCausal, whyCaused } from "./experiments/causal"; // Phase 142
import { evalRefactorSelf, evalAlign, evalPredict_PHASE144, evalCuriosity, evalEthicsCheck, evalCounterfactual, evalWisdom, evalExplain_PHASE145, evalWorldModel141 } from "./eval-builtins-ai";

// Consensus & Multi-Agent Ops (Phase 121-130)
import { globalConsensus } from "./experiments/consensus"; // Phase 121
import { globalDelegation } from "./experiments/delegate"; // Phase 122
import { globalVoting } from "./experiments/vote"; // Phase 123
import { globalNegotiator } from "./experiments/negotiate"; // Phase 124
import { globalSwarm } from "./experiments/swarm"; // Phase 125
import { globalOrchestrator } from "./experiments/orchestrate"; // Phase 126
import { globalPeerReview } from "./experiments/peer-review"; // Phase 127
import { AgentChain } from "./experiments/chain-agents"; // Phase 128
import { globalCompetition } from "./experiments/compete"; // Phase 129
import { globalHub } from "./experiments/multi-agent-hub"; // Phase 130

/**
 * Evaluate experimental builtins (Phase 141-149 + 121-130)
 * Returns: FlValue if handled, null if unknown op
 */
export function evalExperimentBuiltin(op: string, args: any[], callFn: any): any {
  // === Phase 141: WORLD-MODEL ===
  if (op.startsWith("world-")) {
    const r141 = evalWorldModel141(op, args);
    if (r141 !== undefined) return r141;
  }

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
    const node142 = {
      id: String(kw142['id'] ?? ''),
      name: String(kw142['name'] ?? kw142['id'] ?? ''),
      description: String(kw142['desc'] ?? kw142['description'] ?? ''),
      value: kw142['value'] !== undefined ? Number(kw142['value']) : undefined
    };
    globalCausal.addNode(node142);
    return new Map<string, any>([
      ['id', node142.id],
      ['name', node142.name],
      ['description', node142.description]
    ]);
  }

  if (op === 'causal-add-edge') {
    const kw142e: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) {
      const key = String(args[i]).replace(/^:/, '');
      kw142e[key] = args[i + 1];
    }
    const edge142 = {
      from: String(kw142e['from'] ?? ''),
      to: String(kw142e['to'] ?? ''),
      strength: Number(kw142e['strength'] ?? 1),
      confidence: Number(kw142e['confidence'] ?? 1),
      delay: kw142e['delay'] !== undefined ? Number(kw142e['delay']) : undefined,
      mechanism: kw142e['mechanism'] !== undefined ? String(kw142e['mechanism']) : undefined
    };
    globalCausal.addEdge(edge142);
    return new Map<string, any>([
      ['from', edge142.from],
      ['to', edge142.to],
      ['strength', edge142.strength],
      ['confidence', edge142.confidence]
    ]);
  }

  if (op === 'causal-explain') {
    const expl142 = globalCausal.explain(String(args[0] ?? ''));
    return new Map<string, any>([
      ['effect', expl142.effect],
      ['primaryCause', expl142.primaryCause],
      ['explanation', expl142.explanation],
      ['confidence', expl142.confidence],
      ['causes', expl142.causes.map((c: any) => new Map<string, any>([
        ['cause', c.cause],
        ['contribution', c.contribution],
        ['chain', new Map<string, any>([
          ['path', c.chain.path],
          ['totalStrength', c.chain.totalStrength],
          ['explanation', c.chain.explanation],
          ['confidence', c.chain.confidence],
        ])],
      ]))]
    ]);
  }

  if (op === 'causal-chains') {
    const ch142 = globalCausal.findCausalChains(String(args[0] ?? ''), String(args[1] ?? ''));
    return ch142.map((c: any) => new Map<string, any>([
      ['path', c.path],
      ['totalStrength', c.totalStrength],
      ['explanation', c.explanation],
      ['confidence', c.confidence]
    ]));
  }

  if (op === 'causal-causes') {
    return globalCausal.getDirectCauses(String(args[0] ?? '')).map((e: any) => new Map<string, any>([
      ['from', e.from],
      ['to', e.to],
      ['strength', e.strength],
      ['confidence', e.confidence]
    ]));
  }

  if (op === 'causal-effects') {
    return globalCausal.getDirectEffects(String(args[0] ?? '')).map((e: any) => new Map<string, any>([
      ['from', e.from],
      ['to', e.to],
      ['strength', e.strength],
      ['confidence', e.confidence]
    ]));
  }

  if (op === 'causal-roots') {
    return globalCausal.findRootCauses(String(args[0] ?? ''));
  }

  if (op === 'causal-simulate') {
    const arg142 = args[0];
    const iv142: Record<string, number> = {};
    if (arg142 instanceof Map) {
      for (const [k, v] of arg142.entries()) {
        iv142[String(k)] = Number(v);
      }
    }
    return new Map<string, any>(Object.entries(globalCausal.simulate(iv142)));
  }

  if (op === 'causal-why') {
    const chain142 = whyCaused(String(args[0] ?? ''), String(args[1] ?? ''));
    if (chain142 === null) return null;
    return new Map<string, any>([
      ['path', chain142.path],
      ['totalStrength', chain142.totalStrength],
      ['explanation', chain142.explanation],
      ['confidence', chain142.confidence]
    ]);
  }

  if (op === 'causal-summary') {
    return globalCausal.summarize(String(args[0] ?? ''));
  }

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
    const r145 = evalExplain_PHASE145(op, args, callFn);
    if (r145 !== null) return r145;
  }

  // === Phase 121-130: Consensus & Multi-Agent ===
  // Phase 121: CONSENSUS
  if (op === "consensus-create") {
    const config = typeof args[0] === "object" ? args[0] : {};
    return { engine: globalConsensus, id: `cons-${Date.now()}` };
  }
  if (op === "consensus-vote") {
    const agentId = String(args[0] ?? '');
    const position = String(args[1] ?? 'neutral');
    globalConsensus.vote(agentId, position);
    return true;
  }
  if (op === "consensus-result") {
    return globalConsensus.getConsensus();
  }

  // Phase 122: DELEGATION
  if (op === "delegate-assign") {
    const taskId = String(args[0] ?? '');
    const agentId = String(args[1] ?? '');
    globalDelegation.assignTask(taskId, agentId);
    return true;
  }
  if (op === "delegate-status") {
    const taskId = String(args[0] ?? '');
    return globalDelegation.getTaskStatus(taskId);
  }

  // Phase 123: VOTING
  if (op === "vote-create") {
    const ballot = { id: `ballot-${Date.now()}`, options: args };
    return ballot;
  }

  // Phase 125: SWARM
  if (op === "swarm-spawn") {
    return globalSwarm.spawn(String(args[0] ?? ''));
  }

  // Phase 130: MULTI-AGENT HUB
  if (op === "hub-register") {
    const agentId = String(args[0] ?? '');
    globalHub.register(agentId);
    return true;
  }

  return null; // Unknown op — fallback to default handler
}
