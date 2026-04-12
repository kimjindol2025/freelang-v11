"use strict";
// FreeLang v9: Struct System
// Phase 66: defstruct — 타입이 있는 레코드 타입
//   (defstruct Point [:x :float :y :float])
//   → (Point 1.0 2.0)  → {:x 1.0 :y 2.0 :__type "Point"}
//   → (Point? v)       → true/false
//   → (Point.x v)      → 1.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructRegistry = void 0;
class StructRegistry {
    constructor() {
        this.structs = new Map();
    }
    /** Struct 정의 등록 */
    define(def) {
        this.structs.set(def.name, def);
    }
    /** Struct 정의 조회 */
    get(name) {
        return this.structs.get(name);
    }
    /** 등록된 모든 Struct 이름 */
    names() {
        return Array.from(this.structs.keys());
    }
    /**
     * TypeName → constructor function
     * (Point 1.0 2.0) → {:x 1.0 :y 2.0 :__type "Point"}
     */
    makeConstructor(name) {
        const def = this.structs.get(name);
        if (!def)
            throw new Error(`StructRegistry: unknown struct "${name}"`);
        return (...args) => {
            if (args.length !== def.fields.length) {
                throw new Error(`${name} constructor: expected ${def.fields.length} arguments, got ${args.length}`);
            }
            const obj = { __type: name };
            for (let i = 0; i < def.fields.length; i++) {
                obj[def.fields[i].name] = args[i];
            }
            return obj;
        };
    }
    /**
     * TypeName? → predicate function
     * (Point? v) → true if v.__type === "Point"
     */
    makePredicate(name) {
        return (val) => {
            if (val === null || val === undefined)
                return false;
            if (typeof val !== "object")
                return false;
            return val.__type === name;
        };
    }
    /**
     * TypeName.field → accessor function
     * (Point.x v) → v.x
     */
    makeAccessor(typeName, field) {
        return (val) => {
            if (val === null || val === undefined) {
                throw new Error(`${typeName}.${field}: cannot access field on null/undefined`);
            }
            if (typeof val !== "object") {
                throw new Error(`${typeName}.${field}: expected struct, got ${typeof val}`);
            }
            if (val.__type !== typeName) {
                throw new Error(`${typeName}.${field}: expected ${typeName}, got ${val.__type ?? typeof val}`);
            }
            if (!(field in val)) {
                throw new Error(`${typeName}.${field}: field "${field}" not found`);
            }
            return val[field];
        };
    }
    /** val이 struct인지 확인 (__type 키 존재) */
    isStruct(val) {
        return val !== null && typeof val === "object" && val.__type !== undefined;
    }
    /** Struct의 field 이름 목록 반환 */
    getFields(name) {
        const def = this.structs.get(name);
        if (!def)
            return [];
        return def.fields.map((f) => f.name);
    }
}
exports.StructRegistry = StructRegistry;
//# sourceMappingURL=struct-system.js.map