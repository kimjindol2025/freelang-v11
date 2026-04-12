export type MutationType = 'random' | 'gaussian' | 'swap' | 'flip' | 'insert' | 'delete' | 'replace';
export interface MutationConfig {
    rate: number;
    strength: number;
    type: MutationType;
}
export interface MutationResult<T> {
    original: T;
    mutated: T;
    mutations: number;
    mutationType: MutationType;
}
export declare class Mutator<T> {
    private config;
    constructor(config?: Partial<MutationConfig>);
    getConfig(): MutationConfig;
    mutateNumbers(arr: number[]): MutationResult<number[]>;
    mutateString(s: string): MutationResult<string>;
    mutateObject(obj: Record<string, unknown>): MutationResult<Record<string, unknown>>;
    swapMutation<U>(arr: U[]): MutationResult<U[]>;
    flipMutation(bits: number[]): MutationResult<number[]>;
    select<U>(candidates: Array<{
        value: U;
        fitness: number;
    }>, n: number): U[];
}
export declare const globalMutator: Mutator<unknown>;
export declare function mutateNumbers(arr: number[], rate?: number): MutationResult<number[]>;
export declare function mutateString(s: string, rate?: number): MutationResult<string>;
export declare function selectBest<T>(items: Array<{
    value: T;
    fitness: number;
}>, ratio?: number): T[];
//# sourceMappingURL=mutate.d.ts.map