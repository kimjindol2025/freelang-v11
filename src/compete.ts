// FreeLang v9 Compete — 에이전트 경쟁으로 최선 선택
// Phase 129: [COMPETE] 여러 경쟁자(에이전트)가 같은 문제를 풀고 점수로 최선 선택

export interface CompetitorResult {
  agentId: string;
  output: any;
  score: number;
  rank: number;
}

export interface CompetitionResult {
  winner: CompetitorResult;
  allResults: CompetitorResult[];
  margin: number;  // 1등과 2등 점수 차이
}

export interface Competitor {
  id: string;
  solve: (problem: any) => any;
}

export class Competition {
  private competitors: Map<string, Competitor> = new Map();

  register(competitor: Competitor): void {
    this.competitors.set(competitor.id, competitor);
  }

  run(problem: any, evaluate: (output: any) => number): CompetitionResult {
    const results: Omit<CompetitorResult, 'rank'>[] = [];

    for (const competitor of this.competitors.values()) {
      try {
        const output = competitor.solve(problem);
        results.push({ agentId: competitor.id, output, score: evaluate(output) });
      } catch {
        results.push({ agentId: competitor.id, output: null, score: -Infinity });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const ranked: CompetitorResult[] = results.map((r, i) => ({ ...r, rank: i + 1 }));

    const margin = ranked.length >= 2
      ? ranked[0].score - ranked[1].score
      : ranked[0]?.score ?? 0;

    return { winner: ranked[0], allResults: ranked, margin };
  }

  // 토너먼트: 1:1 매치로 최종 우승자 (단순화: 전체 점수 기반)
  tournament(problem: any, evaluate: (output: any) => number): CompetitionResult {
    return this.run(problem, evaluate);
  }

  list(): string[] { return [...this.competitors.keys()]; }
  size(): number { return this.competitors.size; }
}

export const globalCompetition = new Competition();
