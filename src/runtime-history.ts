// runtime-history.ts — FreeLang Phase 10: cross-run aggregation & pattern detection

import { RunRecord, storeLoadRuns } from "./runtime-store";

export interface HistorySummary {
  "total-runs": number;
  "avg-errors-per-run": number;
  "avg-trace-ms": number | null;
  "budget-exceeded-runs": number;
  "panic-mode-runs": number;
  "most-frequent-issue": string | null;
  "error-trend": "improving" | "stable" | "degrading" | "insufficient-data";
  "repeated-violations": Array<{ contractName: string; totalCount: number; runs: number }>;
}

export function computeHistory(filePath?: string): HistorySummary {
  const runs = storeLoadRuns(filePath);
  if (runs.length === 0) {
    return {
      "total-runs": 0,
      "avg-errors-per-run": 0,
      "avg-trace-ms": null,
      "budget-exceeded-runs": 0,
      "panic-mode-runs": 0,
      "most-frequent-issue": null,
      "error-trend": "insufficient-data",
      "repeated-violations": [],
    };
  }

  const errorCounts = runs.map(r => {
    const s = r.summary as any;
    return (s["runtime-error-count"] ?? 0) + (s["assert-fail-count"] ?? 0);
  });
  const avgErrors = Math.round((errorCounts.reduce((a, b) => a + b, 0) / runs.length) * 10) / 10;

  const traceMsList = runs
    .map(r => (r.summary as any)["avg-trace-ms"])
    .filter((v): v is number => typeof v === "number");
  const avgTraceMs = traceMsList.length
    ? Math.round(traceMsList.reduce((a, b) => a + b, 0) / traceMsList.length)
    : null;

  const budgetRuns = runs.filter(r => r.budgetExceeded).length;
  const panicRuns = runs.filter(r => r.mode === "panic").length;

  // issue frequency
  const issueFreq: Record<string, number> = {};
  for (const r of runs) {
    for (const iss of (r.issues ?? []) as any[]) {
      const cause = iss["likely-cause"] ?? "unknown";
      if (cause !== "healthy") issueFreq[cause] = (issueFreq[cause] ?? 0) + 1;
    }
  }
  const sortedIssues = Object.entries(issueFreq).sort((a, b) => b[1] - a[1]);
  const mostFrequent = sortedIssues.length > 0 ? sortedIssues[0][0] : null;

  // error trend: compare last 3 vs prior 3
  let trend: HistorySummary["error-trend"] = "insufficient-data";
  if (runs.length >= 6) {
    const recent = errorCounts.slice(-3).reduce((a, b) => a + b, 0);
    const prior = errorCounts.slice(-6, -3).reduce((a, b) => a + b, 0);
    if (recent < prior - 1) trend = "improving";
    else if (recent > prior + 1) trend = "degrading";
    else trend = "stable";
  } else if (runs.length >= 2) {
    const half = Math.floor(runs.length / 2);
    const recent = errorCounts.slice(-half).reduce((a, b) => a + b, 0);
    const prior = errorCounts.slice(0, half).reduce((a, b) => a + b, 0);
    trend = recent <= prior ? "stable" : "degrading";
  }

  // repeated violations across runs
  const violMap: Record<string, { total: number; runs: number }> = {};
  for (const r of runs) {
    const seen = new Set<string>();
    for (const v of (r.violations ?? []) as any[]) {
      const cn: string = v.contractName ?? "?";
      if (!violMap[cn]) violMap[cn] = { total: 0, runs: 0 };
      violMap[cn].total += v.count ?? 1;
      if (!seen.has(cn)) { violMap[cn].runs++; seen.add(cn); }
    }
  }
  const repeatedViolations = Object.entries(violMap)
    .filter(([, v]) => v.runs >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([contractName, v]) => ({ contractName, totalCount: v.total, runs: v.runs }));

  return {
    "total-runs": runs.length,
    "avg-errors-per-run": avgErrors,
    "avg-trace-ms": avgTraceMs,
    "budget-exceeded-runs": budgetRuns,
    "panic-mode-runs": panicRuns,
    "most-frequent-issue": mostFrequent,
    "error-trend": trend,
    "repeated-violations": repeatedViolations,
  };
}

export interface RunReplaySummary {
  runId: string;
  durationMs: number;
  errors: number;
  mode: string;
  budgetExceeded: boolean;
  topIssue: string | null;
}

export function replayHistory(filePath?: string): RunReplaySummary[] {
  return storeLoadRuns(filePath).map(r => {
    const s = r.summary as any;
    const errors = (s["runtime-error-count"] ?? 0) + (s["assert-fail-count"] ?? 0);
    const issues = (r.issues ?? []) as any[];
    const topIssue = issues.length > 0 && issues[0]["likely-cause"] !== "healthy"
      ? issues[0]["likely-cause"] : null;
    return {
      runId: r.runId,
      durationMs: r.durationMs,
      errors,
      mode: r.mode,
      budgetExceeded: r.budgetExceeded,
      topIssue,
    };
  });
}
