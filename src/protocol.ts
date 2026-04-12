// protocol.ts — FreeLang v9 Phase 64: Protocol/Interface System
// defprotocol + impl 다형성 지원

export interface ProtocolMethod {
  name: string;
  params: string[];
  returnType?: string;
}

export interface Protocol {
  name: string;
  methods: ProtocolMethod[];
}

export interface ProtocolImpl {
  protocolName: string;
  typeName: string;
  methods: Map<string, { params: string[]; body: any }>;
}

export class ProtocolRegistry {
  // protocolName → Protocol
  private protocols = new Map<string, Protocol>();
  // "ProtocolName:TypeName" → ProtocolImpl
  private impls = new Map<string, ProtocolImpl>();
  // methodName → Set<protocolName> (역인덱스: 어떤 프로토콜에 속하는지)
  private methodIndex = new Map<string, Set<string>>();

  defineProtocol(proto: Protocol): void {
    this.protocols.set(proto.name, proto);
    for (const method of proto.methods) {
      if (!this.methodIndex.has(method.name)) {
        this.methodIndex.set(method.name, new Set());
      }
      this.methodIndex.get(method.name)!.add(proto.name);
    }
  }

  defineImpl(impl: ProtocolImpl): void {
    const key = `${impl.protocolName}:${impl.typeName}`;
    this.impls.set(key, impl);
  }

  /**
   * (serialize p) 호출 시:
   * 1. methodName("serialize")이 어떤 프로토콜에 속하는지 역인덱스로 탐색
   * 2. value.__type ("Point") 확인
   * 3. "Serializable:Point" impl 찾아 반환
   */
  resolveMethod(methodName: string, value: any): ProtocolImpl | null {
    const typeName = this.extractTypeName(value);
    if (!typeName) return null;

    const protoNames = this.methodIndex.get(methodName);
    if (!protoNames) return null;

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
  resolveMethodForType(methodName: string, typeName: string): ProtocolImpl | null {
    const protoNames = this.methodIndex.get(methodName);
    if (!protoNames) return null;

    for (const protoName of protoNames) {
      const key = `${protoName}:${typeName}`;
      const impl = this.impls.get(key);
      if (impl && impl.methods.has(methodName)) {
        return impl;
      }
    }
    return null;
  }

  hasMethod(methodName: string): boolean {
    return this.methodIndex.has(methodName);
  }

  getProtocol(name: string): Protocol | undefined {
    return this.protocols.get(name);
  }

  getImpl(protocolName: string, typeName: string): ProtocolImpl | undefined {
    return this.impls.get(`${protocolName}:${typeName}`);
  }

  /**
   * 값에서 타입명 추출:
   * - value.__type: "Point" → "Point"
   * - Array → "List"
   * - string → "String"
   * - number → "Number"
   */
  extractTypeName(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "object" && !Array.isArray(value)) {
      if (value.__type) return String(value.__type);
    }
    if (Array.isArray(value)) return "List";
    if (typeof value === "string") return "String";
    if (typeof value === "number") return "Number";
    if (typeof value === "boolean") return "Boolean";
    return null;
  }
}
