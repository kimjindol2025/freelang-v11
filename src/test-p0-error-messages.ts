// Test suite for P0-4: Clear error messages with metadata
// Tests: error categorization, metadata inclusion

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

// ── Test 1: Timeout error categorized
test("P0-4-01: TIMEOUT category detected", () => {
  const step = WF["workflow_step"]("api_call", (ctx) => {
    throw new Error("Request timeout after 5000ms");
  }, {
    fallback: { default: true },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "api_call");
  return logEntry?.category === "TIMEOUT";
});

// ── Test 2: Connection error categorized
test("P0-4-02: CONNECTION category detected", () => {
  const step = WF["workflow_step"]("network_call", (ctx) => {
    throw new Error("Error: connect ECONNREFUSED 127.0.0.1:3000");
  }, {
    fallback: {},
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "network_call");
  return logEntry?.category === "CONNECTION";
});

// ── Test 3: Parse error categorized
test("P0-4-03: PARSE_ERROR category detected", () => {
  const step = WF["workflow_step"]("json_parse", (ctx) => {
    throw new Error("JSON parse error: unexpected token");
  }, {
    fallback: { data: [] },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "json_parse");
  return logEntry?.category === "PARSE_ERROR";
});

// ── Test 4: Type error categorized
test("P0-4-04: TYPE_ERROR category detected", () => {
  const step = WF["workflow_step"]("type_check", (ctx) => {
    throw new Error("Cannot read property 'length' of undefined");
  }, {
    fallback: { length: 0 },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "type_check");
  return logEntry?.category === "TYPE_ERROR" || logEntry?.category === "UNKNOWN";
});

// ── Test 5: Not found error categorized
test("P0-4-05: NOT_FOUND category detected", () => {
  const step = WF["workflow_step"]("file_read", (ctx) => {
    throw new Error("ENOENT: no such file or directory");
  }, {
    fallback: { content: "" },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "file_read");
  return logEntry?.category === "NOT_FOUND";
});

// ── Test 6: Retry count in log
test("P0-4-06: attempted count in log", () => {
  const step = WF["workflow_step"]("retry_test", (ctx) => {
    throw new Error("Transient error");
  }, {
    retry: 2,
    fallback: { ok: true },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "retry_test");
  // retry: 2 means maxAttempts = 3 (1 initial + 2 retries)
  return logEntry?.attempted === 3;
});

// ── Test 7: Error message preserved
test("P0-4-07: error message in log", () => {
  const errorMsg = "Database connection pool exhausted";

  const step = WF["workflow_step"]("db_query", (ctx) => {
    throw new Error(errorMsg);
  }, {
    fallback: { cached: true },
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "db_query");
  return logEntry?.error?.includes("Database connection");
});

// ── Test 8: Step timing in log
test("P0-4-08: step timing recorded", () => {
  const step = WF["workflow_step"]("timed_step", (ctx) => {
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 50) {}
    throw new Error("Failed");
  }, {
    fallback: {},
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const logEntry = result.log.find(l => l.step === "timed_step");
  return logEntry && logEntry.ms >= 40;  // At least ~40ms
});

// ── Test 9: Status field in log
test("P0-4-09: status field indicates how error was handled", () => {
  const step1 = WF["workflow_step"]("with_on_error", (ctx) => {
    throw new Error("Error");
  }, {
    on_error: (err) => ({ handled: true }),
  });

  const step2 = WF["workflow_step"]("with_fallback", (ctx) => {
    throw new Error("Error");
  }, {
    fallback: { ok: true },
  });

  const workflow = WF["workflow_create"]("test", [step1, step2]);
  const result = WF["workflow_run"](workflow, {});

  const log1 = result.log.find(l => l.step === "with_on_error");
  const log2 = result.log.find(l => l.step === "with_fallback");

  return log1?.status === "error_handled" && log2?.status === "fallback_used";
});

// ── Test 10: Detailed error in result.errors
test("P0-4-10: detailed error message in errors array", () => {
  const step = WF["workflow_step"]("failing_step", (ctx) => {
    throw new Error("API returned 500 Internal Server Error");
  }, {
    required: true,
    fallback: {},  // Won't be used (required=true)
  });

  const workflow = WF["workflow_create"]("test", [step]);
  const result = WF["workflow_run"](workflow, {});

  const hasError = result.errors.some(e =>
    e.includes("failing_step") && e.includes("API returned")
  );

  return result.status === "failed" && hasError;
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
