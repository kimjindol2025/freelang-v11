export interface Experience {
    id: string;
    situation: string;
    action: string;
    outcome: string;
    lesson: string;
    success: boolean;
    importance: number;
    timestamp: Date;
    domain: string;
}
export interface Heuristic {
    id: string;
    rule: string;
    confidence: number;
    successCount: number;
    totalCount: number;
    domain: string;
    derivedFrom: string[];
}
export interface WisdomJudgment {
    situation: string;
    recommendation: string;
    reasoning: string[];
    relevantExperiences: Experience[];
    applicableHeuristics: Heuristic[];
    confidence: number;
    caveats: string[];
    alternatives: string[];
}
export declare class WisdomEngine {
    private experiences;
    private heuristics;
    constructor();
    /**
     * 경험 추가
     */
    addExperience(exp: Omit<Experience, 'id' | 'timestamp'>): Experience;
    /**
     * 경험에서 휴리스틱 추출 (도메인별 그룹화)
     */
    extractHeuristics(): Heuristic[];
    /**
     * 유사한 경험들 그룹화
     */
    private _groupSimilarExperiences;
    /**
     * 상황에 맞는 경험 검색 (유사도 기반)
     */
    findRelevantExperiences(situation: string, limit?: number): Experience[];
    /**
     * 지혜 판단 — 현재 상황에 대한 종합 판단
     */
    judge(situation: string): WisdomJudgment;
    /**
     * 적용 가능한 휴리스틱 찾기
     */
    private _findApplicableHeuristics;
    /**
     * 도메인별 요약
     */
    summarizeDomain(domain: string): {
        topLessons: string[];
        bestHeuristics: Heuristic[];
        successRate: number;
    };
    /**
     * 경험 유효성 검사 (최근 180일 이내 경험만 유효)
     */
    isStillValid(experience: Experience): boolean;
    /**
     * 지혜 점수 계산 (경험의 깊이 + 판단력)
     */
    wisdomScore(): number;
    /**
     * 교훈 목록 반환
     */
    getLessons(domain?: string): string[];
    /**
     * 유사 상황 과거 사례 반환
     */
    findSimilarCases(situation: string): Experience[];
    /**
     * 전체 경험 목록 반환
     */
    getExperiences(): Experience[];
    /**
     * 전체 휴리스틱 목록 반환
     */
    getHeuristics(): Heuristic[];
}
export declare const globalWisdom: WisdomEngine;
//# sourceMappingURL=wisdom.d.ts.map