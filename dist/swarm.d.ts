export interface Particle {
    id: string;
    position: number;
    velocity: number;
    bestPosition: number;
    bestScore: number;
}
export interface SwarmResult {
    bestPosition: number;
    bestScore: number;
    iterations: number;
    particles: Particle[];
    converged: boolean;
}
export declare class Swarm {
    optimize(config: {
        objective: (x: number) => number;
        particles?: number;
        iterations?: number;
        bounds?: [number, number];
        tolerance?: number;
    }): SwarmResult;
}
export declare const globalSwarm: Swarm;
//# sourceMappingURL=swarm.d.ts.map