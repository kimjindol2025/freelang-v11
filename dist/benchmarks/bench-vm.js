"use strict";
// FreeLang v9 Phase 89: 바이트코드 VM 성능 측정
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVMBenchmarks = runVMBenchmarks;
exports.compareInterpreterVsVM = compareInterpreterVsVM;
const compiler_1 = require("../compiler");
const vm_1 = require("../vm");
const optimizer_1 = require("../optimizer");
const bench_runner_1 = require("./bench-runner");
// ─── AST 헬퍼 ────────────────────────────────────────────────────────────────
function lit(value) {
    if (typeof value === "number")
        return { kind: "literal", type: "number", value };
    if (typeof value === "boolean")
        return { kind: "literal", type: "boolean", value };
    if (value === null)
        return { kind: "literal", type: "null", value: null };
    return { kind: "literal", type: "string", value };
}
function sexpr(op, ...args) {
    return { kind: "sexpr", op, args };
}
// ─── VM 실행 헬퍼 ────────────────────────────────────────────────────────────
function runVM(node) {
    const compiler = new compiler_1.BytecodeCompiler();
    const vm = new vm_1.VM();
    const chunk = compiler.compile(node);
    return vm.run(chunk);
}
function runVMOptimized(node) {
    const compiler = new compiler_1.BytecodeCompiler();
    const vm = new vm_1.VM();
    const chunk = compiler.compile(node);
    const optimizer = (0, optimizer_1.createDefaultOptimizer)();
    const optimized = optimizer.optimize(chunk);
    return vm.run(optimized);
}
// ─── 벤치마크 ────────────────────────────────────────────────────────────────
function runVMBenchmarks() {
    const suite = new bench_runner_1.BenchmarkSuite();
    // 1. 산술 연산 (VM)
    const arithAST = sexpr("+", sexpr("*", lit(2), lit(3)), sexpr("-", lit(10), lit(4)));
    suite.add("VM: arithmetic (+ (* 2 3) (- 10 4))", () => runVM(arithAST), { iterations: 1000 });
    // 2. 산술 연산 (VM + 최적화)
    suite.add("VM+opt: arithmetic (+ (* 2 3) (- 10 4))", () => runVMOptimized(arithAST), { iterations: 1000 });
    // 3. 상수 표현식 (VM)
    const constAST = sexpr("+", lit(100), sexpr("*", lit(3), lit(7)));
    suite.add("VM: constant expr (+ 100 (* 3 7))", () => runVM(constAST), { iterations: 1000 });
    // 4. 상수 표현식 (VM + 상수 폴딩)
    suite.add("VM+const-fold: constant expr", () => runVMOptimized(constAST), { iterations: 1000 });
    // 5. 비교 연산 (VM)
    const compareAST = sexpr(">", sexpr("+", lit(5), lit(3)), sexpr("-", lit(10), lit(1)));
    suite.add("VM: comparison (> (+ 5 3) (- 10 1))", () => runVM(compareAST), { iterations: 1000 });
    return suite.run();
}
function compareInterpreterVsVM(interpreterResults, vmResults) {
    const pairs = [
        {
            interp: "arithmetic: (+ (* 2 3) (- 10 4))",
            vm: "VM: arithmetic (+ (* 2 3) (- 10 4))",
            label: "arithmetic",
        },
    ];
    return pairs.map(({ interp, vm, label }) => {
        const ir = interpreterResults.find((r) => r.name === interp);
        const vr = vmResults.find((r) => r.name === vm);
        const iOps = ir?.opsPerSec ?? 0;
        const vOps = vr?.opsPerSec ?? 0;
        return {
            operation: label,
            interpreterOpsPerSec: iOps,
            vmOpsPerSec: vOps,
            speedup: iOps === 0 ? 0 : vOps / iOps,
        };
    });
}
// 단독 실행 시
if (require.main === module) {
    console.log("=== FreeLang v9 VM 벤치마크 ===\n");
    const results = runVMBenchmarks();
    const suite = new bench_runner_1.BenchmarkSuite();
    console.log(suite.toMarkdown(results));
}
//# sourceMappingURL=bench-vm.js.map