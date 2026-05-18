// runtime-governance.ts — FreeLang self-governing runtime
// Phase 8: Runtime Governance & Autonomous Recovery
//
// 의존성 없음 (순환 방지) — 다른 runtime 모듈이 이 파일을 import

export type RuntimeMode = "normal" | "degraded" | "protected" | "panic";

let _mode: RuntimeMode = "normal";
let _traceEnabled = true;
let _debugEnabled = true;
const _frozenContracts = new Set<string>();
const _escalationCounts = new Map<string, number>();
const _throttledContracts = new Set<string>();

export function getRuntimeMode(): RuntimeMode { return _mode; }
export function isTraceEnabled(): boolean     { return _traceEnabled; }
export function isDebugEnabled(): boolean     { return _debugEnabled; }
export function isContractFrozen(name: string): boolean { return _frozenContracts.has(name); }

export function setRuntimeMode(newMode: RuntimeMode): void {
  _mode = newMode;
  if (newMode === "panic") {
    _traceEnabled = false;
    _debugEnabled = false;
  } else if (newMode === "protected") {
    _traceEnabled = false;
  } else if (newMode === "normal") {
    _traceEnabled = true;
    _debugEnabled = true;
    _frozenContracts.clear();
    _throttledContracts.clear();
    _escalationCounts.clear();
  }
}

// health score(0~1) 기반 자동 모드 전환
export function autoTransitionMode(healthScore: number, recentBurstCount: number): void {
  if (_mode === "panic") return; // panic은 수동 recover 전까지 유지
  if (healthScore < 0.5 || recentBurstCount >= 3) {
    if (_mode !== "protected") setRuntimeMode("protected");
  } else if (healthScore < 0.7) {
    if (_mode === "normal") _mode = "degraded";
  } else if (healthScore >= 0.9 && _mode === "degraded") {
    setRuntimeMode("normal");
  }
}

// contract action 실행 (checkContracts에서 호출)
export function applyGovernanceAction(action: string, contractName: string): void {
  switch (action) {
    case "disable-trace":
      _traceEnabled = false;
      break;
    case "drop-debug":
      _debugEnabled = false;
      break;
    case "freeze-contract":
      _frozenContracts.add(contractName);
      break;
    case "panic":
      setRuntimeMode("panic");
      break;
    case "clear-events":
      // clear-events는 eval-builtins.ts에서 직접 처리 (순환 방지)
      _clearEventsRequested = true;
      break;
  }
}

// clear-events 요청 플래그 (eval-builtins.ts가 poll)
let _clearEventsRequested = false;
export function consumeClearEventsRequest(): boolean {
  const v = _clearEventsRequested;
  _clearEventsRequested = false;
  return v;
}

// escalation — contract 위반 누적 카운트
export function incrementEscalation(contractName: string): number {
  const n = (_escalationCounts.get(contractName) ?? 0) + 1;
  _escalationCounts.set(contractName, n);
  return n;
}

export function getEscalationLevel(contractName: string): number {
  return _escalationCounts.get(contractName) ?? 0;
}

// 정상 복귀
export function recoverRuntime(): void {
  setRuntimeMode("normal");
  _frozenContracts.clear();
  _throttledContracts.clear();
  _escalationCounts.clear();
  _clearEventsRequested = false;
}

export function getRuntimePolicy(): Record<string, unknown> {
  return {
    "mode":                _mode,
    "trace-enabled":       _traceEnabled,
    "debug-enabled":       _debugEnabled,
    "collapse-enabled":    true,
    "active-contracts":    -1, // eval-builtins.ts에서 채움
    "frozen-contracts":    [..._frozenContracts],
    "throttled-contracts": [..._throttledContracts],
  };
}

// 테스트/리셋용
export function resetGovernance(): void {
  _mode = "normal";
  _traceEnabled = true;
  _debugEnabled = true;
  _frozenContracts.clear();
  _throttledContracts.clear();
  _escalationCounts.clear();
  _clearEventsRequested = false;
}
