// FreeLang v9 Debate — 내부 찬반 에이전트 토론
// Phase 113: [DEBATE :proposition "..." :pro fn :con fn :rounds 3 :judge fn]

export interface Argument {
  side: 'pro' | 'con';
  point: string;
  strength: number;   // 0.0~1.0
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
  pro: (round: number, conArgs: Argument[]) => Argument;   // 찬성 에이전트
  con: (round: number, proArgs: Argument[]) => Argument;   // 반대 에이전트
  rounds?: number;                                          // 토론 라운드 수 (default: 3)
  judge?: (proScore: number, conScore: number) => 'pro' | 'con' | 'tie'; // 판정
}

export class Debater {
  debate(config: DebateConfig): DebateResult {
    const { proposition, pro, con, rounds = 3 } = config;
    const judge = config.judge ?? ((p, c) => p > c ? 'pro' : c > p ? 'con' : 'tie');

    const debateRounds: DebateRound[] = [];
    const proArgs: Argument[] = [];
    const conArgs: Argument[] = [];

    for (let r = 1; r <= rounds; r++) {
      const proArg = pro(r, conArgs);
      proArgs.push(proArg);

      const conArg = con(r, proArgs);
      conArgs.push(conArg);

      debateRounds.push({ round: r, proArgument: proArg, conArgument: conArg });
    }

    const proScore = proArgs.reduce((s, a) => s + a.strength, 0) / proArgs.length;
    const conScore = conArgs.reduce((s, a) => s + a.strength, 0) / conArgs.length;
    const winner = judge(proScore, conScore);

    const conclusion = winner === 'tie'
      ? `"${proposition}" — 팽팽한 논쟁 (pro: ${proScore.toFixed(2)}, con: ${conScore.toFixed(2)})`
      : `"${proposition}" — ${winner === 'pro' ? '채택' : '기각'} (승자: ${winner})`;

    return { proposition, winner, proScore, conScore, rounds: debateRounds, conclusion };
  }
}

export const globalDebater = new Debater();
