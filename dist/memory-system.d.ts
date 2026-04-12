export type MemoryScope = 'long-term' | 'short-term' | 'episode';
export interface MemoryEntry {
    key: string;
    value: any;
    scope: MemoryScope;
    ttl: number | 'forever';
    createdAt: number;
    accessCount: number;
    tags: string[];
}
export interface Episode {
    id: string;
    what: string;
    when: number;
    context: any;
    outcome?: any;
}
export declare class MemorySystem {
    private longTerm;
    private shortTerm;
    private episodes;
    private working;
    remember(key: string, value: any, options?: {
        scope?: MemoryScope;
        ttl?: number | 'forever';
        tags?: string[];
    }): void;
    recall(key: string, fallback?: any): any;
    forget(key: string): boolean;
    recordEpisode(id: string, what: string, context?: any, outcome?: any): Episode;
    searchEpisodes(query: string): Episode[];
    setWorking(value: any): void;
    getWorking(): any;
    clearWorking(): void;
    searchByTag(tag: string): MemoryEntry[];
    keys(scope?: MemoryScope): string[];
    purgeExpired(): number;
    stats(): {
        longTerm: number;
        shortTerm: number;
        episodes: number;
    };
    clear(): void;
}
export declare const globalMemory: MemorySystem;
//# sourceMappingURL=memory-system.d.ts.map