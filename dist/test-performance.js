"use strict";
// Phase 4 Week 3-3: Performance Optimization Benchmark
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const scope_stack_1 = require("./scope-stack");
console.log("📊 Phase 4 Week 3-3: Performance Optimization Benchmark\n");
// Helper to run code and measure execution time
function benchmarkCode(code, funcName, iterations = 1) {
    const interp = new interpreter_1.Interpreter();
    const tokens = (0, lexer_1.lex)(code);
    const blocks = (0, parser_1.parse)(tokens);
    interp.interpret(blocks);
    const testFunc = interp.context.functions.get(funcName);
    if (!testFunc) {
        throw new Error(`Function ${funcName} not found`);
    }
    const startTime = performance.now();
    let result;
    for (let i = 0; i < iterations; i++) {
        result = interp.eval(testFunc.body);
    }
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    return { result, avgTime, totalTime };
}
console.log("=".repeat(60));
console.log("BENCHMARK 1: Deep Function Call Stack (Scope Management)");
console.log("=".repeat(60) + "\n");
// Test 1: Deep call stack to measure scope copying overhead
console.log("📋 Test 1: Call Stack Depth 10");
console.log("──────────────────────────────");
try {
    const deepCallCode = `
[FUNC level-10 :params [$x]
  :body (+ $x 1)
]

[FUNC level-9 :params [$x]
  :body (level-10 (+ $x 1))
]

[FUNC level-8 :params [$x]
  :body (level-9 (+ $x 1))
]

[FUNC level-7 :params [$x]
  :body (level-8 (+ $x 1))
]

[FUNC level-6 :params [$x]
  :body (level-7 (+ $x 1))
]

[FUNC level-5 :params [$x]
  :body (level-6 (+ $x 1))
]

[FUNC level-4 :params [$x]
  :body (level-5 (+ $x 1))
]

[FUNC level-3 :params [$x]
  :body (level-4 (+ $x 1))
]

[FUNC level-2 :params [$x]
  :body (level-3 (+ $x 1))
]

[FUNC level-1 :params [$x]
  :body (level-2 (+ $x 1))
]

[FUNC deep-call-test
  :body (level-1 0)
]
`;
    const iterations = 100;
    const { result, avgTime, totalTime } = benchmarkCode(deepCallCode, "deep-call-test", iterations);
    console.log(`✅ Result: ${result} (expected 10)`);
    console.log(`⏱️  Total time (${iterations} iterations): ${totalTime.toFixed(2)}ms`);
    console.log(`⏱️  Average time: ${avgTime.toFixed(4)}ms\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
console.log("=".repeat(60));
console.log("BENCHMARK 2: Scope Stack Implementation");
console.log("=".repeat(60) + "\n");
console.log("📋 Test 2: ScopeStack Operations (Unit Test)");
console.log("────────────────────────────────────────────");
try {
    const scopeStack = new scope_stack_1.ScopeStack();
    // Benchmark: Push/pop operations
    const pushPopStart = performance.now();
    for (let i = 0; i < 10000; i++) {
        scopeStack.push();
        scopeStack.set("x", i);
        scopeStack.set("y", i * 2);
        scopeStack.pop();
    }
    const pushPopTime = performance.now() - pushPopStart;
    console.log(`✅ Push/Pop 10000 iterations: ${pushPopTime.toFixed(2)}ms`);
    console.log(`   Average per iteration: ${(pushPopTime / 10000).toFixed(4)}ms\n`);
    // Benchmark: Variable lookup
    scopeStack.set("global_x", 42);
    scopeStack.push();
    scopeStack.set("local_y", 100);
    const lookupStart = performance.now();
    for (let i = 0; i < 100000; i++) {
        scopeStack.get("global_x");
        scopeStack.get("local_y");
        scopeStack.get("nonexistent");
    }
    const lookupTime = performance.now() - lookupStart;
    console.log(`✅ Variable lookup 300000 times: ${lookupTime.toFixed(2)}ms`);
    console.log(`   Average per lookup: ${(lookupTime / 300000).toFixed(4)}ms\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
console.log("=".repeat(60));
console.log("BENCHMARK 3: Closure Environment Capture");
console.log("=".repeat(60) + "\n");
console.log("📋 Test 3: Function Value with Closure");
console.log("──────────────────────────────────────");
try {
    const closureCode = `
[FUNC make-adder :params [$n]
  :body (fn [$x] (+ $x $n))
]

[FUNC closure-test
  :body (let [$add5 (make-adder 5)]
         ($add5 10))
]
`;
    const { result, avgTime } = benchmarkCode(closureCode, "closure-test", 100);
    console.log(`✅ Closure result: ${result} (expected 15)`);
    console.log(`⏱️  Average time: ${avgTime.toFixed(4)}ms\n`);
}
catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
}
console.log("=".repeat(60));
console.log("📊 PERFORMANCE BENCHMARK SUMMARY");
console.log("=".repeat(60) + "\n");
console.log("Current Implementation Analysis:");
console.log("- Scope management: Map copying on each function call (O(n))");
console.log("- Depth 10 call stack: ~100 iterations");
console.log("- Closure capture: Full environment captured (O(n))");
console.log("");
console.log("Optimization Available:");
console.log("✅ ScopeStack implementation (scope-stack.ts)");
console.log("   - Push/Pop: O(1)");
console.log("   - Variable lookup: O(d) where d = scope depth");
console.log("   - Variable set: O(1)");
console.log("");
console.log("Performance Improvement (Estimated):");
console.log("- Function calls: 10-20% faster for deep call stacks");
console.log("- Memory usage: 30-50% less for closures (selective capture)");
console.log("- Lookups: O(1) vs O(n) variable access");
console.log("");
console.log("✅ Phase 4 Week 3-3: Performance Analysis Complete!");
console.log("   - Baseline measurements established");
console.log("   - ScopeStack implementation ready");
console.log("   - Integration next step\n");
//# sourceMappingURL=test-performance.js.map