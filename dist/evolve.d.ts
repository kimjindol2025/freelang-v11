export interface Individual<T> {
    genome: T;
    fitness: number;
    generation: number;
    id: string;
}
export interface EvolutionConfig<T> {
    populationSize: number;
    maxGenerations: number;
    mutationRate: number;
    eliteRatio: number;
    fitnessGoal?: number;
    fitnessFunc: (genome: T) => number;
    mutateFunc: (genome: T, rate: number) => T;
    crossoverFunc: (a: T, b: T) => T;
    initFunc: () => T;
}
export interface EvolutionResult<T> {
    best: Individual<T>;
    population: Individual<T>[];
    generations: number;
    converged: boolean;
    history: Array<{
        gen: number;
        bestFitness: number;
        avgFitness: number;
    }>;
}
export declare class EvolutionEngine<T> {
    private config;
    private population;
    private currentGeneration;
    private history;
    constructor(config: EvolutionConfig<T>);
    initialize(): void;
    select(): Individual<T>;
    step(): {
        bestFitness: number;
        avgFitness: number;
    };
    run(): EvolutionResult<T>;
    getBest(): Individual<T> | null;
    getPopulation(): Individual<T>[];
    getHistory(): Array<{
        gen: number;
        bestFitness: number;
        avgFitness: number;
    }>;
}
export declare function evolveNumbers(target: number[], populationSize?: number, maxGenerations?: number): EvolutionResult<number[]>;
export declare function evolveStrings(target: string, populationSize?: number, maxGenerations?: number): EvolutionResult<string>;
//# sourceMappingURL=evolve.d.ts.map