import { FlType } from "./type-system";
export interface BuiltinTypeSig {
    params: FlType[];
    ret: FlType;
}
/**
 * 내장 연산자/함수의 타입 시그니처
 * params: 각 인수의 기대 타입 (any → 검증 스킵)
 * ret: 반환값 타입
 */
export declare const BUILTIN_TYPE_SIGS: Record<string, BuiltinTypeSig>;
/**
 * 내장 함수 타입 시그니처 조회
 */
export declare function getBuiltinTypeSig(op: string): BuiltinTypeSig | null;
//# sourceMappingURL=stdlib-types.d.ts.map