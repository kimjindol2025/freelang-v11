/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
export declare class ModuleError extends Error {
    moduleName: string;
    file?: string | undefined;
    line?: number | undefined;
    col?: number | undefined;
    hint?: string | undefined;
    constructor(message: string, moduleName: string, file?: string | undefined, line?: number | undefined, col?: number | undefined, hint?: string | undefined);
}
/**
 * 모듈을 찾을 수 없을 때 발생
 */
export declare class ModuleNotFoundError extends ModuleError {
    constructor(moduleName: string, source?: string, file?: string, line?: number, col?: number, hint?: string);
}
/**
 * 선택적 import에서 함수를 찾을 수 없을 때 발생
 */
export declare class SelectiveImportError extends ModuleError {
    constructor(moduleName: string, functionName: string, file?: string, line?: number, col?: number, hint?: string);
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
    constructor(moduleName: string, functionName: string, reason: string, file?: string, line?: number, col?: number, hint?: string);
}
/**
 * Phase 59: 함수를 찾을 수 없을 때 발생 (유사 이름 힌트 포함)
 */
export declare class FunctionNotFoundError extends Error {
    functionName: string;
    file?: string | undefined;
    line?: number | undefined;
    col?: number | undefined;
    hint?: string | undefined;
    constructor(functionName: string, file?: string | undefined, line?: number | undefined, col?: number | undefined, hint?: string | undefined);
}
//# sourceMappingURL=errors.d.ts.map