export interface NegotiationPosition {
    agentId: string;
    offer: number;
    minAccept: number;
    maxOffer: number;
    flexibility: number;
}
export interface NegotiationRound {
    round: number;
    offers: Record<string, number>;
    gap: number;
}
export interface NegotiationResult {
    agreed: boolean;
    value?: number;
    rounds: NegotiationRound[];
    breakdown: string;
}
export declare class Negotiator {
    negotiate(positions: NegotiationPosition[], maxRounds?: number): NegotiationResult;
}
export declare const globalNegotiator: Negotiator;
//# sourceMappingURL=negotiate.d.ts.map