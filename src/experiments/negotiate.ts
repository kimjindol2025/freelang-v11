// negotiate.ts — FreeLang v9 Phase 124: 에이전트 협상 블록
// [NEGOTIATE] 블록: 멀티 에이전트 협상 엔진

export interface NegotiationPosition {
  agentId: string;
  offer: number;      // 현재 제안값 (0~1 정규화)
  minAccept: number;  // 최소 수용값
  maxOffer: number;   // 최대 제안값
  flexibility: number; // 양보 의지 (0~1)
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

export class Negotiator {
  negotiate(positions: NegotiationPosition[], maxRounds = 5): NegotiationResult {
    const rounds: NegotiationRound[] = [];
    let currentOffers: Record<string, number> = {};
    positions.forEach(p => { currentOffers[p.agentId] = p.offer; });

    for (let r = 1; r <= maxRounds; r++) {
      const values = Object.values(currentOffers);
      const gap = Math.max(...values) - Math.min(...values);
      rounds.push({ round: r, offers: { ...currentOffers }, gap });

      // 합의 조건: 모든 제안이 서로의 minAccept 범위 안
      const avgOffer = values.reduce((s, v) => s + v, 0) / values.length;
      const allAccept = positions.every(p => avgOffer >= p.minAccept && avgOffer <= p.maxOffer);
      if (allAccept || gap < 0.01) {
        return { agreed: true, value: avgOffer, rounds, breakdown: `${r}라운드에 합의 (값: ${avgOffer.toFixed(3)})` };
      }

      // 양보: 각 에이전트가 중간값 방향으로 flexibility만큼 이동
      positions.forEach(p => {
        const current = currentOffers[p.agentId];
        const delta = (avgOffer - current) * p.flexibility * 0.5;
        currentOffers[p.agentId] = Math.max(p.minAccept, Math.min(p.maxOffer, current + delta));
      });
    }

    return { agreed: false, rounds, breakdown: `${maxRounds}라운드 후 협상 결렬` };
  }
}

export const globalNegotiator = new Negotiator();
