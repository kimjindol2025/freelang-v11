"use strict";
// FreeLang v9: Runtime Type System (Phase 60)
// 점진적 타입 체킹 — strict 모드에서만 런타임 검증
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeTypeChecker = void 0;
exports.inferType = inferType;
exports.isCompatible = isCompatible;
exports.toFlType = toFlType;
/**
 * 런타임 값에서 FlType 추론
 */
function inferType(value) {
    if (value === null || value === undefined)
        return "null";
    if (typeof value === "boolean")
        return "bool";
    if (typeof value === "number")
        return Number.isInteger(value) ? "int" : "float";
    if (typeof value === "string")
        return "string";
    if (Array.isArray(value))
        return "array";
    if (typeof value === "function")
        return "fn";
    if (typeof value === "object")
        return "map";
    return "any";
}
/**
 * 타입 호환성 검사
 * - any: 모든 타입과 호환
 * - number: int | float 모두 허용
 * - float: int와 호환 (int → float 자동 변환)
 */
function isCompatible(actual, expected) {
    if (expected === "any")
        return true;
    if (actual === "any")
        return true;
    if (actual === expected)
        return true;
    // number는 int, float 모두 허용
    if (expected === "number" && (actual === "int" || actual === "float"))
        return true;
    // float에는 int도 허용 (정수 → 부동소수점)
    if (expected === "float" && actual === "int")
        return true;
    // null은 any 외에는 비호환 (위에서 이미 처리)
    return false;
}
/**
 * TypeAnnotation name → FlType 변환
 * 기존 type-checker.ts의 TypeAnnotation.name 문자열과 호환
 */
function toFlType(typeName) {
    switch (typeName) {
        case "int": return "int";
        case "float": return "float";
        case "number": return "number";
        case "string": return "string";
        case "bool": return "bool";
        case "boolean": return "bool";
        case "array":
        case "array<any>":
            return "array";
        case "map": return "map";
        case "fn":
        case "function": return "fn";
        case "null": return "null";
        default: return "any";
    }
}
/**
 * RuntimeTypeChecker — Phase 60 핵심 클래스
 *
 * strict=false (기본): 타입 불일치 무시 → 기존 코드 모두 통과
 * strict=true: 타입 어노테이션 있는 함수 호출 시 실제 인수 타입 검증
 */
class RuntimeTypeChecker {
    constructor(strict = false) {
        // 함수 이름 → 타입 시그니처 (타입 어노테이션이 있는 함수만 등록)
        this.funcTypes = new Map();
        this.strict = strict;
    }
    get isStrict() {
        return this.strict;
    }
    /**
     * 함수 타입 시그니처 등록
     * paramTypeNames: TypeAnnotation.name 문자열 배열 (기존 type-checker와 호환)
     */
    registerFunc(name, paramTypeNames, retTypeName) {
        this.funcTypes.set(name, {
            params: paramTypeNames.map(toFlType),
            ret: toFlType(retTypeName),
        });
    }
    /**
     * 함수 호출 시 인수 타입 검증
     * strict 모드가 아니거나, 시그니처가 미등록이면 아무것도 하지 않음
     */
    checkCall(name, argValues) {
        if (!this.strict)
            return;
        const sig = this.funcTypes.get(name);
        if (!sig)
            return; // 시그니처 없음 → 검증 스킵
        // 인수 개수가 시그니처보다 적으면 스킵 (가변 인수 허용)
        const checkCount = Math.min(sig.params.length, argValues.length);
        for (let i = 0; i < checkCount; i++) {
            const expected = sig.params[i];
            if (expected === "any")
                continue; // any는 항상 통과
            const actual = inferType(argValues[i]);
            if (!isCompatible(actual, expected)) {
                throw new TypeError(`[strict] Type error in '${name}': argument ${i + 1} expected ${expected}, got ${actual} (value: ${JSON.stringify(argValues[i])})`);
            }
        }
    }
    /**
     * 함수 반환값 타입 검증 (optional — strict 모드)
     */
    checkReturn(name, retValue) {
        if (!this.strict)
            return;
        const sig = this.funcTypes.get(name);
        if (!sig || sig.ret === "any")
            return;
        const actual = inferType(retValue);
        if (!isCompatible(actual, sig.ret)) {
            throw new TypeError(`[strict] Return type error in '${name}': expected ${sig.ret}, got ${actual} (value: ${JSON.stringify(retValue)})`);
        }
    }
    /**
     * 등록된 함수 시그니처 조회 (테스트용)
     */
    getSignature(name) {
        return this.funcTypes.get(name);
    }
    /**
     * 등록된 함수 목록 (테스트용)
     */
    registeredFuncs() {
        return Array.from(this.funcTypes.keys());
    }
}
exports.RuntimeTypeChecker = RuntimeTypeChecker;
//# sourceMappingURL=type-system.js.map