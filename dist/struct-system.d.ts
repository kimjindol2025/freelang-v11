export interface StructField {
    name: string;
    type: string;
}
export interface StructDef {
    name: string;
    fields: StructField[];
}
export declare class StructRegistry {
    private structs;
    /** Struct 정의 등록 */
    define(def: StructDef): void;
    /** Struct 정의 조회 */
    get(name: string): StructDef | undefined;
    /** 등록된 모든 Struct 이름 */
    names(): string[];
    /**
     * TypeName → constructor function
     * (Point 1.0 2.0) → {:x 1.0 :y 2.0 :__type "Point"}
     */
    makeConstructor(name: string): (...args: any[]) => Record<string, any>;
    /**
     * TypeName? → predicate function
     * (Point? v) → true if v.__type === "Point"
     */
    makePredicate(name: string): (val: any) => boolean;
    /**
     * TypeName.field → accessor function
     * (Point.x v) → v.x
     */
    makeAccessor(typeName: string, field: string): (val: any) => any;
    /** val이 struct인지 확인 (__type 키 존재) */
    isStruct(val: any): boolean;
    /** Struct의 field 이름 목록 반환 */
    getFields(name: string): string[];
}
//# sourceMappingURL=struct-system.d.ts.map