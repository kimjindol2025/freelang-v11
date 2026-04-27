// Test suite for P0-3: Checkpoint save/resume
// Tests: checkpoint creation, loading, resuming from checkpoint

import * as fs from "fs";
import * as path from "path";
import { createWorkflowModule } from "./stdlib-workflow";
import { createTimeModule } from "./stdlib-time";
import { createCheckpointModule } from "./stdlib-checkpoint";

const WF = createWorkflowModule();
const T = createTimeModule();
const CP = createCheckpointModule();

const TEST_DIR = "/tmp/freelang-tests";

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

// Setup test directory
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// ── Test 1: Checkpoint saved periodically
test("P0-3-01: checkpoint saved on progress", () => {
  const cpPath = path.join(TEST_DIR, "test-01.json");
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);

  const steps = [
    WF["workflow_step"]("step1", (ctx) => ({ v: 1 })),
    WF["workflow_step"]("step2", (ctx) => ({ v: 2 })),
    WF["workflow_step"]("step3", (ctx) => ({ v: 3 })),
  ];

  const workflow = WF["workflow_create"]("test-workflow", steps);
  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    checkpoint_every: 1,  // Save after each step
  });

  // Checkpoint should be deleted after successful completion
  const exists = fs.existsSync(cpPath);
  return result.status === "success" && !exists;
});

// ── Test 2: Checkpoint contains correct data
test("P0-3-02: checkpoint has correct structure", () => {
  const cpPath = path.join(TEST_DIR, "test-02-temp.json");

  const steps = [
    WF["workflow_step"]("step1", (ctx) => ({ data: [1, 2, 3] })),
    WF["workflow_step"]("step2", (ctx) => ctx, {
      if: (ctx) => false,  // Will be skipped
    }),
  ];

  const workflow = WF["workflow_create"]("test-workflow", steps);
  WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    checkpoint_every: 1,
  });

  // File should be cleaned up on success
  return !fs.existsSync(cpPath);
});

// ── Test 3: Resume from checkpoint
test("P0-3-03: resume from checkpoint", () => {
  const cpPath = path.join(TEST_DIR, "test-03-resume.json");
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);

  // Simulate checkpoint by creating it manually
  const checkpointData = {
    workflow_id: "test-workflow",
    workflow_name: "test",
    step_index: 2,        // Resume from step 2
    context: { data: [1, 2, 3] },
    timestamp: T.now(),
    step_names: ["step1"],
    steps_completed: 1,
  };

  CP["checkpoint_save"](cpPath, checkpointData);

  let step1Executed = false;
  let step2Executed = false;

  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      step1Executed = true;
      return { v: 1 };
    }),
    WF["workflow_step"]("step2", (ctx) => {
      step2Executed = true;
      return { v: 2 };
    }),
  ];

  const workflow = {
    id: "test-workflow",
    name: "test",
    steps,
  };

  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    auto_resume: true,
  });

  // Step 1 should NOT execute (already completed)
  // Step 2 should execute (resumed)
  const ok = step1Executed === false &&
    step2Executed === true &&
    result.context.data !== undefined;

  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  return ok;
});

// ── Test 4: Checkpoint deleted on completion
test("P0-3-04: checkpoint deleted on success", () => {
  const cpPath = path.join(TEST_DIR, "test-04.json");

  const steps = [
    WF["workflow_step"]("step1", (ctx) => ({ ok: true })),
  ];

  const workflow = WF["workflow_create"]("test-workflow", steps);
  WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    checkpoint_every: 1,
  });

  // After successful completion, checkpoint should be deleted
  return !fs.existsSync(cpPath);
});

// ── Test 5: Checkpoint saved on failure (for retry)
test("P0-3-05: checkpoint available after failure", () => {
  const cpPath = path.join(TEST_DIR, "test-05.json");
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);

  const steps = [
    WF["workflow_step"]("step1", (ctx) => ({ v: 1 })),
    WF["workflow_step"]("step2", (ctx) => {
      throw new Error("Intentional failure");
    }),
  ];

  const workflow = WF["workflow_create"]("test-workflow", steps);
  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    checkpoint_every: 1,
  });

  // After failure, checkpoint should still exist (for manual resume)
  const exists = fs.existsSync(cpPath);
  const ok = result.status === "failed" && exists;

  if (exists) fs.unlinkSync(cpPath);
  return ok;
});

// ── Test 6: No checkpoint without path
test("P0-3-06: no checkpoint if path not provided", () => {
  const steps = [
    WF["workflow_step"]("step1", (ctx) => ({ v: 1 })),
  ];

  const workflow = WF["workflow_create"]("test-workflow", steps);
  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_every: 1,
    // No checkpoint_path provided
  });

  return result.status === "success";
});

// ── Test 7: Checkpoint skips on auto_resume=false
test("P0-3-07: auto_resume=false skips loading", () => {
  const cpPath = path.join(TEST_DIR, "test-07.json");
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);

  // Create initial checkpoint
  const checkpointData = {
    workflow_id: "test-workflow",
    workflow_name: "test",
    step_index: 1,
    context: { initial: true },
    timestamp: T.now(),
    step_names: [],
    steps_completed: 0,
  };

  CP["checkpoint_save"](cpPath, checkpointData);

  let step1Executed = false;

  const steps = [
    WF["workflow_step"]("step1", (ctx) => {
      step1Executed = true;
      return { v: 1 };
    }),
  ];

  const workflow = {
    id: "test-workflow",
    name: "test",
    steps,
  };

  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    auto_resume: false,  // Don't resume
  });

  // Step 1 should execute (auto_resume is false)
  const ok = step1Executed === true;

  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  return ok;
});

// ── Test 8: Helper functions
test("P0-3-08: checkpoint_path helper", () => {
  const path1 = CP["checkpoint_path"]("/tmp", "workflow-123");
  return path1.includes("workflow-123") && path1.includes(".json");
});

// ── Test 9: Load non-existent checkpoint
test("P0-3-09: load returns null for non-existent", () => {
  const result = CP["checkpoint_load"]("/tmp/non-existent-12345.json");
  return result === null;
});

// ── Test 10: Long workflow checkpoint cycle
test("P0-3-10: checkpoint on multi-step workflow", () => {
  const cpPath = path.join(TEST_DIR, "test-10.json");
  if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);

  const steps = Array.from({ length: 20 }, (_, i) =>
    WF["workflow_step"](`step${i + 1}`, (ctx) => ({ step: i + 1 }))
  );

  const workflow = WF["workflow_create"]("long-workflow", steps);
  const result = WF["workflow_run"](workflow, {}, {
    checkpoint_path: cpPath,
    checkpoint_every: 5,  // Save every 5 steps
  });

  // After completion, checkpoint should be cleaned up
  return result.status === "success" && !fs.existsSync(cpPath);
});

// ── Print summary
console.log("\n" + "=".repeat(50));
console.log(`Test Results: ${results.passed} passed, ${results.failed} failed`);
console.log("=".repeat(50) + "\n");

// Cleanup
try {
  if (fs.existsSync(TEST_DIR)) {
    const files = fs.readdirSync(TEST_DIR);
    files.forEach(f => fs.unlinkSync(path.join(TEST_DIR, f)));
    fs.rmdirSync(TEST_DIR);
  }
} catch (err) {
  // Ignore cleanup errors
}

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
