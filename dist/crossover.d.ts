export type CrossoverType = 'single-point' | 'two-point' | 'uniform' | 'blend' | 'arithmetic';
export interface CrossoverConfig {
    type: CrossoverType;
    rate: number;
    blendAlpha?: number;
}
export interface CrossoverResult<T> {
    parent1: T;
    parent2: T;
    child1: T;
    child2: T;
    crossoverPoint?: number;
    crossoverPoints?: [number, number];
    type: CrossoverType;
}
export declare class Crossover<T> {
    private config;
    constructor(config?: Partial<CrossoverConfig>);
    singlePoint<U>(a: U[], b: U[]): CrossoverResult<U[]>;
    twoPoint<U>(a: U[], b: U[]): CrossoverResult<U[]>;
    uniform<U>(a: U[], b: U[]): CrossoverResult<U[]>;
    arithmetic(a: number[], b: number[], alpha?: number): CrossoverResult<number[]>;
    crossoverStrings(a: string, b: string): CrossoverResult<string>;
    crossoverObjects(a: Record<string, unknown>, b: Record<string, unknown>): CrossoverResult<Record<string, unknown>>;
    cross(a: T, b: T): CrossoverResult<T>;
}
export declare const globalCrossover: Crossover<unknown>;
export declare function crossoverNumbers(a: number[], b: number[]): CrossoverResult<number[]>;
export declare function crossoverStrings(a: string, b: string): CrossoverResult<string>;
//# sourceMappingURL=crossover.d.ts.map