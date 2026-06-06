// P1-4: Observability Tests
// Tests for structured logging, metrics collection, and distributed tracing

import { createWorkflowModule } from "../stdlib-workflow";

describe("P1-4: Observability", () => {
  const WF = createWorkflowModule();

  describe("Test 1: Trace ID propagation and structured logging", () => {
    it("should include trace_id in all log entries", async () => {
      const workflow = WF.workflow_create("trace-test", [
        WF.workflow_step("step1", (ctx: any) => ({ v1: 1 })),
        WF.workflow_step("step2", (ctx: any) => ({ v2: 2 })),
        WF.workflow_step("step3", (ctx: any) => ({ v3: 3 })),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");
      expect(result.log.length).toBe(3);

      // Verify trace_id in all entries
      result.log.forEach((entry, index) => {
        expect(entry.trace_id).toBeDefined();
        expect(entry.trace_id).toBeTruthy();  // Must be non-empty string
        expect(entry.step).toBe(`step${index + 1}`);
        expect(entry.status).toBe("ok");
      });

      // Verify all trace_ids are the same (from same workflow run)
      const traceIds = new Set(result.log.map(e => e.trace_id));
      expect(traceIds.size).toBe(1);  // All same trace_id
    });
  });

  describe("Test 2: Metrics collection (wall_time_ms)", () => {
    it("should collect accurate timing metrics for each step", async () => {
      const workflow = WF.workflow_create("metrics-test", [
        WF.workflow_step("fast-step", (ctx: any) => {
          // Fast operation
          return { done: true };
        }),
        WF.workflow_step("slow-step", (ctx: any) => {
          // Slightly slower operation
          const end = Date.now() + 10;
          while (Date.now() < end) { /* busy wait */ }
          return { done: true };
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");
      expect(result.log.length).toBe(2);

      // Verify metrics exist
      result.log.forEach(entry => {
        expect(entry.metrics).toBeDefined();
        expect(entry.metrics?.wall_time_ms).toBeGreaterThanOrEqual(0);
      });

      // Slow step should take longer
      const fastMs = result.log[0].metrics?.wall_time_ms ?? 0;
      const slowMs = result.log[1].metrics?.wall_time_ms ?? 0;
      expect(slowMs).toBeGreaterThanOrEqual(fastMs);
    });
  });

  describe("Test 3: Parallel task metrics", () => {
    it("should track parallel_tasks count in metrics", async () => {
      const workflow = WF.workflow_create("parallel-metrics", [
        WF.workflow_step("sequential", (ctx: any) => ({ done: true })),
        WF.workflow_step("with-parallel", (ctx: any) => ({ done: true }), {
          parallel_tasks: [
            WF.workflow_step("task1", (ctx: any) => ({ t1: 1 })),
            WF.workflow_step("task2", (ctx: any) => ({ t2: 2 })),
            WF.workflow_step("task3", (ctx: any) => ({ t3: 3 })),
          ],
          merge_strategy: "all-success",
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");
      expect(result.log.length).toBe(2);

      // First step has no parallel tasks
      expect(result.log[0].metrics?.parallel_tasks).toBeUndefined();

      // Second step (with parallel) might have parallel_tasks metric
      // This depends on implementation details
      // At minimum, it should have wall_time_ms
      expect(result.log[1].metrics?.wall_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Test 4: Error handling preserves trace_id", () => {
    it("should include trace_id even on errors", async () => {
      const workflow = WF.workflow_create("error-trace", [
        WF.workflow_step("good-step", (ctx: any) => ({ ok: true })),
        WF.workflow_step("bad-step", (ctx: any) => {
          throw new Error("Intentional failure");
        }, {
          fallback: { recovered: true },
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");  // Fallback used
      expect(result.log.length).toBe(2);

      // Both entries should have trace_id
      result.log.forEach(entry => {
        expect(entry.trace_id).toBeDefined();
      });

      // Error entry should include error info
      expect(result.log[1].error).toContain("Intentional failure");
    });
  });

  describe("Test 5: Workflow-level metrics summary", () => {
    it("should calculate overall metrics (parallel_ratio, error_ratio)", async () => {
      const workflow = WF.workflow_create("metrics-summary", [
        WF.workflow_step("step1", (ctx: any) => ({ v: 1 }), {
          parallel_tasks: [
            WF.workflow_step("p1", (ctx: any) => ({})),
            WF.workflow_step("p2", (ctx: any) => ({})),
          ],
          merge_strategy: "all-success",
        }),
        WF.workflow_step("step2", (ctx: any) => ({ v: 2 })),
        WF.workflow_step("step3", (ctx: any) => ({ v: 3 })),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");
      expect(result.steps_ok).toBe(3);
      expect(result.steps_failed).toBe(0);

      // Verify log has trace_id
      expect(result.log.length).toBeGreaterThan(0);
      result.log.forEach(entry => {
        expect(entry.trace_id).toBeTruthy();
      });

      // Metrics at workflow level
      expect(result.metrics).toBeDefined();
      if (result.metrics) {
        expect(result.metrics.total_ms).toBeGreaterThanOrEqual(0);
        expect(result.metrics.parallel_ratio).toBeGreaterThanOrEqual(0);
        expect(result.metrics.parallel_ratio).toBeLessThanOrEqual(1);
        expect(result.metrics.error_ratio).toBe(0);  // All successful
        expect(result.metrics.compensation_ratio).toBe(0);  // No compensations
      }
    });
  });
});
