// runtime-contracts.ts — FreeLang runtime contract system
// Phase 7: Runtime Contracts & Self-Diagnosing Execution
//
// 순환 의존성 방지 전략:
//   이 모듈은 RuntimeEvent 타입만 import (import type — 런타임 dep 없음)
//   contract-violation 이벤트는 직접 반환 → runtime-events.ts가 _buf에 push

import type { RuntimeEvent, EventSeverity } from "./runtime-events";

export interface ContractDef {
  name: string;
  eventType: RuntimeEvent["type"] | "any";
  errorKind?: string;
  threshold: number;
  windowMs: number;
  action: "warn" | "error" | "collapse" | "throttle";
}

const _contracts = new Map<string, ContractDef>();
const _throttleMap = new Map<string, number>();

export function defineContract(name: string, def: Omit<ContractDef, "name">): void {
  _contracts.set(name, { name, ...def });
}

export function getContracts(): ContractDef[] {
  return [..._contracts.values()];
}

export function clearContracts(): void {
  _contracts.clear();
  _throttleMap.clear();
}

// violation 이벤트 객체 배열 반환 (caller가 _buf에 push)
export function checkContracts(
  buf: RuntimeEvent[],
  newEvent: RuntimeEvent
): Array<Partial<RuntimeEvent> & { type: "contract-violation"; contractName: string }> {
  const out: Array<Partial<RuntimeEvent> & { type: "contract-violation"; contractName: string }> = [];
  const now = newEvent.timestamp;

  for (const [name, c] of _contracts) {
    if (c.eventType !== "any" && c.eventType !== newEvent.type) continue;
    if (c.errorKind && (newEvent as any).errorKind !== c.errorKind) continue;

    // 시간 window 내 일치 이벤트 수
    const windowStart = now - c.windowMs;
    let matchCount = 0;
    for (let i = buf.length - 1; i >= 0; i--) {
      const e = buf[i];
      if (e.timestamp < windowStart) break;
      if (c.eventType !== "any" && e.type !== c.eventType) continue;
      if (c.errorKind && (e as any).errorKind !== c.errorKind) continue;
      matchCount += e.count ?? 1;
    }

    if (matchCount < c.threshold) continue;

    // 같은 contract은 windowMs 내 1회만 fire
    const lastFire = _throttleMap.get(name) ?? 0;
    if (now - lastFire < Math.max(c.windowMs, 500)) continue;
    _throttleMap.set(name, now);

    const sev: EventSeverity =
      c.action === "error"    ? "error"
      : c.action === "collapse" ? "warn"
      : c.action === "throttle" ? "info"
      : "warn";

    out.push({
      type: "contract-violation",
      severity: sev,
      contractName: name,
      timestamp: now,
      message: `Contract "${name}": ${matchCount} × ${c.eventType} in ${c.windowMs}ms (threshold ${c.threshold}, action: ${c.action})`,
      value: { contractName: name, matchCount, threshold: c.threshold, action: c.action },
    });
  }

  return out;
}

// ── 기본 내장 contracts ──────────────────────────────────────────────────────
// 자동 self-diagnosing을 위해 사전 등록

defineContract("auto:trace-explosion", {
  eventType: "trace",
  threshold: 50,
  windowMs: 1000,
  action: "collapse",
});

defineContract("auto:assert-storm", {
  eventType: "assert-fail",
  threshold: 5,
  windowMs: 5000,
  action: "warn",
});

defineContract("auto:error-burst", {
  eventType: "runtime-error",
  threshold: 5,
  windowMs: 5000,
  action: "error",
});
