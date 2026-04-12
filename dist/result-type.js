"use strict";
// FreeLang v9: Result 타입 — Phase 96 AI 에러 처리 시스템
// 에러는 프로그램 종료가 아니다. AI가 학습하고 복구하는 정보다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCategory = void 0;
exports.ok = ok;
exports.err = err;
exports.isOk = isOk;
exports.isErr = isErr;
exports.unwrap = unwrap;
exports.unwrapOr = unwrapOr;
exports.mapOk = mapOk;
exports.mapErr = mapErr;
exports.flatMap = flatMap;
exports.recover = recover;
exports.fromThrown = fromThrown;
// ── ErrorCategory ────────────────────────────────────────────────────────
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["TYPE_ERROR"] = "type-error";
    ErrorCategory["RUNTIME_ERROR"] = "runtime-error";
    ErrorCategory["NOT_FOUND"] = "not-found";
    ErrorCategory["ARITY"] = "arity-error";
    ErrorCategory["IO"] = "io-error";
    ErrorCategory["AI"] = "ai-error";
    ErrorCategory["USER"] = "user-error";
    ErrorCategory["TIMEOUT"] = "timeout";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
// ── 생성 함수 ─────────────────────────────────────────────────────────────
function ok(value) {
    return { _tag: 'Ok', value };
}
function err(code, message, opts) {
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
function isOk(r) {
    return r._tag === 'Ok';
}
function isErr(r) {
    return r._tag === 'Err';
}
// ── 값 추출 ───────────────────────────────────────────────────────────────
function unwrap(r) {
    if (isOk(r))
        return r.value;
    throw new Error(`[FreeLang Result] unwrap failed: [${r.code}] ${r.message}`);
}
function unwrapOr(r, defaultValue) {
    if (isOk(r))
        return r.value;
    return defaultValue;
}
// ── 변환 함수 ─────────────────────────────────────────────────────────────
function mapOk(r, fn) {
    if (isOk(r))
        return ok(fn(r.value));
    return r;
}
function mapErr(r, fn) {
    if (isErr(r))
        return fn(r);
    return r;
}
function flatMap(r, fn) {
    if (isOk(r))
        return fn(r.value);
    return r;
}
function recover(r, fn) {
    if (isOk(r))
        return r.value;
    return fn(r);
}
// ── 기존 Error → Result 변환 ──────────────────────────────────────────────
function fromThrown(e, code = 'UNKNOWN') {
    if (typeof e === 'string') {
        return err(code, e);
    }
    if (e instanceof Error) {
        // 에러 메시지에서 카테고리 추론
        const msg = e.message.toLowerCase();
        let category = ErrorCategory.RUNTIME_ERROR;
        if (msg.includes('not found') || msg.includes('undefined') || msg.includes('cannot find')) {
            category = ErrorCategory.NOT_FOUND;
        }
        else if (msg.includes('type') || msg.includes('is not a')) {
            category = ErrorCategory.TYPE_ERROR;
        }
        else if (msg.includes('arity') || msg.includes('argument')) {
            category = ErrorCategory.ARITY;
        }
        else if (msg.includes('timeout')) {
            category = ErrorCategory.TIMEOUT;
        }
        else if (msg.includes('enoent') || msg.includes('eacces') || msg.includes('file')) {
            category = ErrorCategory.IO;
        }
        return err(code, e.message, { category, recoverable: false });
    }
    return err(code, String(e));
}
//# sourceMappingURL=result-type.js.map