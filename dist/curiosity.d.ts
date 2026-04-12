export interface KnowledgeGap {
    topic: string;
    unknownAspects: string[];
    priority: number;
    explorationCost: number;
    expectedGain: number;
}
export interface CuriosityState {
    explored: Set<string>;
    frontier: string[];
    knowledgeGaps: KnowledgeGap[];
    curiosityScore: number;
    explorationHistory: Array<{
        topic: string;
        gain: number;
        timestamp: Date;
    }>;
}
export interface ExplorationResult {
    topic: string;
    discovered: string[];
    newQuestions: string[];
    informationGain: number;
    surpriseLevel: number;
    relatedTopics: string[];
}
/**
 * CuriosityEngine — 호기심 기반 탐색 엔진
 *
 * 핵심 아이디어:
 *   - 정보가 적을수록 → curiosity 높음
 *   - UCB1으로 exploration/exploitation 균형
 *   - 탐색 시 새 질문(frontier) 자동 생성
 */
export declare class CuriosityEngine {
    private state;
    private ucb1Stats;
    private totalVisits;
    constructor(initialTopics?: string[]);
    /**
     * 호기심 점수 계산
     * - knownFacts가 많을수록 낮음 (이미 알고 있으니 덜 궁금)
     * - knownFacts가 없을수록 높음 (아무것도 모르니 궁금)
     */
    computeCuriosity(topic: string, knownFacts: string[]): number;
    /**
     * 다음 탐색 대상 선택 (UCB1 기반)
     * UCB1 = avgGain + C * sqrt(ln(N) / n_i)
     * C = 탐색 계수 (1.41 = sqrt(2))
     */
    selectNextTopic(): string | null;
    /**
     * 탐색 수행
     * explorerFunc: (topic) => { facts, questions }
     */
    explore(topic: string, explorerFunc: (topic: string) => {
        facts: string[];
        questions: string[];
    }): ExplorationResult;
    /**
     * 지식 공백 식별
     * allTopics에는 있지만 knownTopics에 없는 것 = 공백
     */
    identifyGaps(knownTopics: string[], allTopics: string[]): KnowledgeGap[];
    /**
     * 호기심 기반 질문 생성
     * topic + context를 바탕으로 탐색 질문 생성
     */
    generateQuestions(topic: string, context: string[]): string[];
    /**
     * 탐색 우선순위 결정 (UCB1)
     * topics 목록에서 UCB1 점수 기준 내림차순 정렬
     */
    prioritize(topics: string[]): string[];
    /**
     * 탐색 이력 분석
     */
    analyzeExplorationHistory(): {
        totalExplored: number;
        avgInfoGain: number;
        mostSurprising: string;
        recommendations: string[];
    };
    /**
     * 현재 상태 반환
     */
    getState(): CuriosityState;
}
export declare const globalCuriosity: CuriosityEngine;
//# sourceMappingURL=curiosity.d.ts.map