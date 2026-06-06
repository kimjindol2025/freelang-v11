// FreeLang v9: Struct System
// Phase 66: defstruct — 타입이 있는 레코드 타입
//   (defstruct Point [:x :float :y :float])
//   → (Point 1.0 2.0)  → {:x 1.0 :y 2.0 :__type "Point"}
//   → (Point? v)       → true/false
//   → (Point.x v)      → 1.0

export interface StructField {
  name: string;   // "x"
  type: string;   // "float" | "int" | "string" | "bool" | "any"
}

export interface StructDef {
  name: string;
  fields: StructField[];
}

export class StructRegistry {
  private structs = new Map<string, StructDef>();

  /** Struct 정의 등록 */
  define(def: StructDef): void {
    this.structs.set(def.name, def);
  }

  /** Struct 정의 조회 */
  get(name: string): StructDef | undefined {
    return this.structs.get(name);
  }

  /** 등록된 모든 Struct 이름 */
  names(): string[] {
    return Array.from(this.structs.keys());
  }

  /**
   * TypeName → constructor function
   * (Point 1.0 2.0) → {:x 1.0 :y 2.0 :__type "Point"}
   */
  makeConstructor(name: string): (...args: any[]) => Record<string, any> {
    const def = this.structs.get(name);
    if (!def) throw new Error(`StructRegistry: unknown struct "${name}"`);
    return (...args: any[]) => {
      if (args.length !== def.fields.length) {
        throw new Error(
          `${name} constructor: expected ${def.fields.length} arguments, got ${args.length}`
        );
      }
      const obj: Record<string, any> = { __type: name };
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
  makePredicate(name: string): (val: any) => boolean {
    return (val: any) => {
      if (val === null || val === undefined) return false;
      if (typeof val !== "object") return false;
      return val.__type === name;
    };
  }

  /**
   * TypeName.field → accessor function
   * (Point.x v) → v.x
   */
  makeAccessor(typeName: string, field: string): (val: any) => any {
    return (val: any) => {
      if (val === null || val === undefined) {
        throw new Error(`${typeName}.${field}: cannot access field on null/undefined`);
      }
      if (typeof val !== "object") {
        throw new Error(`${typeName}.${field}: expected struct, got ${typeof val}`);
      }
      if (val.__type !== typeName) {
        throw new Error(
          `${typeName}.${field}: expected ${typeName}, got ${val.__type ?? typeof val}`
        );
      }
      if (!(field in val)) {
        throw new Error(`${typeName}.${field}: field "${field}" not found`);
      }
      return val[field];
    };
  }

  /** val이 struct인지 확인 (__type 키 존재) */
  isStruct(val: any): boolean {
    return val !== null && typeof val === "object" && val.__type !== undefined;
  }

  /** Struct의 field 이름 목록 반환 */
  getFields(name: string): string[] {
    const def = this.structs.get(name);
    if (!def) return [];
    return def.fields.map((f) => f.name);
  }
}
