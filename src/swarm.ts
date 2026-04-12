// swarm.ts — FreeLang v9 Phase 125: 군집 지능 블록
// [SWARM] 블록: 파티클 스웜 최적화 (PSO) 기반 군집 지능

export interface Particle {
  id: string;
  position: number;
  velocity: number;
  bestPosition: number;
  bestScore: number;
}

export interface SwarmResult {
  bestPosition: number;
  bestScore: number;
  iterations: number;
  particles: Particle[];
  converged: boolean;
}

export class Swarm {
  optimize(config: {
    objective: (x: number) => number;  // 최대화할 함수
    particles?: number;                 // 입자 수 (default: 10)
    iterations?: number;                // 최대 반복 (default: 50)
    bounds?: [number, number];          // [min, max] (default: [0, 1])
    tolerance?: number;                 // 수렴 기준 (default: 0.001)
  }): SwarmResult {
    const {
      objective,
      particles: n = 10,
      iterations: maxIter = 50,
      bounds = [0, 1],
      tolerance = 0.001,
    } = config;
    const [min, max] = bounds;
    const range = max - min;

    // 초기화
    const ps: Particle[] = Array.from({ length: n }, (_, i) => {
      const pos = min + Math.random() * range;
      const score = objective(pos);
      return {
        id: `p${i}`,
        position: pos,
        velocity: (Math.random() - 0.5) * range * 0.1,
        bestPosition: pos,
        bestScore: score,
      };
    });

    let globalBest = ps.reduce((b, p) => (p.bestScore > b.bestScore ? p : b));
    let prevBestScore = -Infinity;
    let iter = 0;
    let converged = false;

    for (iter = 0; iter < maxIter; iter++) {
      for (const p of ps) {
        // 속도 업데이트 (PSO 공식)
        const w = 0.7, c1 = 1.5, c2 = 1.5;
        p.velocity =
          w * p.velocity +
          c1 * Math.random() * (p.bestPosition - p.position) +
          c2 * Math.random() * (globalBest.bestPosition - p.position);
        p.position = Math.max(min, Math.min(max, p.position + p.velocity));
        const score = objective(p.position);
        if (score > p.bestScore) {
          p.bestScore = score;
          p.bestPosition = p.position;
        }
        if (score > globalBest.bestScore) globalBest = p;
      }
      if (Math.abs(globalBest.bestScore - prevBestScore) < tolerance) {
        converged = true;
        break;
      }
      prevBestScore = globalBest.bestScore;
    }

    return {
      bestPosition: globalBest.bestPosition,
      bestScore: globalBest.bestScore,
      iterations: iter + 1,
      particles: ps,
      converged,
    };
  }
}

export const globalSwarm = new Swarm();
