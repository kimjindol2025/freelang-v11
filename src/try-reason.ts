// FreeLang v9 TryReason — 실패 복구 추론
// Phase 104: (try-reason :attempts [...] :on-success fn :on-all-fail fn)
// 각 attempt를 순서대로 시도, 성공하면 즉시 반환, 모두 실패하면 on-all-fail

export type AttemptResult<T> =
  | { success: true; value: T; attempt: number; strategy: string }
  | { success: false; error: string; attempt: number; strategy: string };

export interface TryReasonConfig<T> {
  attempts: Array<{
    strategy: string;
    fn: () => T | Promise<T>;
    validate?: (v: T) => boolean; // 성공 검증 (optional)
  }>;
  onSuccess?: (result: T, strategy: string, attemptNum: number) => void;
  onAllFail?: (errors: string[]) => T;
}

export class TryReasoner<T> {
  private history: AttemptResult<T>[] = [];

  async run(config: TryReasonConfig<T>): Promise<T> {
    const errors: string[] = [];

    for (let i = 0; i < config.attempts.length; i++) {
      const { strategy, fn, validate } = config.attempts[i];
      try {
        const value = await Promise.resolve(fn());
        const valid = validate ? validate(value) : true;
        if (valid) {
          this.history.push({ success: true, value, attempt: i + 1, strategy });
          config.onSuccess?.(value, strategy, i + 1);
          return value;
        } else {
          const err = `validation failed`;
          errors.push(`[${strategy}] ${err}`);
          this.history.push({ success: false, error: err, attempt: i + 1, strategy });
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        errors.push(`[${strategy}] ${err}`);
        this.history.push({ success: false, error: err, attempt: i + 1, strategy });
      }
    }

    if (config.onAllFail) {
      return config.onAllFail(errors);
    }
    throw new Error(`All attempts failed:\n${errors.join('\n')}`);
  }

  getHistory(): AttemptResult<T>[] { return [...this.history]; }

  lastSuccess(): AttemptResult<T> | null {
    const successes = this.history.filter(h => h.success);
    return successes.length > 0 ? successes[successes.length - 1] : null;
  }

  reset(): void {
    this.history = [];
  }
}

// 동기 버전 (간단한 경우)
export function tryReasonSync<T>(config: Omit<TryReasonConfig<T>, 'attempts'> & {
  attempts: Array<{ strategy: string; fn: () => T; validate?: (v: T) => boolean }>;
}): T {
  const errors: string[] = [];
  for (const { strategy, fn, validate } of config.attempts) {
    try {
      const value = fn();
      if (!validate || validate(value)) {
        config.onSuccess?.(value, strategy, 0);
        return value;
      }
      errors.push(`[${strategy}] validation failed`);
    } catch (e) {
      errors.push(`[${strategy}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (config.onAllFail) return config.onAllFail(errors);
  throw new Error(`All attempts failed: ${errors.join(', ')}`);
}

// FreeLang 내장함수용 헬퍼
// (try-reason [[strategy fn] ...]) → 첫 성공 값
export async function tryReasonBuiltin(
  attempts: Array<[string, () => any]>
): Promise<any> {
  if (attempts.length === 0) {
    throw new Error('All attempts failed:\n(no attempts provided)');
  }
  const reasoner = new TryReasoner<any>();
  return reasoner.run({
    attempts: attempts.map(([strategy, fn]) => ({ strategy, fn })),
  });
}

// (try-with-fallback fn fallback) → fn() 실패 시 fallback
export async function tryWithFallback<T>(
  fn: () => T | Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch {
    return fallback;
  }
}
