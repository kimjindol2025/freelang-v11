export interface CausalNode {
    id: string;
    name: string;
    description: string;
    value?: number;
}
export interface CausalEdge {
    from: string;
    to: string;
    strength: number;
    delay?: number;
    confidence: number;
    mechanism?: string;
}
export interface CausalChain {
    path: string[];
    totalStrength: number;
    explanation: string;
    confidence: number;
}
export interface CausalExplanation {
    effect: string;
    causes: Array<{
        cause: string;
        chain: CausalChain;
        contribution: number;
    }>;
    primaryCause: string;
    explanation: string;
    confidence: number;
}
export declare class CausalGraph {
    private nodes;
    private edges;
    constructor();
    addNode(node: CausalNode): void;
    addEdge(edge: CausalEdge): void;
    getDirectCauses(nodeId: string): CausalEdge[];
    getDirectEffects(nodeId: string): CausalEdge[];
    findCausalChains(causeId: string, effectId: string, visited?: Set<string>): CausalChain[];
    explain(effectId: string): CausalExplanation;
    findRootCauses(effectId: string, visited?: Set<string>): string[];
    simulate(interventions: Record<string, number>): Record<string, number>;
    summarize(nodeId: string): string;
    detectCycle(startId: string, endId: string): boolean;
}
export declare const globalCausal: CausalGraph;
export declare function whyCaused(effect: string, cause: string): CausalChain | null;
//# sourceMappingURL=causal.d.ts.map