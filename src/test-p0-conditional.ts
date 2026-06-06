// Test suite for P0-2: Conditional Task execution
// Tests: :if condition, skip logic, dependency propagation

import { createWorkflowModule } from "./stdlib-workflow";
import { createTimeModule } from "./stdlib-time";

const WF = createWorkflowModule();
const T = createTimeModule();

interface TestResult {
  passed: number;
  failed: number;
  tests: Array<{ name: string; ok: boolean; reason?: string }>;
}

const results: TestResult = { passed: 0, failed: 0, tests: [] };

function test(name: string, fn: () => boolean) {
  try {
    const ok = fn();
    if (ok) {
      results.passed++;
      results.tests.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } else {
      results.failed++;
      results.tests.push({ name, ok: false, reason: "assertion failed" });
      console.log(`✗ ${name} — assertion failed`);
    }
  } catch (err: any) {
    results.failed++;
    results.tests.push({ name, ok: false, reason: err.message });
    console.log(`✗ ${name} — ${err.message}`);
  }
}

// ── Test 1: Conditional true runs step
test("P0-2-01: :if true executes step", () => {
  let executed = false;

  const step = WF["workflow_step"]("test", (ctx) => {
    executed = true;
    return { result: "ok" };
  }, {
    if: (ctx) => true,
  });

  const workflow = WF["workflow_create"]("cond-test", [step]);
  WF["workflow_run"](workflow, {});

  return executed === true;
});

// ── Test 2: Conditional false skips step
test("P0-2-02: :if false skips step", () => {
  let executed = false;

  const step = WF["workflow_step"]("test", (ctx) => {
    executed = true;
    return { result: "ok" };
  }, {
    if: (ctx) => false,
  });

  const workflow = WF["workflow_create"]("cond-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  // Step should be skipped, not executed
  return executed === false && result.status === "success";
});

// ── Test 3: Condition based on context value
test("P0-2-03: condition evaluates context", () => {
  let step2Executed = false;

  const steps = [
    WF["workflow_step"]("fetch", (ctx) => {
      return { items: [1, 2, 3] };
    }),
    WF["workflow_step"]("process", (ctx) => {
      step2Executed = true;
      return { processed: true };
    }, {
      if: (ctx) => ctx.items && ctx.items.length > 0,
    }),
  ];

  const workflow = WF["workflow_create"]("cond-context-test", steps);
  const result = WF["workflow_run"](workflow, {});

  return step2Executed === true && result.context.processed === true;
});

// ── Test 4: Skipped step doesn't appear in context
test("P0-2-04: skipped step doesn't modify context", () => {
  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      return { value: 1 };
    }),
    WF["workflow_step"]("step2", (ctx) => {
      return { step2_value: 999 };
    }, {
      if: (ctx) => false,  // Will be skipped
    }),
    WF["workflow_step"]("step3", (ctx) => {
      return { value: ctx.value + 10 };
    }),
  ];

  const workflow = WF["workflow_create"]("skip-test", steps);
  const result = WF["workflow_run"](workflow, {});

  // step2 was skipped, so its side effects didn't happen
  // step3 should still access step1's value
  return result.context.value === 11 &&
    result.context.step2_value === undefined;
});

// ── Test 5: Condition can check previous step results
test("P0-2-05: condition checks previous step status", () => {
  let processExecuted = false;

  const steps = [
    WF["workflow_step"]("validate", (ctx) => {
      return { is_valid: true };
    }),
    WF["workflow_step"]("process", (ctx) => {
      processExecuted = true;
      return { processed: true };
    }, {
      if: (ctx) => ctx.is_valid === true,
    }),
  ];

  const workflow = WF["workflow_create"]("cond-valid-test", steps);
  WF["workflow_run"](workflow, {});

  return processExecuted === true;
});

// ── Test 6: Multiple conditional steps
test("P0-2-06: multiple conditional steps", () => {
  const steps = [
    WF["workflow_step"]("init", (ctx) => {
      return { count: 5 };
    }),
    WF["workflow_step"]("step_a", (ctx) => {
      return { executed_a: true };
    }, {
      if: (ctx) => ctx.count > 3,
    }),
    WF["workflow_step"]("step_b", (ctx) => {
      return { executed_b: true };
    }, {
      if: (ctx) => ctx.count < 10,
    }),
    WF["workflow_step"]("step_c", (ctx) => {
      return { executed_c: true };
    }, {
      if: (ctx) => ctx.count > 100,  // Won't run
    }),
  ];

  const workflow = WF["workflow_create"]("multi-cond-test", steps);
  const result = WF["workflow_run"](workflow, {});

  return result.context.executed_a === true &&
    result.context.executed_b === true &&
    result.context.executed_c === undefined;
});

// ── Test 7: Condition failure aborts (if required)
test("P0-2-07: condition exception aborts workflow", () => {
  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      return { ok: true };
    }),
    WF["workflow_step"]("step2", (ctx) => {
      return { ok: true };
    }, {
      if: (ctx) => {
        throw new Error("Condition check failed");
      },
    }),
    WF["workflow_step"]("step3", (ctx) => {
      return { ok: true };
    }),
  ];

  const workflow = WF["workflow_create"]("cond-error-test", steps);
  const result = WF["workflow_run"](workflow, {});

  // Workflow should fail at step2 condition check
  return result.status === "failed";
});

// ── Test 8: Optional step with condition
test("P0-2-08: optional step with condition failure", () => {
  let step3Executed = false;

  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      return { value: 1 };
    }),
    WF["workflow_step"]("step2", (ctx) => {
      return { ok: true };
    }, {
      required: false,
      if: (ctx) => {
        throw new Error("Condition failed");
      },
    }),
    WF["workflow_step"]("step3", (ctx) => {
      step3Executed = true;
      return { ok: true };
    }),
  ];

  const workflow = WF["workflow_create"]("optional-cond-test", steps);
  const result = WF["workflow_run"](workflow, {});

  // Step2 condition fails but it's optional, so step3 still runs
  return result.status === "success" && step3Executed === true;
});

// ── Test 9: Helper function step-when
test("P0-2-09: step-when helper adds condition", () => {
  let executed = false;

  const step = WF["workflow_step"]("test", (ctx) => {
    executed = true;
    return { ok: true };
  });

  const enhanced = WF["step-when"](step, (ctx) => true);

  const workflow = WF["workflow_create"]("when-helper-test", [enhanced]);
  WF["workflow_run"](workflow, {});

  return executed === true;
});

// ── Test 10: Condition with complex logic
test("P0-2-10: complex condition logic", () => {
  let processExecuted = false;

  const steps = [
    WF["workflow_step"]("fetch", (ctx) => {
      return { users: ["alice", "bob"], premium: false };
    }),
    WF["workflow_step"]("process", (ctx) => {
      processExecuted = true;
      return { result: "processed" };
    }, {
      if: (ctx) => {
        const hasUsers = ctx.users && ctx.users.length > 0;
        const isPremium = ctx.premium === true;
        return hasUsers && isPremium;
      },
    }),
  ];

  const workflow = WF["workflow_create"]("complex-cond-test", steps);
  const result = WF["workflow_run"](workflow, {});

  // Condition is false (hasUsers=true but isPremium=false)
  return processExecuted === false && result.status === "success";
});

// ── Print summary
console.log("\n" + "=".repeat(50));
console.log(`Test Results: ${results.passed} passed, ${results.failed} failed`);
console.log("=".repeat(50) + "\n");

if (results.failed > 0) {
  console.log("Failed tests:");
  results.tests
    .filter(t => !t.ok)
    .forEach(t => console.log(`  - ${t.name}: ${t.reason}`));
  process.exit(1);
} else {
  console.log("✓ All tests passed!");
  process.exit(0);
}
