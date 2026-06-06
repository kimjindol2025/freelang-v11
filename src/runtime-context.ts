// runtime-context.ts — FreeLang execution context / sandbox ID tracking
// Phase 9: Runtime Isolation
//
// 의존성 없음 — 다른 runtime 모듈이 import

interface ExecContext {
  id: string;
  startMs: number;
  active: boolean;
  aborted: boolean;
}

const _contexts = new Map<string, ExecContext>();
const _contextStack: string[] = [];
const _abortedIds = new Set<string>();
let _counter = 0;

function nextContextId(): string {
  return `ctx-${++_counter}`;
}

// 새 context 시작 → id 반환
export function pushContext(id?: string): string {
  const ctxId = id ?? nextContextId();
  _contexts.set(ctxId, { id: ctxId, startMs: Date.now(), active: true, aborted: false });
  _contextStack.push(ctxId);
  return ctxId;
}

// 현재 context 종료
export function popContext(): string | null {
  const id = _contextStack.pop();
  if (id) {
    const ctx = _contexts.get(id);
    if (ctx) ctx.active = false;
  }
  return id ?? null;
}

export function getCurrentContextId(): string | null {
  return _contextStack.length > 0 ? _contextStack[_contextStack.length - 1] : null;
}

// 특정 context 강제 abort
export function abortContext(id: string): boolean {
  _abortedIds.add(id);
  const ctx = _contexts.get(id);
  if (ctx) {
    ctx.aborted = true;
    ctx.active = false;
    return true;
  }
  return false;
}

// 현재 context (또는 지정 id)가 abort됐는지 확인
export function isContextAborted(id?: string): boolean {
  const target = id ?? getCurrentContextId();
  if (!target) return false;
  return _abortedIds.has(target);
}

export function getActiveContexts(): Array<{ id: string; startMs: number; elapsedMs: number }> {
  const now = Date.now();
  return _contextStack
    .map(id => _contexts.get(id))
    .filter((c): c is ExecContext => !!c && c.active && !c.aborted)
    .map(c => ({ id: c.id, startMs: c.startMs, elapsedMs: now - c.startMs }));
}

export function getAllContexts(): ExecContext[] {
  return [..._contexts.values()];
}

export function resetContexts(): void {
  _contexts.clear();
  _contextStack.length = 0;
  _abortedIds.clear();
  _counter = 0;
}
