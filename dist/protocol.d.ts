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
    methods: Map<string, {
        params: string[];
        body: any;
    }>;
}
export declare class ProtocolRegistry {
    private protocols;
    private impls;
    private methodIndex;
    defineProtocol(proto: Protocol): void;
    defineImpl(impl: ProtocolImpl): void;
    /**
     * (serialize p) 호출 시:
     * 1. methodName("serialize")이 어떤 프로토콜에 속하는지 역인덱스로 탐색
     * 2. value.__type ("Point") 확인
     * 3. "Serializable:Point" impl 찾아 반환
     */
    resolveMethod(methodName: string, value: any): ProtocolImpl | null;
    /**
     * 특정 타입이 프로토콜의 특정 메서드를 구현하고 있는지 확인
     */
    resolveMethodForType(methodName: string, typeName: string): ProtocolImpl | null;
    hasMethod(methodName: string): boolean;
    getProtocol(name: string): Protocol | undefined;
    getImpl(protocolName: string, typeName: string): ProtocolImpl | undefined;
    /**
     * 값에서 타입명 추출:
     * - value.__type: "Point" → "Point"
     * - Array → "List"
     * - string → "String"
     * - number → "Number"
     */
    extractTypeName(value: any): string | null;
}
//# sourceMappingURL=protocol.d.ts.map