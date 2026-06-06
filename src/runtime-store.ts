// runtime-store.ts — FreeLang Phase 10: persistent runtime session store
// Each run's summary is appended to a JSON file for cross-run analysis.

import * as fs from "fs";
import * as path from "path";

export interface RunRecord {
  runId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  summary: Record<string, unknown>;
  issues: unknown[];
  violations: Array<{ contractName: string; count: number }>;
  mode: string;
  budgetExceeded: boolean;
}

interface StoreFile {
  version: "1";
  runs: RunRecord[];
}

const DEFAULT_PATH = ".runtime-store.json";

let _runCounter = 0;
export function newRunId(): string { return `r-${++_runCounter}`; }

function readStore(filePath: string): StoreFile {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return { version: "1", runs: [] };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as StoreFile;
  } catch {
    return { version: "1", runs: [] };
  }
}

function writeStore(filePath: string, store: StoreFile): void {
  const p = path.resolve(filePath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}

export function storeAppendRun(record: RunRecord, filePath: string = DEFAULT_PATH): void {
  const store = readStore(filePath);
  store.runs.push(record);
  // keep last 200 runs
  if (store.runs.length > 200) store.runs.splice(0, store.runs.length - 200);
  writeStore(filePath, store);
}

export function storeLoadRuns(filePath: string = DEFAULT_PATH): RunRecord[] {
  return readStore(filePath).runs;
}

export function storeClear(filePath: string = DEFAULT_PATH): void {
  const p = path.resolve(filePath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function storeGetDefaultPath(): string { return DEFAULT_PATH; }
