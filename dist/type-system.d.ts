export type FlType = "int" | "float" | "number" | "string" | "bool" | "array" | "map" | "fn" | "any" | "null";
/**
 * 런타임 값에서 FlType 추론
 */
export declare function inferType(value: any): FlType;
/**
 * 타입 호환성 검사
 * - any: 모든 타입과 호환
 * - number: int | float 모두 허용
 * - float: int와 호환 (int → float 자동 변환)
 */
export declare function isCompatible(actual: FlType, expected: FlType): boolean;
/**
 * TypeAnnotation name → FlType 변환
 * 기존 type-checker.ts의 TypeAnnotation.name 문자열과 호환
 */
export declare function toFlType(typeName: string): FlType;
export interface FuncTypeSignature {
    params: FlType[];
    ret: FlType;
}
/**
 * RuntimeTypeChecker — Phase 60 핵심 클래스
 *
 * strict=false (기본): 타입 불일치 무시 → 기존 코드 모두 통과
 * strict=true: 타입 어노테이션 있는 함수 호출 시 실제 인수 타입 검증
 */
export declare class RuntimeTypeChecker {
    private strict;
    private funcTypes;
    constructor(strict?: boolean);
    get isStrict(): boolean;
    /**
     * 함수 타입 시그니처 등록
     * paramTypeNames: TypeAnnotation.name 문자열 배열 (기존 type-checker와 호환)
     */
    registerFunc(name: string, paramTypeNames: string[], retTypeName: string): void;
    /**
     * 함수 호출 시 인수 타입 검증
     * strict 모드가 아니거나, 시그니처가 미등록이면 아무것도 하지 않음
     */
    checkCall(name: string, argValues: any[]): void;
    /**
     * 함수 반환값 타입 검증 (optional — strict 모드)
     */
    checkReturn(name: string, retValue: any): void;
    /**
     * 등록된 함수 시그니처 조회 (테스트용)
     */
    getSignature(name: string): FuncTypeSignature | undefined;
    /**
     * 등록된 함수 목록 (테스트용)
     */
    registeredFuncs(): string[];
}
//# sourceMappingURL=type-system.d.ts.map