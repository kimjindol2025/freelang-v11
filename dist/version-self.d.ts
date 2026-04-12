export interface Snapshot<T> {
    id: string;
    version: string;
    timestamp: Date;
    data: T;
    metadata: {
        description: string;
        tags: string[];
        performance?: number;
        author?: string;
    };
    parentId?: string;
    diff?: string;
}
export interface VersionHistory<T> {
    snapshots: Snapshot<T>[];
    current: string;
    total: number;
    branches: Map<string, string>;
}
export interface RollbackResult<T> {
    previous: Snapshot<T>;
    restored: Snapshot<T>;
    success: boolean;
    reason?: string;
}
export declare class SelfVersioning<T> {
    private history;
    private maxHistory;
    constructor(maxHistory?: number);
    snapshot(data: T, description: string, tags?: string[], performance?: number): Snapshot<T>;
    rollback(id: string): RollbackResult<T>;
    rollbackPrev(): RollbackResult<T>;
    diff(id1: string, id2: string): string;
    get(id: string): Snapshot<T> | null;
    latest(): Snapshot<T> | null;
    getHistory(): Snapshot<T>[];
    findByTag(tag: string): Snapshot<T>[];
    branch(name: string, fromId?: string): string;
    checkout(branchName: string): Snapshot<T> | null;
    nextVersion(type: "major" | "minor" | "patch"): string;
    private bumpVersion;
    bestPerforming(): Snapshot<T> | null;
}
export declare const globalVersioning: SelfVersioning<unknown>;
//# sourceMappingURL=version-self.d.ts.map