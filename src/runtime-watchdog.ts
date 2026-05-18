// runtime-watchdog.ts — FreeLang logical watchdog
// Phase 9: Runtime Isolation
//
// Node.js 단일 스레드 제약 → OS 타이머 대신 논리적 watchdog
// recordEvent / runtime-resources 호출 시점에 stall 감지

export interface WatchdogAlert {
  kind: "stalled-execution" | "trace-storm" | "no-progress";
  elapsedMs: number;
  eventCount: number;
}

const STALL_THRESHOLD_MS = 10_000;   // 10초 이상 이벤트 없으면 stall
const TRACE_STORM_RATE   = 500;      // 1초에 500개 이상 trace = storm

let _lastActivityMs = Date.now();
let _lastEventCount = 0;
let _alertCount = 0;
let _alerts: WatchdogAlert[] = [];

// 이벤트 기록 시 호출 → stall 감지
export function recordActivity(eventCount: number): WatchdogAlert | null {
  const now = Date.now();
  const elapsed = now - _lastActivityMs;
  let alert: WatchdogAlert | null = null;

  // trace storm: 1초 내 급격한 이벤트 증가
  const rate = elapsed > 0 ? ((eventCount - _lastEventCount) / elapsed) * 1000 : 0;
  if (rate > TRACE_STORM_RATE && elapsed < 1000) {
    alert = { kind: "trace-storm", elapsedMs: elapsed, eventCount };
  }

  _lastActivityMs = now;
  _lastEventCount = eventCount;

  if (alert) {
    _alertCount++;
    _alerts.push(alert);
    if (_alerts.length > 20) _alerts.shift();
  }

  return alert;
}

// runtime-resources / runtime-health 호출 시 stall 체크
export function checkStall(eventCount: number): WatchdogAlert | null {
  const now = Date.now();
  const elapsed = now - _lastActivityMs;

  if (elapsed > STALL_THRESHOLD_MS && eventCount === _lastEventCount) {
    const alert: WatchdogAlert = { kind: "stalled-execution", elapsedMs: elapsed, eventCount };
    _alertCount++;
    _alerts.push(alert);
    if (_alerts.length > 20) _alerts.shift();
    _lastActivityMs = now; // stall 감지 후 리셋 (반복 알림 방지)
    return alert;
  }
  return null;
}

export function getWatchdogAlerts(): number { return _alertCount; }
export function getRecentAlerts(): WatchdogAlert[] { return _alerts.slice(); }

export function resetWatchdog(): void {
  _lastActivityMs = Date.now();
  _lastEventCount = 0;
  _alertCount = 0;
  _alerts.length = 0;
}
