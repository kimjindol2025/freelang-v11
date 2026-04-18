// causal.ts — Phase 142: CAUSAL 인과 추론 ("왜")
// AI가 "왜 이런 일이 일어났는가?"를 추론하는 인과 관계 시스템

export interface CausalNode {
  id: string;
  name: string;
  description: string;
  value?: number;     // 현재 값 (정량적 노드)
}

export interface CausalEdge {
  from: string;       // cause
  to: string;         // effect
  strength: number;   // 인과 강도 -1~1 (양수=촉진, 음수=억제)
  delay?: number;     // 시간 지연 (ms)
  confidence: number; // 이 관계의 신뢰도 0~1
  mechanism?: string; // 인과 메커니즘 설명
}

export interface CausalChain {
  path: string[];     // node id 배열
  totalStrength: number;
  explanation: string;
  confidence: number;
}

export interface CausalExplanation {
  effect: string;
  causes: Array<{
    cause: string;
    chain: CausalChain;
    contribution: number; // 이 원인의 기여도 0~1
  }>;
  primaryCause: string;
  explanation: string;
  confidence: number;
}

export class CausalGraph {
  private nodes: Map<string, CausalNode>;
  private edges: CausalEdge[];

  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  addNode(node: CausalNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: CausalEdge): void {
    this.edges.push(edge);
  }

  getDirectCauses(nodeId: string): CausalEdge[] {
    return this.edges.filter(e => e.to === nodeId);
  }

  getDirectEffects(nodeId: string): CausalEdge[] {
    return this.edges.filter(e => e.from === nodeId);
  }

  findCausalChains(causeId: string, effectId: string, visited: Set<string> = new Set()): CausalChain[] {
    if (causeId === effectId) {
      return [{
        path: [causeId],
        totalStrength: 1,
        explanation: `${this.nodes.get(causeId)?.name ?? causeId}`,
        confidence: 1,
      }];
    }

    if (visited.has(causeId)) return []; // 순환 감지
    visited.add(causeId);

    const chains: CausalChain[] = [];
    const directEffects = this.getDirectEffects(causeId);

    for (const edge of directEffects) {
      const subChains = this.findCausalChains(edge.to, effectId, new Set(visited));
      for (const sub of subChains) {
        const fromName = this.nodes.get(causeId)?.name ?? causeId;
        const toName = this.nodes.get(edge.to)?.name ?? edge.to;
        const mechanism = edge.mechanism ? ` (${edge.mechanism})` : "";
        chains.push({
          path: [causeId, ...sub.path],
          totalStrength: edge.strength * sub.totalStrength,
          explanation: `${fromName} → ${toName}${mechanism}; ${sub.explanation}`,
          confidence: edge.confidence * sub.confidence,
        });
      }
    }

    return chains;
  }

  explain(effectId: string): CausalExplanation {
    const effectNode = this.nodes.get(effectId);
    const effectName = effectNode?.name ?? effectId;

    // 모든 노드에서 effect로의 인과 체인 찾기
    const allCauses: Array<{ cause: string; chain: CausalChain }> = [];

    for (const [nodeId] of this.nodes) {
      if (nodeId === effectId) continue;
      const chains = this.findCausalChains(nodeId, effectId);
      for (const chain of chains) {
        // 직접 원인만 포함 (path 길이 2 이상)
        if (chain.path.length >= 2) {
          allCauses.push({ cause: nodeId, chain });
        }
      }
    }

    // 중복 cause 제거 (같은 cause에서 가장 강한 체인만)
    const bestByCause = new Map<string, { cause: string; chain: CausalChain }>();
    for (const item of allCauses) {
      const existing = bestByCause.get(item.cause);
      if (!existing || Math.abs(item.chain.totalStrength) > Math.abs(existing.chain.totalStrength)) {
        bestByCause.set(item.cause, item);
      }
    }

    const causesArr = Array.from(bestByCause.values());

    // 기여도 계산
    const totalAbsStrength = causesArr.reduce((s, c) => s + Math.abs(c.chain.totalStrength), 0) || 1;
    const causesWithContrib = causesArr.map(c => ({
      cause: c.cause,
      chain: c.chain,
      contribution: Math.abs(c.chain.totalStrength) / totalAbsStrength,
    }));

    // 주요 원인: 기여도가 가장 높은 것
    causesWithContrib.sort((a, b) => b.contribution - a.contribution);
    const primaryCause = causesWithContrib[0]?.cause ?? effectId;
    const primaryName = this.nodes.get(primaryCause)?.name ?? primaryCause;

    const avgConfidence = causesWithContrib.length > 0
      ? causesWithContrib.reduce((s, c) => s + c.chain.confidence, 0) / causesWithContrib.length
      : 0;

    const explanation = causesWithContrib.length > 0
      ? `${effectName}의 주요 원인은 "${primaryName}"이다. ` +
        causesWithContrib.slice(0, 3).map(c => {
          const cn = this.nodes.get(c.cause)?.name ?? c.cause;
          return `${cn} (기여도: ${(c.contribution * 100).toFixed(1)}%)`;
        }).join(", ") + "."
      : `${effectName}의 원인을 찾을 수 없습니다.`;

    return {
      effect: effectId,
      causes: causesWithContrib,
      primaryCause,
      explanation,
      confidence: avgConfidence,
    };
  }

  findRootCauses(effectId: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(effectId)) return []; // 순환 감지
    visited.add(effectId);

    const directCauses = this.getDirectCauses(effectId);
    if (directCauses.length === 0) {
      return [effectId]; // 더 이상 원인이 없으면 루트
    }

    const roots: string[] = [];
    for (const edge of directCauses) {
      const subRoots = this.findRootCauses(edge.from, new Set(visited));
      for (const r of subRoots) {
        if (!roots.includes(r)) roots.push(r);
      }
    }
    return roots;
  }

  simulate(interventions: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = { ...interventions };

    // BFS로 인과 전파
    const queue: string[] = Object.keys(interventions);
    const processed = new Set<string>(queue);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentValue = result[nodeId] ?? (this.nodes.get(nodeId)?.value ?? 0);
      const effects = this.getDirectEffects(nodeId);

      for (const edge of effects) {
        if (!processed.has(edge.to)) {
          const baseValue = this.nodes.get(edge.to)?.value ?? 0;
          const delta = currentValue * edge.strength * edge.confidence;
          result[edge.to] = (result[edge.to] ?? baseValue) + delta;
          queue.push(edge.to);
          processed.add(edge.to);
        }
      }
    }

    return result;
  }

  summarize(nodeId: string): string {
    const node = this.nodes.get(nodeId);
    if (!node) return `노드 "${nodeId}"를 찾을 수 없습니다.`;

    const causes = this.getDirectCauses(nodeId);
    const effects = this.getDirectEffects(nodeId);
    const roots = this.findRootCauses(nodeId);

    const causesStr = causes.length > 0
      ? causes.map(e => {
          const n = this.nodes.get(e.from)?.name ?? e.from;
          return `${n}(강도:${e.strength})`;
        }).join(", ")
      : "없음";

    const effectsStr = effects.length > 0
      ? effects.map(e => {
          const n = this.nodes.get(e.to)?.name ?? e.to;
          return `${n}(강도:${e.strength})`;
        }).join(", ")
      : "없음";

    const rootsStr = roots.filter(r => r !== nodeId).length > 0
      ? roots.filter(r => r !== nodeId).map(r => this.nodes.get(r)?.name ?? r).join(", ")
      : "없음 (루트 원인)";

    return `[${node.name}] 직접원인: ${causesStr} | 직접결과: ${effectsStr} | 루트원인: ${rootsStr}`;
  }

  detectCycle(startId: string, endId: string): boolean {
    // endId에서 startId로 도달 가능한지 확인 (순환 감지)
    const visited = new Set<string>();
    const queue = [endId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === startId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const effects = this.getDirectEffects(current);
      for (const e of effects) queue.push(e.to);
    }
    return false;
  }
}

export const globalCausal: CausalGraph = new CausalGraph();

export function whyCaused(effect: string, cause: string): CausalChain | null {
  const chains = globalCausal.findCausalChains(cause, effect);
  if (chains.length === 0) return null;
  // 가장 강한 체인 반환
  return chains.sort((a, b) => Math.abs(b.totalStrength) - Math.abs(a.totalStrength))[0];
}
