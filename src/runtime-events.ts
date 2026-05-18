// runtime-events.ts — FreeLang runtime event buffer
// Phase 4: structured event substrate
// Phase 6: severity / correlation / deduplication / noise filter
// Phase 7: contract-violation type + contract integration

import { checkContracts } from "./runtime-contracts";
import { isTraceEnabled, isDebugEnabled } from "./runtime-governance";
import { checkBudget, hasBudget } from "./runtime-budget";
import { recordActivity } from "./runtime-watchdog";

export type EventSeverity = "debug" | "info" | "warn" | "error" | "fatal";

const SEVERITY_RANK: Record<EventSeverity, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export interface RuntimeEvent {
  type: "debug" | "trace" | "assert-fail" | "runtime-error" | "contract-violation" | "mode-change" | "governance-action" | "budget-exceeded" | "watchdog-alert" | "context-aborted";
  severity: EventSeverity;
  eventId: number;
  traceId?: string;
  parentEventId?: number;
  timestamp: number;
  file?: string;
  line?: number;
  label?: string;
  expr?: string;
  value?: any;
  elapsedMs?: number;
  message?: string;
  errorKind?: string;
  contractName?: string;
  collapsed?: boolean;
  count?: number;
}

export const DEFAULT_SEVERITY: Record<RuntimeEvent["type"], EventSeverity> = {
  "debug":              "debug",
  "trace":              "info",
  "assert-fail":        "error",
  "runtime-error":      "fatal",
  "contract-violation": "warn",
  "mode-change":        "info",
  "governance-action":  "warn",
  "budget-exceeded":    "error",
  "watchdog-alert":     "warn",
  "context-aborted":    "warn",
};

const MAX_EVENTS = 1000;
const _buf: RuntimeEvent[] = [];
let _eventIdCounter = 0;
let _traceCounter = 0;
let _minSeverity: EventSeverity | null = null;

export function getNextEventId(): number { return ++_eventIdCounter; }
export function newTraceId(): string    { return `trace-${++_traceCounter}`; }
export function resetCounters(): void   { _eventIdCounter = 0; _traceCounter = 0; }

export function setRuntimeFilter(minSev: EventSeverity | null): void { _minSeverity = minSev; }
export function getRuntimeFilter(): EventSeverity | null             { return _minSeverity; }
export function clearRuntimeFilter(): void                           { _minSeverity = null; }

function shouldRecord(sev: EventSeverity): boolean {
  return _minSeverity === null || SEVERITY_RANK[sev] >= SEVERITY_RANK[_minSeverity];
}

function fingerprint(ev: RuntimeEvent): string {
  return `${ev.type}|${ev.expr ?? ""}|${ev.file ?? ""}|${ev.line ?? ""}|${ev.label ?? ""}|${ev.contractName ?? ""}`;
}

// ev.severity / ev.eventId 는 optional — 자동 할당
export function recordEvent(
  ev: Omit<RuntimeEvent, "eventId" | "severity"> & { severity?: EventSeverity }
): void {
  // governance 모드 필터 (mode-change/governance-action/budget-exceeded는 항상 통과)
  if (ev.type === "trace" && !isTraceEnabled()) return;
  if (ev.type === "debug" && !isDebugEnabled()) return;

  // budget 체크 (budget-exceeded 자체는 재귀 방지)
  if (ev.type !== "budget-exceeded" && ev.type !== "watchdog-alert" && ev.type !== "context-aborted") {
    if (hasBudget()) {
      checkBudget(Date.now(), _buf.length, 0); // ms + event count 체크 (recursion은 eval-call-function에서)
    }
    // watchdog activity 갱신
    recordActivity(_buf.length);
  }

  const sev: EventSeverity = ev.severity ?? DEFAULT_SEVERITY[ev.type] ?? "info";
  if (!shouldRecord(sev)) return;

  const eventId = getNextEventId();
  const full: RuntimeEvent = { ...(ev as any), severity: sev, eventId };

  // 연속 동일 이벤트 collapse
  if (_buf.length > 0) {
    const last = _buf[_buf.length - 1];
    if (fingerprint(last) === fingerprint(full)) {
      last.count = (last.count ?? 1) + 1;
      last.collapsed = true;
      last.timestamp = full.timestamp;
      last.eventId = eventId;
      return;
    }
  }

  full.count = 1;
  _buf.push(full);
  if (_buf.length > MAX_EVENTS) _buf.shift();

  // Contract 자동 평가 (contract-violation은 재귀 방지)
  if (full.type !== "contract-violation") {
    const violations = checkContracts(_buf, full);
    for (const vev of violations) {
      const vid = getNextEventId();
      const vfull: RuntimeEvent = {
        ...(vev as any),
        severity: vev.severity ?? "warn",
        eventId: vid,
        count: 1,
      };
      _buf.push(vfull);
      if (_buf.length > MAX_EVENTS) _buf.shift();
    }
  }
}

export function getEvents(): RuntimeEvent[] { return _buf.slice(); }
export function clearEvents(): void         { _buf.length = 0; }
