export type RefactorPattern = 'extract-duplicate' | 'simplify-condition' | 'flatten-nesting' | 'rename-unclear' | 'split-long-function' | 'inline-single-use';
export interface RefactorSuggestion {
    pattern: RefactorPattern;
    location: string;
    original: string;
    suggested: string;
    reason: string;
    impact: 'low' | 'medium' | 'high';
}
export interface RefactorResult {
    suggestions: RefactorSuggestion[];
    applied: number;
    skipped: number;
    score: {
        before: number;
        after: number;
        improvement: number;
    };
}
interface NamingIssue {
    name: string;
    suggestion: string;
    reason: string;
}
interface ComplexityResult {
    lines: number;
    depth: number;
    conditions: number;
    score: number;
}
interface NamingResult {
    issues: NamingIssue[];
    score: number;
}
export declare class SelfRefactorer {
    /**
     * 중복 코드 블록 감지
     */
    findDuplicates(code: string): RefactorSuggestion[];
    /**
     * 복잡도 분석
     */
    analyzeComplexity(code: string): ComplexityResult;
    /**
     * 리팩토링 제안 생성
     */
    suggest(code: string): RefactorSuggestion[];
    /**
     * 자동 리팩토링 적용 (확신도 높은 것만 적용)
     */
    apply(code: string, suggestions: RefactorSuggestion[]): {
        code: string;
        applied: RefactorSuggestion[];
    };
    /**
     * 코드 품질 점수 (0~1, 높을수록 좋음)
     */
    qualityScore(code: string): number;
    /**
     * 명명 규칙 분석
     */
    analyzeNaming(code: string): NamingResult;
    /**
     * 전체 리팩토링 파이프라인
     */
    refactor(code: string, autoApply?: boolean): RefactorResult;
}
export declare const globalRefactorer: SelfRefactorer;
export {};
//# sourceMappingURL=refactor-self.d.ts.map