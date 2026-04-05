"use strict";
// FreeLang v9: Custom Error Classes
// Phase 6: Module System + Type-safe Error Handling
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRegistrationError = exports.InvalidModuleStructureError = exports.SelectiveImportError = exports.ModuleNotFoundError = exports.ModuleError = void 0;
/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
class ModuleError extends Error {
    constructor(message, moduleName) {
        super(message);
        this.moduleName = moduleName;
        this.name = "ModuleError";
        Object.setPrototypeOf(this, ModuleError.prototype);
    }
}
exports.ModuleError = ModuleError;
/**
 * 모듈을 찾을 수 없을 때 발생
 */
class ModuleNotFoundError extends ModuleError {
    constructor(moduleName, source) {
        const sourceStr = source ? ` (from ${source})` : "";
        super(`Module not found: ${moduleName}${sourceStr}`, moduleName);
        this.name = "ModuleNotFoundError";
        Object.setPrototypeOf(this, ModuleNotFoundError.prototype);
    }
}
exports.ModuleNotFoundError = ModuleNotFoundError;
/**
 * 선택적 import에서 함수를 찾을 수 없을 때 발생
 */
class SelectiveImportError extends ModuleError {
    constructor(moduleName, functionName) {
        super(`Function "${functionName}" not exported from module "${moduleName}"`, moduleName);
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
    constructor(moduleName, functionName, reason) {
        super(`Failed to register function "${functionName}" in module "${moduleName}": ${reason}`, moduleName);
        this.name = "FunctionRegistrationError";
        Object.setPrototypeOf(this, FunctionRegistrationError.prototype);
    }
}
exports.FunctionRegistrationError = FunctionRegistrationError;
//# sourceMappingURL=errors.js.map