export interface CompetitorResult {
    agentId: string;
    output: any;
    score: number;
    rank: number;
}
export interface CompetitionResult {
    winner: CompetitorResult;
    allResults: CompetitorResult[];
    margin: number;
}
export interface Competitor {
    id: string;
    solve: (problem: any) => any;
}
export declare class Competition {
    private competitors;
    register(competitor: Competitor): void;
    run(problem: any, evaluate: (output: any) => number): CompetitionResult;
    tournament(problem: any, evaluate: (output: any) => number): CompetitionResult;
    list(): string[];
    size(): number;
}
export declare const globalCompetition: Competition;
//# sourceMappingURL=compete.d.ts.map