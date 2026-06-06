// FreeLang v9 Belief System — AI 신념 + 베이즈 업데이트
// Phase 116: [BELIEF] 신념 시스템
// (belief-set "claim" confidence)
// (belief-update "claim" evidence-strength)  → 베이즈식 업데이트
// (belief-get "claim") → confidence

export interface Belief {
  claim: string;
  confidence: number;   // 0.0~1.0
  history: Array<{ event: string; delta: number; timestamp: number }>;
  createdAt: number;
}

export class BeliefSystem {
  private beliefs: Map<string, Belief> = new Map();

  // 신념 설정
  set(claim: string, confidence: number): void {
    const clamped = Math.max(0, Math.min(1, confidence));
    const existing = this.beliefs.get(claim);
    if (existing) {
      const delta = clamped - existing.confidence;
      existing.confidence = clamped;
      existing.history.push({ event: 'set', delta, timestamp: Date.now() });
    } else {
      this.beliefs.set(claim, {
        claim,
        confidence: clamped,
        history: [{ event: 'initialized', delta: 0, timestamp: Date.now() }],
        createdAt: Date.now()
      });
    }
  }

  // 신념 조회
  get(claim: string): number | null {
    return this.beliefs.get(claim)?.confidence ?? null;
  }

  // 베이즈식 업데이트: 새 증거로 확신 조정
  // evidence > 0.5: 긍정 증거 (확신 증가), < 0.5: 부정 증거 (확신 감소)
  update(claim: string, evidenceStrength: number, eventName = 'evidence'): number {
    const belief = this.beliefs.get(claim);
    if (!belief) return 0;

    const prior = belief.confidence;
    // 간단한 베이즈 업데이트: posterior ∝ prior × likelihood
    // likelihood = evidenceStrength (긍정) or (1 - evidenceStrength) (부정)
    const likelihood = evidenceStrength > 0.5 ? evidenceStrength : (1 - evidenceStrength);
    const direction = evidenceStrength > 0.5 ? 1 : -1;
    const delta = direction * likelihood * (1 - Math.abs(prior - 0.5)) * 0.3;
    const posterior = Math.max(0.01, Math.min(0.99, prior + delta));

    belief.history.push({ event: eventName, delta: posterior - prior, timestamp: Date.now() });
    belief.confidence = posterior;
    return posterior;
  }

  // 부정 (반대로 업데이트)
  negate(claim: string): number {
    return this.update(claim, 0.1, 'negation');
  }

  // 모든 신념 목록
  list(): Belief[] { return [...this.beliefs.values()]; }

  // 가장 확신이 높은 신념
  strongest(): Belief | null {
    const all = this.list();
    if (all.length === 0) return null;
    return all.reduce((best, b) => b.confidence > best.confidence ? b : best);
  }

  // 특정 임계값 이상 신념들
  certain(threshold = 0.8): Belief[] {
    return this.list().filter(b => b.confidence >= threshold);
  }

  // 신념 삭제
  forget(claim: string): boolean { return this.beliefs.delete(claim); }

  // 크기
  size(): number { return this.beliefs.size; }
}

export const globalBeliefs = new BeliefSystem();
