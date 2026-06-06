// FreeLang v9 Phase 89: 인터프리터 성능 측정

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";
import { BenchmarkSuite, BenchmarkResult } from "./bench-runner";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

export function runInterpreterBenchmarks(): BenchmarkResult[] {
  const suite = new BenchmarkSuite();

  // 1. 산술 연산
  suite.add(
    "arithmetic: (+ (* 2 3) (- 10 4))",
    () => run("(+ (* 2 3) (- 10 4))"),
    { iterations: 1000 }
  );

  // 2. 팩토리얼(10) — FUNC 구문
  const factSrc = "[FUNC fact :params [$n]\n  :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]\n(fact 10)";
  suite.add(
    "factorial(10)",
    () => run(factSrc),
    { iterations: 1000 }
  );

  // 3. 피보나치(15) — FUNC 구문
  const fibSrc = "[FUNC fib :params [$n]\n  :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]\n(fib 15)";
  suite.add(
    "fibonacci(15)",
    () => run(fibSrc),
    { iterations: 100 }
  );

  // 4. 리스트 length (100개 원소)
  suite.add(
    "list length (100 elements)",
    () => {
      const nums = Array.from({ length: 100 }, (_, i) => i + 1).join(" ");
      run(`(length (list ${nums}))`);
    },
    { iterations: 100 }
  );

  // 5. 문자열 연산 (concat)
  suite.add(
    "string: concat",
    () => run(`(concat "hello" " world")`),
    { iterations: 1000 }
  );

  return suite.run();
}

// 단독 실행 시
if (require.main === module) {
  console.log("=== FreeLang v9 인터프리터 벤치마크 ===\n");
  const results = runInterpreterBenchmarks();
  const suite = new BenchmarkSuite();
  const md = suite.toMarkdown(results);
  console.log(md);
  console.log("\n상세 결과:");
  for (const r of results) {
    console.log(
      `  ${r.name}: ${r.opsPerSec.toFixed(0)} ops/sec (avg ${r.avgMs.toFixed(4)}ms)`
    );
  }
}
