// SIS — Semantic Immune System, L1 Evidence Bus (Phase 2, 인터프리터 런타임 통합)
// Phase 1 C PoC(sis-l1.c)의 JS 포팅. emit 경로 O(1), malloc/throw/sleep 없음.
// LOCK: Evidence 생성기일 뿐 Truth 판정 없음. 자기관측(drop_latch)은 ring과 분리(immunodeficiency 방지).

export const E_TIMER_EXCEPTION = 1;
export const E_EXPR_DROPPED = 2;
export const E_EVENT_DROPPED = 3;

const CAP = 4096;
const ring: Array<{ ts: number; type: number; payload: any } | undefined> = new Array(CAP);
let head = 0, tail = 0;
let emit_count = 0, received_count = 0, dropped_count = 0, dropped_since_notice = 0;
let drop_latch: { emit_count: number; dropped_count: number } | null = null;
let drop_latch_seq = 0;

function ringPush(type: number, payload: any): boolean {
  const next = (head + 1) % CAP;
  if (next === tail) return false;          // full
  ring[head] = { ts: Date.now(), type, payload };
  head = next; received_count++;
  return true;
}

// 런타임을 멈추지 않는다. 성공 true / drop false.
// SIS Phase 3 — L3-minimal immune response (Observe→Classify→React). 정책은 얇게: score++/quarantine 판정만.
const QUARANTINE_THRESHOLD = 3;
const policyState = new Map<number, { score: number; quarantined: boolean }>();
let policy_event_count = 0, policy_fire_count = 0, quarantine_count = 0, policy_error_count = 0;
function sisPolicyOnEvent(type: number, payload: any): void {
  policy_event_count++;                       // I1: <= received_count
  if (type !== E_TIMER_EXCEPTION) return;     // 검증된 이벤트만 정책 대상(P1)
  const tid = (payload && payload.timer_id) || 0;
  let s = policyState.get(tid);
  if (!s) { s = { score: 0, quarantined: false }; policyState.set(tid, s); }
  s.score++;                                  // I3: monotonic (감소 경로 없음)
  if (s.score >= QUARANTINE_THRESHOLD && !s.quarantined) {
    s.quarantined = true; quarantine_count++; policy_fire_count++;  // I2
    console.error(`[SIS] event=E_TIMER_EXCEPTION score=${s.score} quarantined=true action=QUARANTINE timer=${tid}`);
  }
}

export function sisEmit(type: number, payload: any): boolean {
  emit_count++;
  if (dropped_since_notice > 0 && type !== E_EVENT_DROPPED) {
    if (ringPush(E_EVENT_DROPPED, { emit_count, dropped_count })) dropped_since_notice = 0;
  }
  const ok = ringPush(type, payload);
  if (!ok) {
    dropped_count++; dropped_since_notice++;
    // 보장 latch: ring full이어도 자기관측 절대 안 잃음 (immunodeficiency 방지, LOCK-4)
    drop_latch = { emit_count, dropped_count }; drop_latch_seq++;
  }
  // I4: subscriber(정책) 격리 — 정책 오류가 Evidence Bus를 손상시키면 안 됨
  try { sisPolicyOnEvent(type, payload); } catch { policy_error_count++; }
  return ok;
}

// 검증/노출용 — sis_stats 빌트인이 반환. 카운터 불변식 포함.
export function sisStats(): any {
  const queued = (head + CAP - tail) % CAP;
  return {
    emit_count, received_count, dropped_count, queued,
    drop_latch_seq, drop_latch,
    invariant_ok: emit_count === received_count + dropped_count,
    // Phase 3 정책 카운터
    policy_event_count, policy_fire_count, quarantine_count, policy_error_count,
  };
}

// 테스트용 drain (subscriber 자리). Phase 2엔 subscriber 미구현.
export function sisDrain(): void { tail = head; }
