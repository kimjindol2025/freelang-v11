export interface Argument {
    side: 'pro' | 'con';
    point: string;
    strength: number;
}
export interface DebateRound {
    round: number;
    proArgument: Argument;
    conArgument: Argument;
}
export interface DebateResult {
    proposition: string;
    winner: 'pro' | 'con' | 'tie';
    proScore: number;
    conScore: number;
    rounds: DebateRound[];
    conclusion: string;
}
export interface DebateConfig {
    proposition: string;
    pro: (round: number, conArgs: Argument[]) => Argument;
    con: (round: number, proArgs: Argument[]) => Argument;
    rounds?: number;
    judge?: (proScore: number, conScore: number) => 'pro' | 'con' | 'tie';
}
export declare class Debater {
    debate(config: DebateConfig): DebateResult;
}
export declare const globalDebater: Debater;
//# sourceMappingURL=debate.d.ts.map