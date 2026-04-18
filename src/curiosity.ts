// curiosity.ts — FreeLang v9 Phase 148: [CURIOSITY]
// AI가 호기심을 가지고 미지의 영역을 탐색하는 시스템
// 정보 이득을 최대화하는 방향으로 탐색 (UCB1 알고리즘)

export interface KnowledgeGap {
  topic: string;
  unknownAspects: string[];
  priority: number;       // 0~1 (얼마나 중요한 공백인가)
  explorationCost: number; // 탐색 비용
  expectedGain: number;   // 예상 정보 이득
}

export interface CuriosityState {
  explored: Set<string>;      // 탐색 완료 항목
  frontier: string[];         // 탐색 대기 항목
  knowledgeGaps: KnowledgeGap[];
  curiosityScore: number;     // 현재 호기심 수준 0~1
  explorationHistory: Array<{ topic: string; gain: number; timestamp: Date }>;
}

export interface ExplorationResult {
  topic: string;
  discovered: string[];       // 발견된 새 정보
  newQuestions: string[];     // 생성된 새 질문
  informationGain: number;    // 정보 이득량
  surpriseLevel: number;      // 0~1 (예상치 못한 발견)
  relatedTopics: string[];    // 연관 탐색 후보
}

// UCB1 관련 내부 상태
interface UCB1Stats {
  visits: number;
  totalGain: number;
}

/**
 * CuriosityEngine — 호기심 기반 탐색 엔진
 *
 * 핵심 아이디어:
 *   - 정보가 적을수록 → curiosity 높음
 *   - UCB1으로 exploration/exploitation 균형
 *   - 탐색 시 새 질문(frontier) 자동 생성
 */
export class CuriosityEngine {
  private state: CuriosityState;
  private ucb1Stats: Map<string, UCB1Stats>;
  private totalVisits: number;

  constructor(initialTopics?: string[]) {
    this.state = {
      explored: new Set<string>(),
      frontier: initialTopics ? [...initialTopics] : [],
      knowledgeGaps: [],
      curiosityScore: 0.5,
      explorationHistory: [],
    };
    this.ucb1Stats = new Map();
    this.totalVisits = 0;

    // 초기 주제 UCB1 초기화
    for (const t of this.state.frontier) {
      this.ucb1Stats.set(t, { visits: 0, totalGain: 0 });
    }
  }

  /**
   * 호기심 점수 계산
   * - knownFacts가 많을수록 낮음 (이미 알고 있으니 덜 궁금)
   * - knownFacts가 없을수록 높음 (아무것도 모르니 궁금)
   */
  computeCuriosity(topic: string, knownFacts: string[]): number {
    // 기본 호기심: 알려진 사실이 없으면 최대
    const baseCuriosity = knownFacts.length === 0 ? 1.0 : Math.max(0, 1.0 - knownFacts.length * 0.15);

    // 이미 탐색된 주제는 호기심 감소
    const explorationPenalty = this.state.explored.has(topic) ? 0.3 : 0;

    // 호기심 점수 계산 (0~1 클램프)
    const raw = baseCuriosity - explorationPenalty;
    return Math.max(0, Math.min(1, raw));
  }

  /**
   * 다음 탐색 대상 선택 (UCB1 기반)
   * UCB1 = avgGain + C * sqrt(ln(N) / n_i)
   * C = 탐색 계수 (1.41 = sqrt(2))
   */
  selectNextTopic(): string | null {
    if (this.state.frontier.length === 0) return null;

    const C = Math.SQRT2;
    const N = Math.max(1, this.totalVisits);

    let bestTopic: string | null = null;
    let bestScore = -Infinity;

    for (const topic of this.state.frontier) {
      const stats = this.ucb1Stats.get(topic) ?? { visits: 0, totalGain: 0 };
      const avgGain = stats.visits > 0 ? stats.totalGain / stats.visits : 0;
      const exploration = C * Math.sqrt(Math.log(N + 1) / (stats.visits + 1));
      const ucb1Score = avgGain + exploration;

      if (ucb1Score > bestScore) {
        bestScore = ucb1Score;
        bestTopic = topic;
      }
    }

    return bestTopic;
  }

  /**
   * 탐색 수행
   * explorerFunc: (topic) => { facts, questions }
   */
  explore(
    topic: string,
    explorerFunc: (topic: string) => { facts: string[]; questions: string[] }
  ): ExplorationResult {
    const { facts, questions } = explorerFunc(topic);

    // 새로운 발견 = 아직 모르는 사실들
    const discovered = facts.filter(f => !this.state.explored.has(f));

    // 정보 이득 계산
    const informationGain = discovered.length > 0
      ? Math.min(1, discovered.length * 0.2)
      : 0.05; // 최소한의 이득

    // surpriseLevel: 예상치 못한 발견 비율
    const surpriseLevel = facts.length > 0
      ? Math.min(1, discovered.length / facts.length)
      : 0;

    // 연관 주제: 새 질문에서 추출
    const relatedTopics = questions
      .map(q => q.split(/[?!.,]/)[0].trim())
      .filter(t => t.length > 0 && !this.state.explored.has(t));

    // 상태 업데이트
    this.state.explored.add(topic);
    this.state.frontier = this.state.frontier.filter(t => t !== topic);

    // 새 frontier 추가 (중복 제거)
    for (const rt of relatedTopics) {
      if (!this.state.frontier.includes(rt) && !this.state.explored.has(rt)) {
        this.state.frontier.push(rt);
        if (!this.ucb1Stats.has(rt)) {
          this.ucb1Stats.set(rt, { visits: 0, totalGain: 0 });
        }
      }
    }

    // UCB1 통계 업데이트
    const stats = this.ucb1Stats.get(topic) ?? { visits: 0, totalGain: 0 };
    stats.visits += 1;
    stats.totalGain += informationGain;
    this.ucb1Stats.set(topic, stats);
    this.totalVisits += 1;

    // 탐색 이력 기록
    this.state.explorationHistory.push({
      topic,
      gain: informationGain,
      timestamp: new Date(),
    });

    // 호기심 점수 업데이트 (탐색할수록 감소, 새 발견이 많으면 유지)
    this.state.curiosityScore = Math.max(
      0.1,
      this.state.curiosityScore - 0.05 + surpriseLevel * 0.1
    );

    return {
      topic,
      discovered,
      newQuestions: questions,
      informationGain,
      surpriseLevel,
      relatedTopics,
    };
  }

  /**
   * 지식 공백 식별
   * allTopics에는 있지만 knownTopics에 없는 것 = 공백
   */
  identifyGaps(knownTopics: string[], allTopics: string[]): KnowledgeGap[] {
    const knownSet = new Set(knownTopics);
    const gaps: KnowledgeGap[] = [];

    for (const topic of allTopics) {
      if (!knownSet.has(topic)) {
        const unknownAspects = [
          `${topic}의 정의`,
          `${topic}의 원리`,
          `${topic}의 응용`,
        ];
        const priority = this.state.explored.has(topic) ? 0.3 : 0.7;
        const explorationCost = 0.5;
        const expectedGain = priority * (1 - explorationCost);

        gaps.push({
          topic,
          unknownAspects,
          priority,
          explorationCost,
          expectedGain,
        });
      }
    }

    // priority 내림차순 정렬
    gaps.sort((a, b) => b.priority - a.priority);
    this.state.knowledgeGaps = gaps;

    return gaps;
  }

  /**
   * 호기심 기반 질문 생성
   * topic + context를 바탕으로 탐색 질문 생성
   */
  generateQuestions(topic: string, context: string[]): string[] {
    const questions: string[] = [
      `${topic}란 무엇인가?`,
      `${topic}은 어떻게 동작하는가?`,
      `${topic}의 한계는 무엇인가?`,
      `${topic}은 무엇과 연관되어 있는가?`,
    ];

    // context 기반 추가 질문
    for (const ctx of context.slice(0, 3)) {
      questions.push(`${ctx}와 ${topic}의 관계는?`);
    }

    return questions;
  }

  /**
   * 탐색 우선순위 결정 (UCB1)
   * topics 목록에서 UCB1 점수 기준 내림차순 정렬
   */
  prioritize(topics: string[]): string[] {
    const C = Math.SQRT2;
    const N = Math.max(1, this.totalVisits);

    return [...topics].sort((a, b) => {
      const sA = this.ucb1Stats.get(a) ?? { visits: 0, totalGain: 0 };
      const sB = this.ucb1Stats.get(b) ?? { visits: 0, totalGain: 0 };

      const scoreA = (sA.visits > 0 ? sA.totalGain / sA.visits : 0)
        + C * Math.sqrt(Math.log(N + 1) / (sA.visits + 1));
      const scoreB = (sB.visits > 0 ? sB.totalGain / sB.visits : 0)
        + C * Math.sqrt(Math.log(N + 1) / (sB.visits + 1));

      return scoreB - scoreA; // 내림차순
    });
  }

  /**
   * 탐색 이력 분석
   */
  analyzeExplorationHistory(): {
    totalExplored: number;
    avgInfoGain: number;
    mostSurprising: string;
    recommendations: string[];
  } {
    const history = this.state.explorationHistory;
    const totalExplored = history.length;
    const avgInfoGain = totalExplored > 0
      ? history.reduce((s, h) => s + h.gain, 0) / totalExplored
      : 0;

    // 가장 높은 gain을 가진 탐색
    const mostSurprising = history.length > 0
      ? history.reduce((best, h) => h.gain > best.gain ? h : best, history[0]).topic
      : "없음";

    // 추천: frontier에서 UCB1 상위 3개
    const topFrontier = this.prioritize(this.state.frontier).slice(0, 3);
    const recommendations = topFrontier.length > 0
      ? topFrontier.map(t => `${t} 탐색 권장`)
      : ["탐색 대상 추가 필요"];

    return { totalExplored, avgInfoGain, mostSurprising, recommendations };
  }

  /**
   * 현재 상태 반환
   */
  getState(): CuriosityState {
    return {
      explored: new Set(this.state.explored),
      frontier: [...this.state.frontier],
      knowledgeGaps: [...this.state.knowledgeGaps],
      curiosityScore: this.state.curiosityScore,
      explorationHistory: [...this.state.explorationHistory],
    };
  }
}

// 전역 CuriosityEngine 인스턴스
export const globalCuriosity = new CuriosityEngine();
