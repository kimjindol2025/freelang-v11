// vote.ts — FreeLang v9 Phase 123: VOTE 에이전트 투표 결정 시스템
// 여러 에이전트가 투표하여 최적 결정을 내리는 시스템

export type VotingMethod = 'plurality' | 'approval' | 'ranked' | 'score';

export interface Ballot {
  voterId: string;
  choices: string[];    // 투표한 선택지들 (ranked: 순서대로, approval: 승인한 것들)
  scores?: Record<string, number>;  // score voting용
}

export interface VoteResult {
  winner: string;
  method: VotingMethod;
  tally: Record<string, number>;
  totalVoters: number;
  margin: number;  // winner와 2등의 차이
}

export class VotingSystem {
  // 단순 다수결 (가장 많은 1순위 표)
  plurality(ballots: Ballot[], candidates: string[]): VoteResult {
    const tally: Record<string, number> = {};
    candidates.forEach(c => tally[c] = 0);
    ballots.forEach(b => {
      if (b.choices[0]) tally[b.choices[0]] = (tally[b.choices[0]] ?? 0) + 1;
    });
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: 'plurality',
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }

  // 승인 투표 (가장 많이 승인된 것)
  approval(ballots: Ballot[], candidates: string[]): VoteResult {
    const tally: Record<string, number> = {};
    candidates.forEach(c => tally[c] = 0);
    ballots.forEach(b => b.choices.forEach(c => {
      if (tally.hasOwnProperty(c)) tally[c] = (tally[c] ?? 0) + 1;
    }));
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: 'approval',
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }

  // 순위 투표 (IRV: 과반 없으면 최저 탈락 반복)
  ranked(ballots: Ballot[], candidates: string[]): VoteResult {
    let remaining = [...candidates];
    let workingBallots = ballots.map(b => ({ ...b, choices: [...b.choices] }));

    while (remaining.length > 1) {
      const tally: Record<string, number> = {};
      remaining.forEach(c => tally[c] = 0);
      workingBallots.forEach(b => {
        const top = b.choices.find(c => remaining.includes(c));
        if (top) tally[top] = (tally[top] ?? 0) + 1;
      });

      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      const sorted = [...remaining].sort((a, b) => tally[b] - tally[a]);
      if (tally[sorted[0]] > total / 2) {
        // 과반 달성
        const finalTally: Record<string, number> = {};
        candidates.forEach(c => finalTally[c] = 0);
        remaining.forEach(c => finalTally[c] = tally[c]);
        return {
          winner: sorted[0],
          method: 'ranked',
          tally: finalTally,
          totalVoters: ballots.length,
          margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
        };
      }
      // 최저 탈락
      remaining = remaining.filter(c => c !== sorted[sorted.length - 1]);
    }

    const finalTally: Record<string, number> = {};
    candidates.forEach(c => finalTally[c] = 0);
    if (remaining[0]) finalTally[remaining[0]] = ballots.length;
    return {
      winner: remaining[0] ?? candidates[0],
      method: 'ranked',
      tally: finalTally,
      totalVoters: ballots.length,
      margin: 0
    };
  }

  // 점수 투표
  score(ballots: Ballot[], candidates: string[]): VoteResult {
    const tally: Record<string, number> = {};
    candidates.forEach(c => tally[c] = 0);
    ballots.forEach(b => {
      if (b.scores) candidates.forEach(c => { tally[c] += b.scores![c] ?? 0; });
    });
    const sorted = [...candidates].sort((a, b) => tally[b] - tally[a]);
    return {
      winner: sorted[0],
      method: 'score',
      tally,
      totalVoters: ballots.length,
      margin: tally[sorted[0]] - (tally[sorted[1]] ?? 0)
    };
  }

  // tally만 반환 (vote-tally 내장함수용)
  tally(ballots: Ballot[], candidates: string[]): Record<string, number> {
    const tally: Record<string, number> = {};
    candidates.forEach(c => tally[c] = 0);
    ballots.forEach(b => {
      if (b.choices[0]) tally[b.choices[0]] = (tally[b.choices[0]] ?? 0) + 1;
    });
    return tally;
  }
}

export const globalVoting = new VotingSystem();
