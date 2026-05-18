// runtime-events.ts — FreeLang runtime event buffer
// Phase 4: structured event substrate
// Phase 6: severity / correlation / deduplication / noise filter

export type EventSeverity = "debug" | "info" | "warn" | "error" | "fatal";

const SEVERITY_RANK: Record<EventSeverity, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export interface RuntimeEvent {
  type: "debug" | "trace" | "assert-fail" | "runtime-error";
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
  collapsed?: boolean;
  count?: number;
}

export const DEFAULT_SEVERITY: Record<RuntimeEvent["type"], EventSeverity> = {
  "debug":         "debug",
  "trace":         "info",
  "assert-fail":   "error",
  "runtime-error": "fatal",
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
  return `${ev.type}|${ev.expr ?? ""}|${ev.file ?? ""}|${ev.line ?? ""}|${ev.label ?? ""}`;
}

// ev.severity / ev.eventId 는 optional — 자동 할당
export function recordEvent(
  ev: Omit<RuntimeEvent, "eventId" | "severity"> & { severity?: EventSeverity }
): void {
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
}

export function getEvents(): RuntimeEvent[] { return _buf.slice(); }
export function clearEvents(): void         { _buf.length = 0; }
