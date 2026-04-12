"use strict";
// FreeLang v9: Custom Error Classes
// Phase 6: Module System + Type-safe Error Handling
// Phase 59: 위치 정보 (file/line/col/hint) 추가
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionNotFoundError = exports.FunctionRegistrationError = exports.InvalidModuleStructureError = exports.SelectiveImportError = exports.ModuleNotFoundError = exports.ModuleError = void 0;
/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
class ModuleError extends Error {
    constructor(message, moduleName, file, line, col, hint) {
        super(message);
        this.moduleName = moduleName;
        this.file = file;
        this.line = line;
        this.col = col;
        this.hint = hint;
        this.name = "ModuleError";
        Object.setPrototypeOf(this, ModuleError.prototype);
    }
}
exports.ModuleError = ModuleError;
/**
 * 모듈을 찾을 수 없을 때 발생
 */
class ModuleNotFoundError extends ModuleError {
    constructor(moduleName, source, file, line, col, hint) {
        const sourceStr = source ? ` (from ${source})` : "";
        super(`Module not found: ${moduleName}${sourceStr}`, moduleName, file, line, col, hint);
        this.name = "ModuleNotFoundError";
        Object.setPrototypeOf(this, ModuleNotFoundError.prototype);
    }
}
exports.ModuleNotFoundError = ModuleNotFoundError;
/**
 * 선택적 import에서 함수를 찾을 수 없을 때 발생
 */
class SelectiveImportError extends ModuleError {
    constructor(moduleName, functionName, file, line, col, hint) {
        super(`Function "${functionName}" not exported from module "${moduleName}"`, moduleName, file, line, col, hint);
        this.name = "SelectiveImportError";
        Object.setPrototypeOf(this, SelectiveImportError.prototype);
    }
}
exports.SelectiveImportError = SelectiveImportError;
/**
 * 모듈이 올바른 구조가 아닐 때 발생
 */
class InvalidModuleStructureError extends ModuleError {
    constructor(moduleName, issue) {
        super(`Invalid module structure in "${moduleName}": ${issue}`, moduleName);
        this.name = "InvalidModuleStructureError";
        Object.setPrototypeOf(this, InvalidModuleStructureError.prototype);
    }
}
exports.InvalidModuleStructureError = InvalidModuleStructureError;
/**
 * 함수 등록 실패 시 발생
 */
class FunctionRegistrationError extends ModuleError {
    constructor(moduleName, functionName, reason, file, line, col, hint) {
        super(`Failed to register function "${functionName}" in module "${moduleName}": ${reason}`, moduleName, file, line, col, hint);
        this.name = "FunctionRegistrationError";
        Object.setPrototypeOf(this, FunctionRegistrationError.prototype);
    }
}
exports.FunctionRegistrationError = FunctionRegistrationError;
/**
 * Phase 59: 함수를 찾을 수 없을 때 발생 (유사 이름 힌트 포함)
 */
class FunctionNotFoundError extends Error {
    constructor(functionName, file, line, col, hint) {
        const hintStr = hint ? ` ${hint}` : "";
        super(`Function not found: ${functionName}${hintStr}`);
        this.functionName = functionName;
        this.file = file;
        this.line = line;
        this.col = col;
        this.hint = hint;
        this.name = "FunctionNotFoundError";
        Object.setPrototypeOf(this, FunctionNotFoundError.prototype);
    }
}
exports.FunctionNotFoundError = FunctionNotFoundError;
//# sourceMappingURL=errors.js.map