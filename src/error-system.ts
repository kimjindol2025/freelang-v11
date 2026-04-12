// FreeLang v9: AI 에러 분류 + 자동 복구 시스템 — Phase 96
// 에러는 AI가 이해하고, 분류하고, 복구하는 데이터다.

import { Err, Result, ErrorCategory, ok, err, isErr, fromThrown } from './result-type';

// ── RecoveryStrategy ──────────────────────────────────────────────────────
export interface RecoveryStrategy {
  name: string;
  condition: (e: Err) => boolean;
  recover: (e: Err) => any;
}

// ── AIErrorSystem ─────────────────────────────────────────────────────────
export class AIErrorSystem {
  private strategies: RecoveryStrategy[] = [];

  addStrategy(s: RecoveryStrategy): this {
    this.strategies.push(s);
    return this;
  }

  /** 자동 복구 시도. 복구 성공 → ok(값), 실패 → err 그대로 */
  handle(e: Err): Result<any> {
    for (const s of this.strategies) {
      if (s.condition(e)) {
        try {
          return ok(s.recover(e));
        } catch {
          // 이 전략 실패 → 다음 전략 시도
        }
      }
    }
    return e;
  }

  /** 기존 throw 에러 → 구조화된 Err */
  classify(e: Error | string): Err {
    return fromThrown(e);
  }

  /** AI가 이해할 수 있는 한국어 설명 생성 */
  explain(e: Err): string {
    const categoryLabel: Record<ErrorCategory, string> = {
      [ErrorCategory.TYPE_ERROR]:    '타입 오류',
      [ErrorCategory.RUNTIME_ERROR]: '런타임 오류',
      [ErrorCategory.NOT_FOUND]:     '찾을 수 없음',
      [ErrorCategory.ARITY]:         '인자 수 오류',
      [ErrorCategory.IO]:            '입출력 오류',
      [ErrorCategory.AI]:            'AI 블록 오류',
      [ErrorCategory.USER]:          '사용자 정의 오류',
      [ErrorCategory.TIMEOUT]:       '타임아웃',
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

  canRecover(e: Err): boolean {
    if (e.recoverable) return true;
    return this.strategies.some(s => s.condition(e));
  }
}

// ── 기본 시스템 (싱글톤) ─────────────────────────────────────────────────
export const defaultErrorSystem = new AIErrorSystem();

// 기본 전략: 0으로 나누기 → 0 반환
defaultErrorSystem.addStrategy({
  name: 'division-by-zero',
  condition: (e) => e.message.toLowerCase().includes('division by zero') ||
                    e.message.toLowerCase().includes('divide by zero') ||
                    (e.category === ErrorCategory.RUNTIME_ERROR && e.code === 'DIV_ZERO'),
  recover: () => 0,
});

// 기본 전략: not-found + recoverable → null 반환
defaultErrorSystem.addStrategy({
  name: 'not-found-null',
  condition: (e) => e.category === ErrorCategory.NOT_FOUND && e.recoverable === true,
  recover: () => null,
});
