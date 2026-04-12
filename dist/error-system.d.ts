import { Err, Result } from './result-type';
export interface RecoveryStrategy {
    name: string;
    condition: (e: Err) => boolean;
    recover: (e: Err) => any;
}
export declare class AIErrorSystem {
    private strategies;
    addStrategy(s: RecoveryStrategy): this;
    /** 자동 복구 시도. 복구 성공 → ok(값), 실패 → err 그대로 */
    handle(e: Err): Result<any>;
    /** 기존 throw 에러 → 구조화된 Err */
    classify(e: Error | string): Err;
    /** AI가 이해할 수 있는 한국어 설명 생성 */
    explain(e: Err): string;
    canRecover(e: Err): boolean;
}
export declare const defaultErrorSystem: AIErrorSystem;
//# sourceMappingURL=error-system.d.ts.map