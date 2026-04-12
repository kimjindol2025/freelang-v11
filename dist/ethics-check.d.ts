export type EthicsFramework = 'utilitarian' | 'deontological' | 'virtue' | 'care' | 'fairness';
export interface EthicsViolation {
    principle: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestion: string;
    framework: EthicsFramework;
}
export interface EthicsCheckResult {
    subject: string;
    passed: boolean;
    violations: EthicsViolation[];
    score: number;
    frameworks: Record<EthicsFramework, {
        passed: boolean;
        score: number;
    }>;
    recommendation: string;
    requiresHumanReview: boolean;
}
export interface EthicsPrinciple {
    id: string;
    name: string;
    description: string;
    framework: EthicsFramework;
    check: (subject: string, context: Record<string, unknown>) => {
        passed: boolean;
        reason: string;
    };
}
export declare class EthicsChecker {
    private principles;
    constructor();
    addPrinciple(principle: EthicsPrinciple): void;
    check(subject: string, context?: Record<string, unknown>): EthicsCheckResult;
    checkByFramework(subject: string, framework: EthicsFramework, context?: Record<string, unknown>): {
        passed: boolean;
        score: number;
        violations: EthicsViolation[];
    };
    isEthical(subject: string, context?: Record<string, unknown>): boolean;
    suggestEthicalAlternative(subject: string, violations: EthicsViolation[]): string;
    riskLevel(result: EthicsCheckResult): 'none' | 'low' | 'medium' | 'high' | 'critical';
    private _determineSeverity;
    private _generateSuggestion;
    private _severityPenalty;
    private _generateRecommendation;
}
export declare const globalEthics: EthicsChecker;
//# sourceMappingURL=ethics-check.d.ts.map