export interface ReflectionCriteria {
    name: string;
    check: (output: any) => number;
    weight?: number;
}
export interface ReflectionResult {
    output: any;
    scores: Record<string, number>;
    totalScore: number;
    passed: boolean;
    feedback: string[];
    revised?: any;
}
export declare const CRITERIA: Record<string, ReflectionCriteria>;
export declare class Reflector {
    private criteriaList;
    addCriteria(c: ReflectionCriteria): this;
    reflect(output: any, threshold?: number): ReflectionResult;
    revise(result: ReflectionResult, reviseFn: (r: ReflectionResult) => any): ReflectionResult;
    toMarkdown(): string;
    getCriteriaList(): ReflectionCriteria[];
}
export interface ReflectFormOptions {
    output: any;
    criteria: Array<(v: any) => number>;
    threshold?: number;
    onFail?: (result: ReflectionResult) => any;
    revise?: (result: ReflectionResult) => any;
}
export declare function evalReflectForm(opts: ReflectFormOptions): ReflectionResult;
//# sourceMappingURL=reflect.d.ts.map