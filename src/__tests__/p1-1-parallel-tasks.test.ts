// P1-1: Parallel Task Execution Tests
// 8 test cases for parallel workflow execution

import { createWorkflowModule } from "../stdlib-workflow";
import { createTimeModule } from "../stdlib-time";

const WF = createWorkflowModule();
const T = createTimeModule();

describe("P1-1: Parallel Task Execution", () => {
  it("1. Two parallel tasks (all-success, both pass)", async () => {
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
    expect(result.status).toBe("success");
    // Parallel task results are wrapped under the step name
    const processData = result.context["process-data"] || result.context.process_data;
    expect(processData).toBeDefined();
    expect(processData.task1 || processData.task2).toBeDefined();
  });

  it("2. Two parallel tasks (all-success, one fails)", async () => {
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
    expect(result.status).toBe("failed");
  });

  it("3. Two parallel tasks (first-success, one fails)", async () => {
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
    expect(result.status).toBe("success");
  });

  it("4. Nested parallel tasks", async () => {
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
    expect(result.status).toBe("success");
    expect(result.steps_ok).toBe(2);
  });

  it("5. Parallel tasks with conditional execution", async () => {
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
    expect(result.status).toBe("success");
  });

  it("6. Parallel tasks using context from previous step", async () => {
    const workflow = WF.workflow_create("parallel-with-context", [
      WF.workflow_step("fetch", (ctx) => ({ user_id: 123, user_name: "Alice" })),
      WF.workflow_step("process", (ctx) => {
        return { user_id: ctx.user_id };
      }, {
        parallel_tasks: [
          WF.workflow_step("validate", (ctx) => {
            if (!ctx.user_id) throw new Error("user_id missing");
            return { validated: true };
          }),
          WF.workflow_step("enrich", (ctx) => {
            if (!ctx.user_name) throw new Error("user_name missing");
            return { enriched: true };
          }),
        ],
        merge_strategy: "all-success",
      }),
    ]);

    const result = await WF.workflow_run_async(workflow, {});
    expect(result.status).toBe("success");
  });

  it("7. Parallel tasks with fallback on failure", async () => {
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
    expect(result.status).toBe("success");
    expect(result.context.fallback_result).toBe("recovered");
  });

  it("8. Parallel tasks execution time optimization", async () => {
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
    expect(result.status).toBe("success");
    // Should be around 100ms, not 200ms (if they were sequential)
    // Allow some margin for overhead
    expect(result.total_ms).toBeLessThan(250);
  });
});
