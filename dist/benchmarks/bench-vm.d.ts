import { BenchmarkResult } from "./bench-runner";
export declare function runVMBenchmarks(): BenchmarkResult[];
export interface ComparisonResult {
    operation: string;
    interpreterOpsPerSec: number;
    vmOpsPerSec: number;
    speedup: number;
}
export declare function compareInterpreterVsVM(interpreterResults: BenchmarkResult[], vmResults: BenchmarkResult[]): ComparisonResult[];
//# sourceMappingURL=bench-vm.d.ts.map