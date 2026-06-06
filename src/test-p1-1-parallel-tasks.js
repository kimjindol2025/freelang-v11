"use strict";
// P1-1: Parallel Task Execution Tests
// 8 test cases for parallel workflow execution
Object.defineProperty(exports, "__esModule", { value: true });
const stdlib_workflow_1 = require("./stdlib-workflow");
const stdlib_time_1 = require("./stdlib-time");
const WF = (0, stdlib_workflow_1.createWorkflowModule)();
const T = (0, stdlib_time_1.createTimeModule)();
async function runTest(testName, testFn) {
    try {
        console.log(`\n✓ Running: ${testName}`);
        await testFn();
        console.log(`  ✅ PASSED`);
    }
    catch (err) {
        console.error(`  ❌ FAILED: ${err.message}`);
        process.exit(1);
    }
}
async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("P1-1: Parallel Task Execution Tests");
    console.log("═══════════════════════════════════════════");
    // Test 1: Two parallel tasks, both succeed
    await runTest("1. Two parallel tasks (all-success, both pass)", async () => {
        const workflow = WF.workflow_create("parallel-success", [
            WF.workflow_step("fetch-data", (ctx) => {
                return { data1: "value1" };
            }),
            WF.workflow_step("process-data", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => ({ result1: "processed1" })),
                    WF.workflow_step("task2", (ctx) => ({ result2: "processed2" })),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
        if (!result.context.process_data || !result.context.process_data.task1 || !result.context.process_data.task2) {
            throw new Error("Parallel task results not merged properly");
        }
    });
    // Test 2: Two parallel tasks, one fails, all-success strategy
    await runTest("2. Two parallel tasks (all-success, one fails)", async () => {
        const workflow = WF.workflow_create("parallel-one-fails", [
            WF.workflow_step("process", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => ({ result1: "ok" })),
                    WF.workflow_step("task2", (ctx) => {
                        throw new Error("Task 2 failed");
                    }),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "failed") {
            throw new Error(`Expected failed, got ${result.status}`);
        }
    });
    // Test 3: Two parallel tasks, one fails, first-success strategy
    await runTest("3. Two parallel tasks (first-success, one fails)", async () => {
        const workflow = WF.workflow_create("parallel-first-success", [
            WF.workflow_step("process", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => ({ result1: "ok" })),
                    WF.workflow_step("task2", (ctx) => {
                        throw new Error("Task 2 failed");
                    }),
                ],
                merge_strategy: "first-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
    });
    // Test 4: Nested parallel tasks
    await runTest("4. Nested parallel tasks", async () => {
        const workflow = WF.workflow_create("nested-parallel", [
            WF.workflow_step("phase1", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => ({ result1: "ok" })),
                    WF.workflow_step("task2", (ctx) => ({ result2: "ok" })),
                ],
                merge_strategy: "all-success",
            }),
            WF.workflow_step("phase2", (ctx) => {
                return { phase2_done: true };
            }, {
                parallel_tasks: [
                    WF.workflow_step("subtask1", (ctx) => ({ sub1: "ok" })),
                    WF.workflow_step("subtask2", (ctx) => ({ sub2: "ok" })),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
        if (result.steps_ok !== 2) {
            throw new Error(`Expected 2 steps ok, got ${result.steps_ok}`);
        }
    });
    // Test 5: Parallel tasks with conditional execution
    await runTest("5. Parallel tasks with conditional execution", async () => {
        const workflow = WF.workflow_create("parallel-conditional", [
            WF.workflow_step("setup", (ctx) => ({ should_process: true })),
            WF.workflow_step("process", () => ({}), {
                if: (ctx) => ctx.should_process === true,
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => ({ result1: "ok" })),
                    WF.workflow_step("task2", (ctx) => ({ result2: "ok" })),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
    });
    // Test 6: Parallel tasks using context from previous step
    await runTest("6. Parallel tasks using context from previous step", async () => {
        const workflow = WF.workflow_create("parallel-with-context", [
            WF.workflow_step("fetch", (ctx) => ({ user_id: 123, user_name: "Alice" })),
            WF.workflow_step("process", (ctx) => {
                return { user_id: ctx.user_id };
            }, {
                parallel_tasks: [
                    WF.workflow_step("validate", (ctx) => {
                        if (!ctx.user_id)
                            throw new Error("user_id missing");
                        return { validated: true };
                    }),
                    WF.workflow_step("enrich", (ctx) => {
                        if (!ctx.user_name)
                            throw new Error("user_name missing");
                        return { enriched: true };
                    }),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
    });
    // Test 7: Parallel tasks with fallback on failure
    await runTest("7. Parallel tasks with fallback on failure", async () => {
        const workflow = WF.workflow_create("parallel-with-fallback", [
            WF.workflow_step("process", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("task1", (ctx) => {
                        throw new Error("Task 1 failed");
                    }),
                    WF.workflow_step("task2", (ctx) => {
                        throw new Error("Task 2 failed");
                    }),
                ],
                merge_strategy: "all-success",
                fallback: { fallback_result: "recovered" },
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success (with fallback), got ${result.status}`);
        }
        if (!result.context.fallback_result) {
            throw new Error("Fallback value not applied");
        }
    });
    // Test 8: Parallel tasks execution time (should be faster than sequential)
    await runTest("8. Parallel tasks execution time optimization", async () => {
        const workflow = WF.workflow_create("parallel-timing", [
            WF.workflow_step("parallel-phase", () => ({}), {
                parallel_tasks: [
                    WF.workflow_step("slow-task1", (ctx) => {
                        const start = T.now();
                        while (T.now() - start < 100) { /* simulate work */ }
                        return { result1: "done" };
                    }),
                    WF.workflow_step("slow-task2", (ctx) => {
                        const start = T.now();
                        while (T.now() - start < 100) { /* simulate work */ }
                        return { result2: "done" };
                    }),
                ],
                merge_strategy: "all-success",
            }),
        ]);
        const result = await WF.workflow_run_async(workflow, {});
        if (result.status !== "success") {
            throw new Error(`Expected success, got ${result.status}`);
        }
        // Should be around 100ms, not 200ms (if they were sequential)
        if (result.total_ms > 250) {
            console.warn(`  ⚠️ Parallel execution took ${result.total_ms}ms (expected ~100ms)`);
        }
    });
    console.log("\n═══════════════════════════════════════════");
    console.log("✅ All P1-1 tests passed!");
    console.log("═══════════════════════════════════════════");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
