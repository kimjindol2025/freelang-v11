"use strict";
// FreeLang v9 TryReason — 실패 복구 추론
// Phase 104: (try-reason :attempts [...] :on-success fn :on-all-fail fn)
// 각 attempt를 순서대로 시도, 성공하면 즉시 반환, 모두 실패하면 on-all-fail
Object.defineProperty(exports, "__esModule", { value: true });
exports.TryReasoner = void 0;
exports.tryReasonSync = tryReasonSync;
exports.tryReasonBuiltin = tryReasonBuiltin;
exports.tryWithFallback = tryWithFallback;
class TryReasoner {
    constructor() {
        this.history = [];
    }
    async run(config) {
        const errors = [];
        for (let i = 0; i < config.attempts.length; i++) {
            const { strategy, fn, validate } = config.attempts[i];
            try {
                const value = await Promise.resolve(fn());
                const valid = validate ? validate(value) : true;
                if (valid) {
                    this.history.push({ success: true, value, attempt: i + 1, strategy });
                    config.onSuccess?.(value, strategy, i + 1);
                    return value;
                }
                else {
                    const err = `validation failed`;
                    errors.push(`[${strategy}] ${err}`);
                    this.history.push({ success: false, error: err, attempt: i + 1, strategy });
                }
            }
            catch (e) {
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
    getHistory() { return [...this.history]; }
    lastSuccess() {
        const successes = this.history.filter(h => h.success);
        return successes.length > 0 ? successes[successes.length - 1] : null;
    }
    reset() {
        this.history = [];
    }
}
exports.TryReasoner = TryReasoner;
// 동기 버전 (간단한 경우)
function tryReasonSync(config) {
    const errors = [];
    for (const { strategy, fn, validate } of config.attempts) {
        try {
            const value = fn();
            if (!validate || validate(value)) {
                config.onSuccess?.(value, strategy, 0);
                return value;
            }
            errors.push(`[${strategy}] validation failed`);
        }
        catch (e) {
            errors.push(`[${strategy}] ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    if (config.onAllFail)
        return config.onAllFail(errors);
    throw new Error(`All attempts failed: ${errors.join(', ')}`);
}
// FreeLang 내장함수용 헬퍼
// (try-reason [[strategy fn] ...]) → 첫 성공 값
async function tryReasonBuiltin(attempts) {
    if (attempts.length === 0) {
        throw new Error('All attempts failed:\n(no attempts provided)');
    }
    const reasoner = new TryReasoner();
    return reasoner.run({
        attempts: attempts.map(([strategy, fn]) => ({ strategy, fn })),
    });
}
// (try-with-fallback fn fallback) → fn() 실패 시 fallback
async function tryWithFallback(fn, fallback) {
    try {
        return await Promise.resolve(fn());
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=try-reason.js.map