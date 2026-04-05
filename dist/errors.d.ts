/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
export declare class ModuleError extends Error {
    moduleName: string;
    constructor(message: string, moduleName: string);
}
/**
 * 모듈을 찾을 수 없을 때 발생
 */
export declare class ModuleNotFoundError extends ModuleError {
    constructor(moduleName: string, source?: string);
}
/**
 * 선택적 import에서 함수를 찾을 수 없을 때 발생
 */
export declare class SelectiveImportError extends ModuleError {
    constructor(moduleName: string, functionName: string);
}
/**
 * 모듈이 올바른 구조가 아닐 때 발생
 */
export declare class InvalidModuleStructureError extends ModuleError {
    constructor(moduleName: string, issue: string);
}
/**
 * 함수 등록 실패 시 발생
 */
export declare class FunctionRegistrationError extends ModuleError {
    constructor(moduleName: string, functionName: string, reason: string);
}
//# sourceMappingURL=errors.d.ts.map