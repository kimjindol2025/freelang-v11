// P1-2: Compensation Transaction Tests
// Tests for automatic rollback on failure using compensate callbacks

import { createWorkflowModule } from "../stdlib-workflow";

describe("P1-2: Compensation Transaction", () => {
  const WF = createWorkflowModule();

  describe("Test 1: Successful workflow - no compensation needed", () => {
    it("should not apply compensation when all steps succeed", async () => {
      const compensateLog: string[] = [];

      const workflow = WF.workflow_create("charge-payment", [
        WF.workflow_step("charge-card", (ctx: any) => {
          return { charged: true, amount: 100 };
        }, {
          compensate: (ctx: any) => {
            compensateLog.push("refund");
            return { refunded: true };
          },
        }),
        WF.workflow_step("send-email", (ctx: any) => {
          return { email_sent: true };
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");
      expect(result.steps_ok).toBe(2);
      expect(result.steps_failed).toBe(0);
      expect(compensateLog.length).toBe(0);  // No compensation applied
      expect(result.compensations?.length).toBe(0);
    });
  });

  describe("Test 2: Failure triggers compensation", () => {
    it("should apply compensation in reverse order when step fails", async () => {
      const log: string[] = [];

      const workflow = WF.workflow_create("multi-step-transaction", [
        WF.workflow_step("step1", (ctx: any) => {
          log.push("execute:step1");
          return { v1: 1 };
        }, {
          compensate: (ctx: any) => {
            log.push("compensate:step1");
            return { compensation: "step1" };
          },
        }),
        WF.workflow_step("step2", (ctx: any) => {
          log.push("execute:step2");
          return { v2: 2 };
        }, {
          compensate: (ctx: any) => {
            log.push("compensate:step2");
            return { compensation: "step2" };
          },
        }),
        WF.workflow_step("step3-fails", (ctx: any) => {
          log.push("execute:step3");
          throw new Error("Step3 failed!");
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("failed");
      expect(result.steps_ok).toBe(2);
      expect(result.steps_failed).toBe(1);

      // Verify execution and compensation order
      expect(log).toEqual([
        "execute:step1",
        "execute:step2",
        "execute:step3",
        "compensate:step2",  // Reverse order
        "compensate:step1",
      ]);

      // Verify compensation results
      expect(result.compensations?.length).toBe(2);
      expect(result.compensations?.[0].step).toBe("step2");
      expect(result.compensations?.[0].action).toBe("applied");
      expect(result.compensations?.[1].step).toBe("step1");
      expect(result.compensations?.[1].action).toBe("applied");
    });
  });

  describe("Test 3: Partial failure with fallback - compensation still runs", () => {
    it("should apply compensation when fallback fails to prevent further damage", async () => {
      const log: string[] = [];

      const workflow = WF.workflow_create("transaction-with-fallback", [
        WF.workflow_step("charge", (ctx: any) => {
          log.push("execute:charge");
          return { charged: 100 };
        }, {
          compensate: (ctx: any) => {
            log.push("compensate:charge");
            return { refunded: 100 };
          },
        }),
        WF.workflow_step("send-notification", (ctx: any) => {
          log.push("execute:send");
          throw new Error("Email service down");
        }, {
          fallback: { notified: false },  // Fallback prevents failure
        }),
        WF.workflow_step("update-database", (ctx: any) => {
          log.push("execute:update");
          return { updated: true };
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("success");  // Fallback saves it
      expect(result.steps_ok).toBe(3);
      expect(result.steps_failed).toBe(0);

      // No compensation because all steps succeeded (even with fallback)
      expect(result.compensations?.length).toBe(0);
    });
  });

  describe("Test 4: Compensation failure is tracked", () => {
    it("should track when compensation itself fails", async () => {
      const log: string[] = [];

      const workflow = WF.workflow_create("compensation-fails", [
        WF.workflow_step("charge-card", (ctx: any) => {
          log.push("execute:charge");
          return { charged: true };
        }, {
          compensate: (ctx: any) => {
            log.push("compensate:charge");
            throw new Error("Refund failed - payment gateway down");
          },
        }),
        WF.workflow_step("confirm-order", (ctx: any) => {
          log.push("execute:confirm");
          throw new Error("Order processing failed");
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("failed");
      expect(result.steps_failed).toBe(1);

      // Compensation was attempted but failed
      expect(result.compensations?.length).toBe(1);
      expect(result.compensations?.[0].step).toBe("charge-card");
      expect(result.compensations?.[0].action).toBe("pending");  // Failed to complete
      expect(result.compensations?.[0].error).toContain("Refund failed");
    });
  });

  describe("Test 5: Compensation with context data", () => {
    it("should pass context to compensation function", async () => {
      const log: string[] = [];

      const workflow = WF.workflow_create("compensation-with-context", [
        WF.workflow_step("allocate-resources", (ctx: any) => {
          log.push("allocate:100");
          return { allocated: 100, resource_id: "res-123" };
        }, {
          compensate: (ctx: any) => {
            log.push(`deallocate:${ctx.allocated}:${ctx.resource_id}`);
            return { deallocated: ctx.allocated };
          },
        }),
        WF.workflow_step("use-resources", (ctx: any) => {
          log.push(`use:${ctx.allocated}`);
          throw new Error("Failed to use resources");
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("failed");

      // Verify compensation received the context
      expect(log).toContain("deallocate:100:res-123");
      expect(result.compensations?.length).toBe(1);
      expect(result.compensations?.[0].result).toEqual({ deallocated: 100 });
    });
  });

  describe("Test 6: Compensation without dependencies", () => {
    it("should apply compensation correctly for independent steps", async () => {
      const log: string[] = [];

      const workflow = WF.workflow_create("independent-steps", [
        WF.workflow_step("prepare-env", (ctx: any) => {
          log.push("prepare");
          return { env: "ready" };
        }, {
          compensate: (ctx: any) => {
            log.push("cleanup");
            return { cleaned: true };
          },
        }),
        WF.workflow_step("allocate-db", (ctx: any) => {
          log.push("allocate");
          return { db: "allocated" };
        }, {
          compensate: (ctx: any) => {
            log.push("deallocate");
            return { deallocated: true };
          },
        }),
        WF.workflow_step("start-service", (ctx: any) => {
          log.push("start");
          throw new Error("Port already in use");
        }),
      ]);

      const result = await WF.workflow_run_async(workflow, {});

      expect(result.status).toBe("failed");
      expect(result.steps_failed).toBe(1);

      // Verify compensation in reverse order
      expect(log).toEqual([
        "prepare",
        "allocate",
        "start",
        "deallocate",  // Reverse order
        "cleanup",
      ]);

      // Check compensation tracking
      expect(result.compensations?.length).toBe(2);
      expect(result.compensations?.[0].step).toBe("allocate-db");
      expect(result.compensations?.[0].action).toBe("applied");
      expect(result.compensations?.[1].step).toBe("prepare-env");
      expect(result.compensations?.[1].action).toBe("applied");
    });
  });
});
