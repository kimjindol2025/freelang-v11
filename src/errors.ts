// FreeLang v9: Custom Error Classes
// Phase 6: Module System + Type-safe Error Handling

/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
export class ModuleError extends Error {
  constructor(
    message: string,
    public moduleName: string
  ) {
    super(message);
    this.name = "ModuleError";
    Object.setPrototypeOf(this, ModuleError.prototype);
  }
}

/**
 * 모듈을 찾을 수 없을 때 발생
 */
export class ModuleNotFoundError extends ModuleError {
  constructor(moduleName: string, source?: string) {
    const sourceStr = source ? ` (from ${source})` : "";
    super(`Module not found: ${moduleName}${sourceStr}`, moduleName);
    this.name = "ModuleNotFoundError";
    Object.setPrototypeOf(this, ModuleNotFoundError.prototype);
  }
}

/**
 * 선택적 import에서 함수를 찾을 수 없을 때 발생
 */
export class SelectiveImportError extends ModuleError {
  constructor(
    moduleName: string,
    functionName: string
  ) {
    super(
      `Function "${functionName}" not exported from module "${moduleName}"`,
      moduleName
    );
    this.name = "SelectiveImportError";
    Object.setPrototypeOf(this, SelectiveImportError.prototype);
  }
}

/**
 * 모듈이 올바른 구조가 아닐 때 발생
 */
export class InvalidModuleStructureError extends ModuleError {
  constructor(moduleName: string, issue: string) {
    super(`Invalid module structure in "${moduleName}": ${issue}`, moduleName);
    this.name = "InvalidModuleStructureError";
    Object.setPrototypeOf(this, InvalidModuleStructureError.prototype);
  }
}

/**
 * 함수 등록 실패 시 발생
 */
export class FunctionRegistrationError extends ModuleError {
  constructor(
    moduleName: string,
    functionName: string,
    reason: string
  ) {
    super(
      `Failed to register function "${functionName}" in module "${moduleName}": ${reason}`,
      moduleName
    );
    this.name = "FunctionRegistrationError";
    Object.setPrototypeOf(this, FunctionRegistrationError.prototype);
  }
}
