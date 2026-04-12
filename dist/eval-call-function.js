"use strict";
// FreeLang v9: Function Call Evaluation
// Phase 58: interpreter.ts에서 분리된 함수 호출 로직
// Phase 61: TCO (Tail Call Optimization) 추가
Object.defineProperty(exports, "__esModule", { value: true });
exports.callUserFunction = callUserFunction;
exports.callFunctionValue = callFunctionValue;
exports.callAsyncFunctionValue = callAsyncFunctionValue;
exports.callFunction = callFunction;
exports.callUserFunctionTCO = callUserFunctionTCO;
exports.callFunctionValueTCO = callFunctionValueTCO;
exports.callUserFunctionRaw = callUserFunctionRaw;
exports.callFunctionValueRaw = callFunctionValueRaw;
const async_runtime_1 = require("./async-runtime");
const error_formatter_1 = require("./error-formatter");
const errors_1 = require("./errors");
const tco_1 = require("./tco");
/**
 * 클로저 실행 후 변경된 변수를 외부 스코프로 역전파.
 * set! 로 변경된 캡처 변수가 외부(savedStack)에도 반영되도록 함.
 * capturedEnv도 갱신하여 동일 클로저의 다음 호출에서도 최신 값 사용.
 */
function propagateMutations(interp, capturedEnv, paramSet, savedStack) {
    const finalState = interp.context.variables.snapshot();
    for (const [key, newVal] of finalState) {
        if (paramSet.has(key))
            continue; // 파라미터는 역전파 안 함
        if (!capturedEnv.has(key))
            continue; // 캡처된 변수만
        const oldVal = capturedEnv.get(key);
        if (newVal === oldVal)
            continue; // 변경 없으면 스킵
        // capturedEnv 갱신 (동일 클로저 다음 호출용)
        capturedEnv.set(key, newVal);
        // savedStack(외부 스코프) 갱신
        for (let i = savedStack.length - 1; i >= 0; i--) {
            if (savedStack[i].has(key)) {
                savedStack[i].set(key, newVal);
                break;
            }
        }
    }
}
const MAX_CALL_DEPTH = 5000; // Phase 61: 상향 (trampoline이 처리하므로 안전망 역할)
function callUserFunction(interp, name, args) {
    let baseName = name;
    let typeArgs = null;
    const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
    if (bracketMatch) {
        baseName = bracketMatch[1];
        const typeArgStr = bracketMatch[2];
        typeArgs = typeArgStr.split(",").map((t) => ({
            kind: "type",
            name: t.trim(),
        }));
    }
    const func = interp.context.functions.get(baseName);
    if (!func) {
        const candidates = [...interp.context.functions.keys()];
        const similar = (0, error_formatter_1.suggestSimilar)(baseName, candidates);
        const hint = similar
            ? `'${baseName}'를 찾을 수 없습니다. 혹시 '${similar}'를 말씀하신 건가요?`
            : `'${baseName}'를 찾을 수 없습니다. 함수가 정의되어 있는지 확인하세요.`;
        throw new errors_1.FunctionNotFoundError(baseName, interp.currentFilePath, interp.currentLine > 0 ? interp.currentLine : undefined, undefined, hint);
    }
    let isGenericCall = false;
    if (func.generics && func.generics.length > 0) {
        if (!typeArgs) {
            throw new Error(`Generic function '${baseName}' requires type arguments, e.g., ${baseName}[int] or ${baseName}[int string]`);
        }
        if (interp.context.typeChecker) {
            const instantiation = interp.context.typeChecker.instantiateGenericFunction(baseName, typeArgs);
            if (!instantiation.valid) {
                throw new Error(`Cannot instantiate generic function '${baseName}': ${instantiation.message}`);
            }
        }
        isGenericCall = true;
    }
    if (!isGenericCall && interp.context.runtimeTypeChecker) {
        interp.context.runtimeTypeChecker.checkCall(baseName, args);
    }
    // Native JS function
    if (typeof func.body === "function") {
        return func.body(...args);
    }
    if (func.params.length > args.length) {
        throw new Error(`Function '${baseName}' expects ${func.params.length} args, got ${args.length}`);
    }
    if (interp.callDepth >= MAX_CALL_DEPTH) {
        throw new Error(`FreeLang line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion in '${baseName}'`);
    }
    // Phase 54: For namespaced functions (list:mean), temporarily expose same-prefix functions
    const prefixMatch = baseName.match(/^([^:]+):/);
    const tempAliases = [];
    if (prefixMatch) {
        const prefix = prefixMatch[1] + ":";
        for (const [fname, fval] of interp.context.functions) {
            if (fname.startsWith(prefix)) {
                const unqualified = fname.slice(prefix.length);
                if (!interp.context.functions.has(unqualified)) {
                    interp.context.functions.set(unqualified, fval);
                    tempAliases.push(unqualified);
                }
            }
        }
    }
    // 클로저: capturedEnv가 있으면 해당 환경에서 실행
    if (func.capturedEnv) {
        const savedStack = interp.context.variables.saveStack();
        const paramSet = new Set(func.params);
        interp.callDepth++;
        let result;
        try {
            interp.context.variables.fromSnapshot(func.capturedEnv);
            for (let i = 0; i < func.params.length; i++) {
                interp.context.variables.set(func.params[i], args[i]);
            }
            result = interp.eval(func.body);
            propagateMutations(interp, func.capturedEnv, paramSet, savedStack);
        }
        finally {
            interp.callDepth--;
            interp.context.variables.restoreStack(savedStack);
            for (const alias of tempAliases)
                interp.context.functions.delete(alias);
        }
        return result;
    }
    // 일반 함수: 새 렉시컬 스코프
    interp.context.variables.push();
    interp.callDepth++;
    try {
        for (let i = 0; i < func.params.length; i++) {
            interp.context.variables.set(func.params[i], args[i]);
        }
        return interp.eval(func.body);
    }
    finally {
        interp.callDepth--;
        interp.context.variables.pop();
        for (const alias of tempAliases)
            interp.context.functions.delete(alias);
    }
}
function callFunctionValue(interp, fn, args) {
    if (fn.kind !== "function-value") {
        throw new Error(`Expected function-value, got ${fn.kind}`);
    }
    if (interp.callDepth >= MAX_CALL_DEPTH) {
        throw new Error(`FreeLang line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion`);
    }
    const savedStack = interp.context.variables.saveStack();
    const paramSet = new Set(fn.params);
    interp.callDepth++;
    let result;
    try {
        interp.context.variables.fromSnapshot(fn.capturedEnv);
        for (let i = 0; i < fn.params.length; i++) {
            interp.context.variables.set(fn.params[i], args[i]);
        }
        result = interp.eval(fn.body);
        propagateMutations(interp, fn.capturedEnv, paramSet, savedStack);
    }
    finally {
        interp.callDepth--;
        interp.context.variables.restoreStack(savedStack);
    }
    return result;
}
function callAsyncFunctionValue(interp, fn, args) {
    if (fn.kind !== "async-function-value") {
        throw new Error(`Expected async-function-value, got ${fn.kind}`);
    }
    return new async_runtime_1.FreeLangPromise((resolve, reject) => {
        const savedStack = interp.context.variables.saveStack();
        try {
            interp.context.variables.fromSnapshot(fn.capturedEnv);
            for (let i = 0; i < fn.params.length; i++) {
                interp.context.variables.set(fn.params[i], args[i]);
            }
            const result = interp.eval(fn.body);
            if (result instanceof async_runtime_1.FreeLangPromise) {
                result.then((value) => resolve(value)).catch((error) => reject(error));
            }
            else {
                resolve(result);
            }
        }
        catch (error) {
            reject(error);
        }
        finally {
            interp.context.variables.restoreStack(savedStack);
        }
    });
}
function callFunction(interp, fn, args) {
    if (fn.kind === "builtin-function") {
        return fn.fn(args.map((arg) => interp.eval(arg)));
    }
    else if (fn.kind === "function-value") {
        return callFunctionValue(interp, fn, args);
    }
    else if (fn.kind === "async-function-value") {
        return callAsyncFunctionValue(interp, fn, args);
    }
    else if (typeof fn === "function") {
        return fn(...args);
    }
    else if (fn.params && fn.body) {
        return callUserFunction(interp, fn.name || "anonymous", args);
    }
    else {
        throw new Error(`Cannot call ${typeof fn}`);
    }
}
// ─────────────────────────────────────────────────────────────────────
// Phase 61: TCO (Trampoline 기반) — 스택 없이 100만 재귀 지원
// ─────────────────────────────────────────────────────────────────────
/**
 * callUserFunctionTCO: 꼬리 재귀를 반복문으로 변환
 * - tcoMode=true로 eval 실행 → if 꼬리 위치 함수 호출이 TailCall 토큰 반환
 * - TailCall 토큰이 반환되면 인자만 교체하고 다시 실행
 * - 1,000,000번 반복 가능 (스택 없음)
 */
function callUserFunctionTCO(interp, name, args) {
    let currentName = name;
    let currentArgs = args;
    // TCO 모드 활성화 (if 꼬리 위치 → TailCall 토큰)
    const prevTcoMode = interp.tcoMode;
    interp.tcoMode = true;
    try {
        for (let i = 0; i < 2000000; i++) {
            let baseName = currentName;
            const bracketMatch = currentName.match(/^([\w\-]+)\[([^\]]+)\]$/);
            if (bracketMatch)
                baseName = bracketMatch[1];
            const func = interp.context.functions.get(baseName);
            if (!func) {
                const candidates = [...interp.context.functions.keys()];
                const similar = (0, error_formatter_1.suggestSimilar)(baseName, candidates);
                const hint = similar
                    ? `'${baseName}'를 찾을 수 없습니다. 혹시 '${similar}'를 말씀하신 건가요?`
                    : `'${baseName}'를 찾을 수 없습니다. 함수가 정의되어 있는지 확인하세요.`;
                throw new errors_1.FunctionNotFoundError(baseName, interp.currentFilePath, interp.currentLine > 0 ? interp.currentLine : undefined, undefined, hint);
            }
            // Native JS 함수는 바로 실행
            if (typeof func.body === "function") {
                return func.body(...currentArgs);
            }
            // 네임스페이스 함수 임시 alias
            const prefixMatch = baseName.match(/^([^:]+):/);
            const tempAliases = [];
            if (prefixMatch) {
                const prefix = prefixMatch[1] + ":";
                for (const [fname, fval] of interp.context.functions) {
                    if (fname.startsWith(prefix)) {
                        const unqualified = fname.slice(prefix.length);
                        if (!interp.context.functions.has(unqualified)) {
                            interp.context.functions.set(unqualified, fval);
                            tempAliases.push(unqualified);
                        }
                    }
                }
            }
            let result;
            try {
                if (func.capturedEnv) {
                    // 클로저
                    const savedStack = interp.context.variables.saveStack();
                    try {
                        interp.context.variables.fromSnapshot(func.capturedEnv);
                        for (let j = 0; j < func.params.length; j++) {
                            interp.context.variables.set(func.params[j], currentArgs[j]);
                        }
                        result = interp.eval(func.body);
                    }
                    finally {
                        interp.context.variables.restoreStack(savedStack);
                    }
                }
                else {
                    // 일반 함수
                    interp.context.variables.push();
                    try {
                        for (let j = 0; j < func.params.length; j++) {
                            interp.context.variables.set(func.params[j], currentArgs[j]);
                        }
                        result = interp.eval(func.body);
                    }
                    finally {
                        interp.context.variables.pop();
                    }
                }
            }
            finally {
                for (const alias of tempAliases)
                    interp.context.functions.delete(alias);
            }
            // TailCall 토큰이면 계속 반복
            if ((0, tco_1.isTailCall)(result)) {
                if (typeof result.fn === "string") {
                    currentName = result.fn;
                    currentArgs = result.args;
                    continue;
                }
                else {
                    // function-value TailCall → callFunctionValueTCO로 위임
                    return callFunctionValueTCO(interp, result.fn, result.args);
                }
            }
            return result;
        }
        throw new Error(`TCO: 최대 반복(2,000,000) 초과 — '${currentName}'에서 무한 재귀 가능성`);
    }
    finally {
        interp.tcoMode = prevTcoMode;
    }
}
/**
 * callFunctionValueTCO: function-value (람다/클로저) 꼬리 재귀를 반복문으로
 */
function callFunctionValueTCO(interp, fn, args) {
    let currentFn = fn;
    let currentArgs = args;
    for (let i = 0; i < 1000000; i++) {
        if (currentFn.kind !== "function-value") {
            throw new Error(`Expected function-value, got ${currentFn.kind}`);
        }
        const savedStack = interp.context.variables.saveStack();
        let result;
        try {
            interp.context.variables.fromSnapshot(currentFn.capturedEnv);
            for (let j = 0; j < currentFn.params.length; j++) {
                interp.context.variables.set(currentFn.params[j], currentArgs[j]);
            }
            result = interp.eval(currentFn.body);
        }
        finally {
            interp.context.variables.restoreStack(savedStack);
        }
        if ((0, tco_1.isTailCall)(result)) {
            if (typeof result.fn === "string") {
                return callUserFunctionTCO(interp, result.fn, result.args);
            }
            else {
                currentFn = result.fn;
                currentArgs = result.args;
                continue;
            }
        }
        return result;
    }
    throw new Error("TCO: 최대 반복(1,000,000) 초과 — function-value에서 무한 재귀 가능성");
}
/**
 * callUserFunctionRaw: trampoline용 — callDepth 체크 없이 단순 실행, TailCall 토큰 그대로 반환
 */
function callUserFunctionRaw(interp, name, args) {
    const func = interp.context.functions.get(name);
    if (!func)
        throw new errors_1.FunctionNotFoundError(name, interp.currentFilePath, interp.currentLine > 0 ? interp.currentLine : undefined);
    if (typeof func.body === "function")
        return func.body(...args);
    let result;
    if (func.capturedEnv) {
        const savedStack = interp.context.variables.saveStack();
        try {
            interp.context.variables.fromSnapshot(func.capturedEnv);
            for (let i = 0; i < func.params.length; i++) {
                interp.context.variables.set(func.params[i], args[i]);
            }
            result = interp.eval(func.body);
        }
        finally {
            interp.context.variables.restoreStack(savedStack);
        }
    }
    else {
        interp.context.variables.push();
        try {
            for (let i = 0; i < func.params.length; i++) {
                interp.context.variables.set(func.params[i], args[i]);
            }
            result = interp.eval(func.body);
        }
        finally {
            interp.context.variables.pop();
        }
    }
    return result;
}
/**
 * callFunctionValueRaw: trampoline용 — TailCall 토큰 그대로 반환
 */
function callFunctionValueRaw(interp, fn, args) {
    if (fn.kind !== "function-value")
        throw new Error(`Expected function-value, got ${fn.kind}`);
    const savedStack = interp.context.variables.saveStack();
    try {
        interp.context.variables.fromSnapshot(fn.capturedEnv);
        for (let i = 0; i < fn.params.length; i++) {
            interp.context.variables.set(fn.params[i], args[i]);
        }
        return interp.eval(fn.body);
    }
    finally {
        interp.context.variables.restoreStack(savedStack);
    }
}
//# sourceMappingURL=eval-call-function.js.map