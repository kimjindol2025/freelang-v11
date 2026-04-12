export type Severity = 'critical' | 'major' | 'minor' | 'suggestion';
export interface CritiquePoint {
    type: 'weakness' | 'counterexample' | 'assumption' | 'missing';
    description: string;
    severity: Severity;
    suggestion?: string;
}
export interface CritiqueResult {
    output: any;
    points: CritiquePoint[];
    overallRisk: number;
    approved: boolean;
    summary: string;
}
export interface CritiqueConfig {
    finders: Array<(output: any) => CritiquePoint[]>;
    riskThreshold?: number;
}
export declare function severityWeight(s: Severity): number;
export declare class CritiqueAgent {
    run(output: any, config: CritiqueConfig): CritiqueResult;
}
export declare const defaultFinders: Array<(output: any) => CritiquePoint[]>;
export declare const globalCritique: CritiqueAgent;
//# sourceMappingURL=critique.d.ts.map