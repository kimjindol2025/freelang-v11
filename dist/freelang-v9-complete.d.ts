export interface FreeLangV9Config {
    enableMemory?: boolean;
    enableRag?: boolean;
    enableMultiAgent?: boolean;
    enableEvolution?: boolean;
    enableWorldModel?: boolean;
    enableEthics?: boolean;
    enableWisdom?: boolean;
    enableAlignment?: boolean;
    enableCuriosity?: boolean;
    maxTokens?: number;
}
export interface FreeLangV9Status {
    version: string;
    tiers: Record<string, boolean>;
    phases: number;
    features: string[];
    uptime: number;
    memoryUsed?: number;
}
export interface FreeLangV9Response {
    input: string;
    output: unknown;
    reasoning?: string[];
    confidence?: number;
    ethicsCheck?: {
        passed: boolean;
        score: number;
    };
    aligned?: boolean;
    wisdom?: string;
    executionMs: number;
}
export declare class FreeLangV9 {
    private config;
    private startTime;
    private enabledFeatures;
    private worldModel;
    private wisdom;
    private ethics;
    private alignment;
    private curiosity;
    constructor(config?: FreeLangV9Config);
    /**
     * 통합 처리 (추론 + 윤리검사 + 정렬 + 지혜)
     */
    process(input: string, context?: Record<string, unknown>): FreeLangV9Response;
    /**
     * 신뢰도 추정
     */
    private _estimateConfidence;
    /**
     * 상태 조회
     */
    status(): FreeLangV9Status;
    /**
     * 기능 활성화
     */
    enable(feature: string): void;
    /**
     * 기능 비활성화
     */
    disable(feature: string): void;
    /**
     * 완전한 AI 사이클 (think → check → align → respond)
     */
    thinkCheckAlignRespond(problem: string, constraints?: string[]): FreeLangV9Response;
    /**
     * 자기 진단
     */
    selfDiagnose(): {
        healthy: boolean;
        issues: string[];
        recommendations: string[];
        score: number;
    };
    /**
     * 버전 정보
     */
    getVersion(): string;
    /**
     * 기능 목록
     */
    getFeatures(): string[];
}
export declare const freelangV9: FreeLangV9;
export declare const FREELANG_V9_MANIFEST: {
    version: string;
    phases: number;
    tiers: number;
    description: string;
    completedAt: string;
    features: string[];
    tiers_detail: {
        tier1: string;
        tier2: string;
        tier3: string;
        tier4: string;
        tier5: string;
        tier6: string;
        tier7: string;
        tier8: string;
        tier9: string;
        tier10: string;
    };
    philosophy: string[];
};
//# sourceMappingURL=freelang-v9-complete.d.ts.map