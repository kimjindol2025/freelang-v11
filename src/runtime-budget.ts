// runtime-budget.ts — FreeLang execution budget system
// Phase 9: Runtime Isolation, Budgeting & Watchdog
//
// 의존성 없음 (순환 방지) — eval-call-function, eval-special-forms 등이 import

export class BudgetExceededError extends Error {
  constructor(
    public readonly kind: "max-ms" | "max-events" | "max-recursion",
    public readonly limit: number,
    public readonly actual: number,
    public readonly contextId?: string
  ) {
    super(`Budget exceeded: ${kind} (limit=${limit}, actual=${actual})`);
    this.name = "BudgetExceededError";
  }
}

interface ActiveBudget {
  maxMs?: number;
  maxEvents?: number;
  maxRecursion?: number;
  startMs: number;
  startEvents: number;
  startRecursion: number;
  contextId?: string;
}

// 중첩 with-budget 지원을 위한 스택
const _stack: ActiveBudget[] = [];
let _budgetViolationCount = 0;

export function pushBudget(opts: {
  maxMs?: number;
  maxEvents?: number;
  maxRecursion?: number;
  startMs: number;
  startEvents: number;
  startRecursion: number;
  contextId?: string;
}): void {
  _stack.push({ ...opts });
}

export function popBudget(): void {
  _stack.pop();
}

export function hasBudget(): boolean {
  return _stack.length > 0;
}

export function getCurrentBudget(): ActiveBudget | null {
  return _stack.length > 0 ? _stack[_stack.length - 1] : null;
}

// 예산 초과 시 BudgetExceededError throw
export function checkBudget(currentMs: number, currentEvents: number, currentRecursion: number): void {
  const b = getCurrentBudget();
  if (!b) return;

  if (b.maxMs !== undefined) {
    const elapsed = currentMs - b.startMs;
    if (elapsed > b.maxMs) {
      _budgetViolationCount++;
      throw new BudgetExceededError("max-ms", b.maxMs, elapsed, b.contextId);
    }
  }
  if (b.maxEvents !== undefined) {
    const used = currentEvents - b.startEvents;
    if (used > b.maxEvents) {
      _budgetViolationCount++;
      throw new BudgetExceededError("max-events", b.maxEvents, used, b.contextId);
    }
  }
  if (b.maxRecursion !== undefined) {
    const depth = currentRecursion - b.startRecursion;
    if (depth > b.maxRecursion) {
      _budgetViolationCount++;
      throw new BudgetExceededError("max-recursion", b.maxRecursion, depth, b.contextId);
    }
  }
}

export function getBudgetViolationCount(): number {
  return _budgetViolationCount;
}

export function resetBudget(): void {
  _stack.length = 0;
  _budgetViolationCount = 0;
}
