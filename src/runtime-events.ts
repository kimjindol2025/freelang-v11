// runtime-events.ts — FreeLang runtime event buffer
// debug/trace/assert/error 이벤트를 구조화된 객체로 수집.
// 모듈 싱글톤 — 프로세스 단위 격리 (ARDS subprocess에 적합).

export interface RuntimeEvent {
  type: "debug" | "trace" | "assert-fail" | "runtime-error";
  timestamp: number;
  file?: string;
  line?: number;
  label?: string;      // debug
  expr?: string;       // trace / assert / error
  value?: any;         // debug / trace (JSON-serializable 권장)
  elapsedMs?: number;  // trace
  message?: string;    // assert-fail / runtime-error
  errorKind?: string;  // E_RUNTIME 등 FLRuntimeError.code
}

const MAX_EVENTS = 1000;
const _buf: RuntimeEvent[] = [];

export function recordEvent(ev: RuntimeEvent): void {
  _buf.push(ev);
  if (_buf.length > MAX_EVENTS) _buf.shift();
}

export function getEvents(): RuntimeEvent[] {
  return _buf.slice();
}

export function clearEvents(): void {
  _buf.length = 0;
}
