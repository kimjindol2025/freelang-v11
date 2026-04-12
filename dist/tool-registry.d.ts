export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'any'>;
    outputSchema?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
    execute: (args: Record<string, any>) => Promise<any> | any;
    timeout?: number;
}
export interface ToolResult {
    tool: string;
    input: Record<string, any>;
    output: any;
    durationMs: number;
    success: boolean;
    error?: string;
}
export declare class ToolRegistry {
    private tools;
    /** 도구 등록 (chainable) */
    register(tool: ToolDefinition): this;
    /** 도구 조회 */
    get(name: string): ToolDefinition | undefined;
    /** 모든 도구 목록 */
    listAll(): ToolDefinition[];
    /** 비동기 도구 실행 */
    execute(name: string, args: Record<string, any>): Promise<ToolResult>;
    /** 동기 도구 실행 (비동기 도구는 await 없이 실행) */
    executeSync(name: string, args: Record<string, any>): ToolResult;
}
export declare const globalToolRegistry: ToolRegistry;
//# sourceMappingURL=tool-registry.d.ts.map