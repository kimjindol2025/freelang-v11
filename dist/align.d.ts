export interface Goal {
    id: string;
    description: string;
    priority: number;
    measurable: boolean;
    metric?: string;
    target?: number;
}
export interface Value {
    id: string;
    name: string;
    description: string;
    weight: number;
}
export interface Action {
    id: string;
    description: string;
    expectedOutcomes: Record<string, number>;
    risks: string[];
}
export interface AlignmentScore {
    action: Action;
    goalAlignment: Record<string, number>;
    valueAlignment: Record<string, number>;
    overallScore: number;
    conflicts: Array<{
        goal1: string;
        goal2: string;
        severity: 'low' | 'medium' | 'high';
    }>;
    recommendation: 'proceed' | 'caution' | 'reject';
    reasons: string[];
}
export declare class AlignmentSystem {
    private goals;
    private values;
    constructor();
    addGoal(goal: Goal): void;
    addValue(value: Value): void;
    score(action: Action): AlignmentScore;
    private _detectActionConflicts;
    selectBestAligned(actions: Action[]): Action;
    detectConflicts(): Array<{
        goal1: string;
        goal2: string;
        description: string;
    }>;
    evaluatePlan(actions: Action[]): {
        overallAlignment: number;
        weakLinks: Action[];
        summary: string;
    };
    suggestImprovements(action: Action): string[];
    prioritizeGoals(): Goal[];
    getGoals(): Map<string, Goal>;
    getValues(): Map<string, Value>;
}
export declare const globalAlignment: AlignmentSystem;
//# sourceMappingURL=align.d.ts.map