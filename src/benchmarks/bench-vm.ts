// FreeLang v9 Phase 89: 바이트코드 VM 성능 측정

import { BytecodeCompiler } from "../compiler";
import { VM } from "../vm";
import { Optimizer, constantFoldingPass, createDefaultOptimizer } from "../optimizer";
import { ASTNode, Literal, SExpr } from "../ast";
import { BenchmarkSuite, BenchmarkResult } from "./bench-runner";

// ─── AST 헬퍼 ────────────────────────────────────────────────────────────────

function lit(value: number | boolean | string | null): Literal {
  if (typeof value === "number") return { kind: "literal", type: "number", value };
  if (typeof value === "boolean") return { kind: "literal", type: "boolean", value };
  if (value === null) return { kind: "literal", type: "null", value: null };
  return { kind: "literal", type: "string", value };
}

function sexpr(op: string, ...args: ASTNode[]): SExpr {
  return { kind: "sexpr", op, args };
}

// ─── VM 실행 헬퍼 ────────────────────────────────────────────────────────────

function runVM(node: ASTNode): any {
  const compiler = new BytecodeCompiler();
  const vm = new VM();
  const chunk = compiler.compile(node);
  return vm.run(chunk);
}

function runVMOptimized(node: ASTNode): any {
  const compiler = new BytecodeCompiler();
  const vm = new VM();
  const chunk = compiler.compile(node);
  const optimizer = createDefaultOptimizer();
  const optimized = optimizer.optimize(chunk);
  return vm.run(optimized);
}

// ─── 벤치마크 ────────────────────────────────────────────────────────────────

export function runVMBenchmarks(): BenchmarkResult[] {
  const suite = new BenchmarkSuite();

  // 1. 산술 연산 (VM)
  const arithAST = sexpr("+", sexpr("*", lit(2), lit(3)), sexpr("-", lit(10), lit(4)));

  suite.add(
    "VM: arithmetic (+ (* 2 3) (- 10 4))",
    () => runVM(arithAST),
    { iterations: 1000 }
  );

  // 2. 산술 연산 (VM + 최적화)
  suite.add(
    "VM+opt: arithmetic (+ (* 2 3) (- 10 4))",
    () => runVMOptimized(arithAST),
    { iterations: 1000 }
  );

  // 3. 상수 표현식 (VM)
  const constAST = sexpr("+", lit(100), sexpr("*", lit(3), lit(7)));
  suite.add(
    "VM: constant expr (+ 100 (* 3 7))",
    () => runVM(constAST),
    { iterations: 1000 }
  );

  // 4. 상수 표현식 (VM + 상수 폴딩)
  suite.add(
    "VM+const-fold: constant expr",
    () => runVMOptimized(constAST),
    { iterations: 1000 }
  );

  // 5. 비교 연산 (VM)
  const compareAST = sexpr(">", sexpr("+", lit(5), lit(3)), sexpr("-", lit(10), lit(1)));
  suite.add(
    "VM: comparison (> (+ 5 3) (- 10 1))",
    () => runVM(compareAST),
    { iterations: 1000 }
  );

  return suite.run();
}

// ─── 인터프리터 vs VM 비교 ───────────────────────────────────────────────────

export interface ComparisonResult {
  operation: string;
  interpreterOpsPerSec: number;
  vmOpsPerSec: number;
  speedup: number;
}

export function compareInterpreterVsVM(
  interpreterResults: BenchmarkResult[],
  vmResults: BenchmarkResult[]
): ComparisonResult[] {
  const pairs: Array<{ interp: string; vm: string; label: string }> = [
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
  const suite = new BenchmarkSuite();
  console.log(suite.toMarkdown(results));
}
