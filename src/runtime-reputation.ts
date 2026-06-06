// runtime-reputation.ts — FreeLang Phase 10: contract/context stability scoring

import { storeLoadRuns } from "./runtime-store";

export interface ReputationScore {
  name: string;
  score: number;       // 0.0 (bad) ~ 1.0 (perfect)
  totalViolations: number;
  affectedRuns: number;
  totalRuns: number;
  verdict: "stable" | "unstable" | "risky" | "unknown";
}

export function computeReputation(name: string, filePath?: string): ReputationScore {
  const runs = storeLoadRuns(filePath);
  if (runs.length === 0) {
    return { name, score: 1.0, totalViolations: 0, affectedRuns: 0, totalRuns: 0, verdict: "unknown" };
  }

  let totalViolations = 0;
  let affectedRuns = 0;

  for (const r of runs) {
    let runViolations = 0;
    for (const v of (r.violations ?? []) as any[]) {
      if ((v.contractName ?? "") === name) {
        runViolations += v.count ?? 1;
      }
    }
    if (runViolations > 0) {
      totalViolations += runViolations;
      affectedRuns++;
    }
  }

  const totalRuns = runs.length;
  // penalty: each affected run costs, each violation adds small penalty
  const runPenalty = affectedRuns / totalRuns;
  const violPenalty = Math.min(totalViolations / (totalRuns * 10), 0.5);
  const score = Math.max(0, Math.round((1.0 - runPenalty * 0.7 - violPenalty * 0.3) * 100) / 100);

  let verdict: ReputationScore["verdict"];
  if (totalRuns < 2) verdict = "unknown";
  else if (score >= 0.9) verdict = "stable";
  else if (score >= 0.6) verdict = "unstable";
  else verdict = "risky";

  return { name, score, totalViolations, affectedRuns, totalRuns, verdict };
}

export interface AllReputations {
  contracts: ReputationScore[];
  worstContract: string | null;
}

export function computeAllReputations(filePath?: string): AllReputations {
  const runs = storeLoadRuns(filePath);
  const names = new Set<string>();
  for (const r of runs) {
    for (const v of (r.violations ?? []) as any[]) {
      if (v.contractName) names.add(v.contractName);
    }
  }
  const contracts = [...names].map(n => computeReputation(n, filePath))
    .sort((a, b) => a.score - b.score);
  const worstContract = contracts.length > 0 && contracts[0].verdict !== "unknown"
    ? contracts[0].name : null;
  return { contracts, worstContract };
}
