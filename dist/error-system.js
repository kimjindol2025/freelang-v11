"use strict";
// FreeLang v9: AI 에러 분류 + 자동 복구 시스템 — Phase 96
// 에러는 AI가 이해하고, 분류하고, 복구하는 데이터다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultErrorSystem = exports.AIErrorSystem = void 0;
const result_type_1 = require("./result-type");
// ── AIErrorSystem ─────────────────────────────────────────────────────────
class AIErrorSystem {
    constructor() {
        this.strategies = [];
    }
    addStrategy(s) {
        this.strategies.push(s);
        return this;
    }
    /** 자동 복구 시도. 복구 성공 → ok(값), 실패 → err 그대로 */
    handle(e) {
        for (const s of this.strategies) {
            if (s.condition(e)) {
                try {
                    return (0, result_type_1.ok)(s.recover(e));
                }
                catch {
                    // 이 전략 실패 → 다음 전략 시도
                }
            }
        }
        return e;
    }
    /** 기존 throw 에러 → 구조화된 Err */
    classify(e) {
        return (0, result_type_1.fromThrown)(e);
    }
    /** AI가 이해할 수 있는 한국어 설명 생성 */
    explain(e) {
        const categoryLabel = {
            [result_type_1.ErrorCategory.TYPE_ERROR]: '타입 오류',
            [result_type_1.ErrorCategory.RUNTIME_ERROR]: '런타임 오류',
            [result_type_1.ErrorCategory.NOT_FOUND]: '찾을 수 없음',
            [result_type_1.ErrorCategory.ARITY]: '인자 수 오류',
            [result_type_1.ErrorCategory.IO]: '입출력 오류',
            [result_type_1.ErrorCategory.AI]: 'AI 블록 오류',
            [result_type_1.ErrorCategory.USER]: '사용자 정의 오류',
            [result_type_1.ErrorCategory.TIMEOUT]: '타임아웃',
        };
        const label = categoryLabel[e.category] ?? '알 수 없는 오류';
        let explanation = `[${label}] ${e.message}`;
        if (e.hint) {
            explanation += `\n  힌트: ${e.hint}`;
        }
        if (e.recoverable) {
            explanation += '\n  복구 가능: 자동 복구를 시도할 수 있습니다.';
        }
        return explanation;
    }
    canRecover(e) {
        if (e.recoverable)
            return true;
        return this.strategies.some(s => s.condition(e));
    }
}
exports.AIErrorSystem = AIErrorSystem;
// ── 기본 시스템 (싱글톤) ─────────────────────────────────────────────────
exports.defaultErrorSystem = new AIErrorSystem();
// 기본 전략: 0으로 나누기 → 0 반환
exports.defaultErrorSystem.addStrategy({
    name: 'division-by-zero',
    condition: (e) => e.message.toLowerCase().includes('division by zero') ||
        e.message.toLowerCase().includes('divide by zero') ||
        (e.category === result_type_1.ErrorCategory.RUNTIME_ERROR && e.code === 'DIV_ZERO'),
    recover: () => 0,
});
// 기본 전략: not-found + recoverable → null 반환
exports.defaultErrorSystem.addStrategy({
    name: 'not-found-null',
    condition: (e) => e.category === result_type_1.ErrorCategory.NOT_FOUND && e.recoverable === true,
    recover: () => null,
});
//# sourceMappingURL=error-system.js.map