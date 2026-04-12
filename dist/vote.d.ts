export type VotingMethod = 'plurality' | 'approval' | 'ranked' | 'score';
export interface Ballot {
    voterId: string;
    choices: string[];
    scores?: Record<string, number>;
}
export interface VoteResult {
    winner: string;
    method: VotingMethod;
    tally: Record<string, number>;
    totalVoters: number;
    margin: number;
}
export declare class VotingSystem {
    plurality(ballots: Ballot[], candidates: string[]): VoteResult;
    approval(ballots: Ballot[], candidates: string[]): VoteResult;
    ranked(ballots: Ballot[], candidates: string[]): VoteResult;
    score(ballots: Ballot[], candidates: string[]): VoteResult;
    tally(ballots: Ballot[], candidates: string[]): Record<string, number>;
}
export declare const globalVoting: VotingSystem;
//# sourceMappingURL=vote.d.ts.map