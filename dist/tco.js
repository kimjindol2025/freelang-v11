"use strict";
// FreeLang v9: Trampoline-based TCO (Tail Call Optimization)
// Phase 61: 100만 재귀를 스택 오버플로 없이 실행
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAIL_CALL = void 0;
exports.tailCall = tailCall;
exports.isTailCall = isTailCall;
exports.trampoline = trampoline;
exports.TAIL_CALL = Symbol("TAIL_CALL");
function tailCall(fn, args) {
    return { [exports.TAIL_CALL]: true, fn, args };
}
function isTailCall(v) {
    return v !== null && typeof v === "object" && v[exports.TAIL_CALL] === true;
}
// Trampoline: TailCall이 반환되는 한 계속 반복 실행 (스택 없이)
function trampoline(interp, initial) {
    let current = initial;
    while (isTailCall(current)) {
        if (typeof current.fn === "string") {
            current = interp.callUserFunctionRaw(current.fn, current.args);
        }
        else {
            current = interp.callFunctionValueRaw(current.fn, current.args);
        }
    }
    return current;
}
//# sourceMappingURL=tco.js.map