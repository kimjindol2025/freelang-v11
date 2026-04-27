// Test suite for P0-1: Task error handling
// Tests: on_error, fallback, combined error handling

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

// ── Test 1: on_error handler
test("P0-1-01: on_error handler catches error", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Step failed!");
  }, {
    on_error: (err) => ({ error_caught: err.error }),
  });

  const workflow = WF["workflow_create"]("error-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  // Step should succeed due to on_error handling
  return result.status === "success" && result.context.error_caught === "Step failed!";
});

// ── Test 2: fallback used
test("P0-1-02: fallback value replaces failed step", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Network error");
  }, {
    fallback: { data: [], status: "cached" },
  });

  const workflow = WF["workflow_create"]("fallback-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  return result.status === "success" &&
    result.context.data !== undefined &&
    result.context.status === "cached";
});

// ── Test 3: on_error takes precedence over fallback
test("P0-1-03: on_error handler runs before fallback", () => {
  let handlerCalled = false;

  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Failed");
  }, {
    on_error: (err) => {
      handlerCalled = true;
      return { handled: true };
    },
    fallback: { fallback: true },
  });

  const workflow = WF["workflow_create"]("precedence-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  // on_error handler should have run (handled=true, not fallback=true)
  return result.context.handled === true && result.context.fallback === undefined;
});

// ── Test 4: fallback with function
test("P0-1-04: fallback function is called", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Error");
  }, {
    fallback: () => ({ computed: 42 }),
  });

  const workflow = WF["workflow_create"]("fallback-fn-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  return result.context.computed === 42;
});

// ── Test 5: required=false still applies with error handling
test("P0-1-05: optional step with fallback continues workflow", () => {
  let step2Executed = false;

  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      throw new Error("Step 1 failed");
    }, {
      required: false,
      fallback: { step1_result: "fallback" },
    }),
    WF["workflow_step"]("step2", (ctx) => {
      step2Executed = true;
      return { step2_result: "ok" };
    }),
  ];

  const workflow = WF["workflow_create"]("optional-test", steps);
  const result = WF["workflow_run"](workflow, {});

  return result.status === "success" &&
    step2Executed &&
    result.context.step1_result === "fallback" &&
    result.context.step2_result === "ok";
});

// ── Test 6: error handler that also throws
test("P0-1-06: error handler throwing falls back to fallback", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Primary error");
  }, {
    on_error: (err) => {
      throw new Error("Handler also failed");
    },
    fallback: { error: "all_failed" },
  });

  const workflow = WF["workflow_create"]("handler-error-test", [step]);
  const result = WF["workflow_run"](workflow, {});

  return result.status === "success" && result.context.error === "all_failed";
});

// ── Test 7: error handler receives error details
test("P0-1-07: on_error receives error object with metadata", () => {
  let receivedErr: any = null;

  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Test error message");
  }, {
    on_error: (err) => {
      receivedErr = err;
      return { ok: true };
    },
  });

  const workflow = WF["workflow_create"]("error-details-test", [step]);
  WF["workflow_run"](workflow, {});

  return receivedErr !== null &&
    receivedErr.error === "Test error message" &&
    receivedErr.step_name === "test";
});

// ── Test 8: workflow continues after successful error recovery
test("P0-1-08: workflow context updated with error handler result", () => {
  const steps = [
    WF["workflow_step"]("fetch", (ctx) => {
      throw new Error("API timeout");
    }, {
      on_error: (err) => ({ cached_users: ["user1", "user2"] }),
    }),
    WF["workflow_step"]("process", (ctx) => {
      // Should be able to access cached_users from previous step
      return { processed_count: ctx.cached_users.length };
    }),
  ];

  const workflow = WF["workflow_create"]("context-test", steps);
  const result = WF["workflow_run"](workflow, {});

  return result.status === "success" &&
    result.context.cached_users.length === 2 &&
    result.context.processed_count === 2;
});

// ── Test 9: helper function step-with-error
test("P0-1-09: step-with-error helper adds error handler", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Error");
  });

  const enhanced = WF["step-with-error"](step, (err) => ({ recovered: true }));

  const workflow = WF["workflow_create"]("helper-test", [enhanced]);
  const result = WF["workflow_run"](workflow, {});

  return result.context.recovered === true;
});

// ── Test 10: helper function step-with-fallback
test("P0-1-10: step-with-fallback helper adds fallback", () => {
  const step = WF["workflow_step"]("test", (ctx) => {
    throw new Error("Error");
  });

  const enhanced = WF["step-with-fallback"](step, { default: "value" });

  const workflow = WF["workflow_create"]("fallback-helper-test", [enhanced]);
  const result = WF["workflow_run"](workflow, {});

  return result.context.default === "value";
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
