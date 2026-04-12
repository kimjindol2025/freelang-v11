export interface Pattern {
    id: string;
    description: string;
    solution: any;
    tags: string[];
    useCount: number;
    similarity?: number;
}
export declare function similarity(a: string, b: string): number;
export declare class AnalogyStore {
    private patterns;
    private counter;
    store(description: string, solution: any, tags?: string[]): Pattern;
    find(problem: string, topK?: number): Pattern[];
    best(problem: string): Pattern | null;
    byTag(tag: string): Pattern[];
    popular(n?: number): Pattern[];
    size(): number;
    all(): Pattern[];
}
export declare const globalAnalogy: AnalogyStore;
//# sourceMappingURL=analogy.d.ts.map