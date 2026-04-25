// FreeLang v9: Custom Error Classes
// Phase 6: Module System + Type-safe Error Handling
// Phase 59: 위치 정보 (file/line/col/hint) 추가

/**
 * 기본 ModuleError 클래스
 * 모듈 시스템 관련 모든 에러의 부모 클래스
 */
export class ModuleError extends Error {
  constructor(
    message: string,
    public moduleName: string,
    public file?: string,
    public line?: number,
    public col?: number,
    public hint?: string
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
  constructor(
    moduleName: string,
    source?: string,
    file?: string,
    line?: number,
    col?: number,
    hint?: string
  ) {
    const sourceStr = source ? ` (from ${source})` : "";
    super(`Module not found: ${moduleName}${sourceStr}`, moduleName, file, line, col, hint);
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
    functionName: string,
    file?: string,
    line?: number,
    col?: number,
    hint?: string
  ) {
    super(
      `Function "${functionName}" not exported from module "${moduleName}"`,
      moduleName,
      file,
      line,
      col,
      hint
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
    reason: string,
    file?: string,
    line?: number,
    col?: number,
    hint?: string
  ) {
    super(
      `Failed to register function "${functionName}" in module "${moduleName}": ${reason}`,
      moduleName,
      file,
      line,
      col,
      hint
    );
    this.name = "FunctionRegistrationError";
    Object.setPrototypeOf(this, FunctionRegistrationError.prototype);
  }
}

/**
 * Phase 59: 함수를 찾을 수 없을 때 발생 (유사 이름 힌트 포함)
 */
export class FunctionNotFoundError extends Error {
  constructor(
    public functionName: string,
    public file?: string,
    public line?: number,
    public col?: number,
    public hint?: string
  ) {
    const hintStr = hint ? ` ${hint}` : "";
    super(`Function not found: ${functionName}${hintStr}`);
    this.name = "FunctionNotFoundError";
    Object.setPrototypeOf(this, FunctionNotFoundError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────
// Phase A (2026-04-25): 에러 코드 시스템 + 통일 런타임 에러 클래스
// ─────────────────────────────────────────────────────────────

/** 표준 에러 코드 — AI/도구가 분기·검색 가능하도록 안정 식별자 사용 */
export const ErrorCodes = {
  TYPE_NIL: "E_TYPE_NIL",
  TYPE_MISMATCH: "E_TYPE_MISMATCH",
  ARG_COUNT: "E_ARG_COUNT",
  STACK_OVERFLOW: "E_STACK_OVERFLOW",
  FN_NOT_FOUND: "E_FN_NOT_FOUND",
  DIV_BY_ZERO: "E_DIV_BY_ZERO",
  INDEX_OUT_OF_BOUNDS: "E_INDEX_OOB",
  INVALID_FORM: "E_INVALID_FORM",
  RUNTIME: "E_RUNTIME",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/** 코드별 기본 복구 힌트 — formatError에서 자동 표시 */
export const RECOVERY_HINTS: Record<string, string> = {
  E_TYPE_NIL: "값이 nil인지 (nil? x) 또는 (get-or x :key default) 로 먼저 확인하세요.",
  E_TYPE_MISMATCH: "기대 타입과 다릅니다. (string? x) (number? x) 등으로 사전 검증하거나 변환 함수를 사용하세요.",
  E_ARG_COUNT: "인자 갯수가 맞지 않습니다. 함수 시그니처를 다시 확인하세요.",
  E_STACK_OVERFLOW: "재귀 깊이 초과. 종료 조건이 있는지, 또는 loop/recur 또는 reduce로 변환 가능한지 확인하세요.",
  E_FN_NOT_FOUND: "함수가 등록되지 않았습니다. 모듈 import 또는 오타를 확인하세요.",
  E_DIV_BY_ZERO: "0으로 나눌 수 없습니다. 분모 검증 (= denom 0) 후 분기하세요.",
  E_INDEX_OOB: "인덱스가 범위를 벗어났습니다. (length coll) 으로 길이를 먼저 확인하세요.",
  E_INVALID_FORM: "잘못된 special form 구조입니다. 문법 가이드를 확인하세요.",
  E_RUNTIME: "런타임 오류. 입력 데이터와 흐름을 점검하세요.",
};

export interface FLErrorContext {
  fn?: string;          // 호출된 함수명
  expected?: string;    // 기대 타입/갯수
  got?: string;         // 실제 받은 값/타입/갯수
  arg?: number;         // 인자 인덱스 (0-based)
  varName?: string;     // 관련 변수명
  [key: string]: any;   // 확장
}

/** FreeLang 런타임 통일 에러 — Phase A에서 throw 지점을 이걸로 통일 */
export class FLRuntimeError extends ModuleError {
  constructor(
    public code: ErrorCode,
    message: string,
    public context: FLErrorContext = {},
    file?: string,
    line?: number,
    col?: number,
    hint?: string
  ) {
    super(`[${code}] ${message}`, "runtime", file, line, col, hint ?? RECOVERY_HINTS[code]);
    this.name = "FLRuntimeError";
    Object.setPrototypeOf(this, FLRuntimeError.prototype);
  }
}
