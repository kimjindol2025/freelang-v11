// FreeLang v9: Result 타입 — Phase 96 AI 에러 처리 시스템
// 에러는 프로그램 종료가 아니다. AI가 학습하고 복구하는 정보다.

// ── ErrorCategory ────────────────────────────────────────────────────────
export enum ErrorCategory {
  TYPE_ERROR    = 'type-error',
  RUNTIME_ERROR = 'runtime-error',
  NOT_FOUND     = 'not-found',
  ARITY         = 'arity-error',
  IO            = 'io-error',
  AI            = 'ai-error',
  USER          = 'user-error',
  TIMEOUT       = 'timeout',
}

// ── Ok<T> ─────────────────────────────────────────────────────────────────
export interface Ok<T> {
  readonly _tag: 'Ok';
  readonly value: T;
}

// ── Err ──────────────────────────────────────────────────────────────────
export interface Err {
  readonly _tag: 'Err';
  readonly code: string;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly context?: Record<string, any>;
  readonly hint?: string;
  readonly recoverable: boolean;
}

// ── Result<T> ─────────────────────────────────────────────────────────────
export type Result<T> = Ok<T> | Err;

// ── 생성 함수 ─────────────────────────────────────────────────────────────
export function ok<T>(value: T): Ok<T> {
  return { _tag: 'Ok', value };
}

export function err(
  code: string,
  message: string,
  opts?: {
    category?: ErrorCategory;
    context?: Record<string, any>;
    hint?: string;
    recoverable?: boolean;
  }
): Err {
  return {
    _tag: 'Err',
    code,
    message,
    category: opts?.category ?? ErrorCategory.RUNTIME_ERROR,
    context: opts?.context,
    hint: opts?.hint,
    recoverable: opts?.recoverable ?? false,
  };
}

// ── 판별 함수 ─────────────────────────────────────────────────────────────
export function isOk<T>(r: Result<T>): r is Ok<T> {
  return r._tag === 'Ok';
}

export function isErr<T>(r: Result<T>): r is Err {
  return r._tag === 'Err';
}

// ── 값 추출 ───────────────────────────────────────────────────────────────
export function unwrap<T>(r: Result<T>): T {
  if (isOk(r)) return r.value;
  throw new Error(`[FreeLang Result] unwrap failed: [${r.code}] ${r.message}`);
}

export function unwrapOr<T>(r: Result<T>, defaultValue: T): T {
  if (isOk(r)) return r.value;
  return defaultValue;
}

// ── 변환 함수 ─────────────────────────────────────────────────────────────
export function mapOk<T, U>(r: Result<T>, fn: (v: T) => U): Result<U> {
  if (isOk(r)) return ok(fn(r.value));
  return r as unknown as Err;
}

export function mapErr<T>(r: Result<T>, fn: (e: Err) => Err): Result<T> {
  if (isErr(r)) return fn(r);
  return r;
}

export function flatMap<T, U>(r: Result<T>, fn: (v: T) => Result<U>): Result<U> {
  if (isOk(r)) return fn(r.value);
  return r as unknown as Err;
}

export function recover<T>(r: Result<T>, fn: (e: Err) => T): T {
  if (isOk(r)) return r.value;
  return fn(r);
}

// ── 기존 Error → Result 변환 ──────────────────────────────────────────────
export function fromThrown(e: unknown, code = 'UNKNOWN'): Err {
  if (typeof e === 'string') {
    return err(code, e);
  }
  if (e instanceof Error) {
    // 에러 메시지에서 카테고리 추론
    const msg = e.message.toLowerCase();
    let category = ErrorCategory.RUNTIME_ERROR;
    if (msg.includes('not found') || msg.includes('undefined') || msg.includes('cannot find')) {
      category = ErrorCategory.NOT_FOUND;
    } else if (msg.includes('type') || msg.includes('is not a')) {
      category = ErrorCategory.TYPE_ERROR;
    } else if (msg.includes('arity') || msg.includes('argument')) {
      category = ErrorCategory.ARITY;
    } else if (msg.includes('timeout')) {
      category = ErrorCategory.TIMEOUT;
    } else if (msg.includes('enoent') || msg.includes('eacces') || msg.includes('file')) {
      category = ErrorCategory.IO;
    }
    return err(code, e.message, { category, recoverable: false });
  }
  return err(code, String(e));
}
