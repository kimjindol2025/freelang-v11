import { Chunk } from "./bytecode";
export interface OptimizationPass {
    name: string;
    run(chunk: Chunk): Chunk;
}
export declare const constantFoldingPass: OptimizationPass;
export declare const deadCodeEliminationPass: OptimizationPass;
export declare const pushPopEliminationPass: OptimizationPass;
export declare const jumpOptimizationPass: OptimizationPass;
export declare class Optimizer {
    private passes;
    private stats;
    addPass(pass: OptimizationPass): this;
    optimize(chunk: Chunk): Chunk;
    getStats(): {
        passName: string;
        reduced: number;
    }[];
}
export declare function createDefaultOptimizer(): Optimizer;
//# sourceMappingURL=optimizer.d.ts.map