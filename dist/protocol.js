"use strict";
// protocol.ts — FreeLang v9 Phase 64: Protocol/Interface System
// defprotocol + impl 다형성 지원
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolRegistry = void 0;
class ProtocolRegistry {
    constructor() {
        // protocolName → Protocol
        this.protocols = new Map();
        // "ProtocolName:TypeName" → ProtocolImpl
        this.impls = new Map();
        // methodName → Set<protocolName> (역인덱스: 어떤 프로토콜에 속하는지)
        this.methodIndex = new Map();
    }
    defineProtocol(proto) {
        this.protocols.set(proto.name, proto);
        for (const method of proto.methods) {
            if (!this.methodIndex.has(method.name)) {
                this.methodIndex.set(method.name, new Set());
            }
            this.methodIndex.get(method.name).add(proto.name);
        }
    }
    defineImpl(impl) {
        const key = `${impl.protocolName}:${impl.typeName}`;
        this.impls.set(key, impl);
    }
    /**
     * (serialize p) 호출 시:
     * 1. methodName("serialize")이 어떤 프로토콜에 속하는지 역인덱스로 탐색
     * 2. value.__type ("Point") 확인
     * 3. "Serializable:Point" impl 찾아 반환
     */
    resolveMethod(methodName, value) {
        const typeName = this.extractTypeName(value);
        if (!typeName)
            return null;
        const protoNames = this.methodIndex.get(methodName);
        if (!protoNames)
            return null;
        for (const protoName of protoNames) {
            const key = `${protoName}:${typeName}`;
            const impl = this.impls.get(key);
            if (impl && impl.methods.has(methodName)) {
                return impl;
            }
        }
        return null;
    }
    /**
     * 특정 타입이 프로토콜의 특정 메서드를 구현하고 있는지 확인
     */
    resolveMethodForType(methodName, typeName) {
        const protoNames = this.methodIndex.get(methodName);
        if (!protoNames)
            return null;
        for (const protoName of protoNames) {
            const key = `${protoName}:${typeName}`;
            const impl = this.impls.get(key);
            if (impl && impl.methods.has(methodName)) {
                return impl;
            }
        }
        return null;
    }
    hasMethod(methodName) {
        return this.methodIndex.has(methodName);
    }
    getProtocol(name) {
        return this.protocols.get(name);
    }
    getImpl(protocolName, typeName) {
        return this.impls.get(`${protocolName}:${typeName}`);
    }
    /**
     * 값에서 타입명 추출:
     * - value.__type: "Point" → "Point"
     * - Array → "List"
     * - string → "String"
     * - number → "Number"
     */
    extractTypeName(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value === "object" && !Array.isArray(value)) {
            if (value.__type)
                return String(value.__type);
        }
        if (Array.isArray(value))
            return "List";
        if (typeof value === "string")
            return "String";
        if (typeof value === "number")
            return "Number";
        if (typeof value === "boolean")
            return "Boolean";
        return null;
    }
}
exports.ProtocolRegistry = ProtocolRegistry;
//# sourceMappingURL=protocol.js.map