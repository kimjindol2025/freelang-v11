export interface Belief {
    claim: string;
    confidence: number;
    history: Array<{
        event: string;
        delta: number;
        timestamp: number;
    }>;
    createdAt: number;
}
export declare class BeliefSystem {
    private beliefs;
    set(claim: string, confidence: number): void;
    get(claim: string): number | null;
    update(claim: string, evidenceStrength: number, eventName?: string): number;
    negate(claim: string): number;
    list(): Belief[];
    strongest(): Belief | null;
    certain(threshold?: number): Belief[];
    forget(claim: string): boolean;
    size(): number;
}
export declare const globalBeliefs: BeliefSystem;
//# sourceMappingURL=belief.d.ts.map