export interface ContextEntry {
    id: string;
    content: any;
    tokens: number;
    priority: number;
    timestamp: number;
    tags: string[];
}
export type ContextStrategy = "sliding" | "priority" | "summarize";
export interface ContextWindow {
    maxTokens: number;
    entries: ContextEntry[];
    usedTokens: number;
    strategy: ContextStrategy;
}
export declare class ContextManager {
    private window;
    constructor(maxTokens?: number, strategy?: ContextStrategy);
    estimateTokens(content: any): number;
    hasRoom(tokens: number): boolean;
    add(content: any, opts?: {
        priority?: number;
        tags?: string[];
        tokens?: number;
    }): string;
    get(id: string): ContextEntry | undefined;
    remove(id: string): void;
    trim(): ContextEntry[];
    compress(fn: (entries: ContextEntry[]) => any): any;
    getAll(tag?: string): ContextEntry[];
    stats(): {
        used: number;
        max: number;
        percent: number;
        count: number;
    };
}
//# sourceMappingURL=context-window.d.ts.map