// FreeLang v9: Phase 97 — Tool Registry
// AI 도구 사용 DSL: USE-TOOL, TOOL 블록, use-tool, list-tools

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'any'>;
  outputSchema?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
  execute: (args: Record<string, any>) => Promise<any> | any;
  timeout?: number; // ms, 기본 5000
}

export interface ToolResult {
  tool: string;
  input: Record<string, any>;
  output: any;
  durationMs: number;
  success: boolean;
  error?: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /** 도구 등록 (chainable) */
  register(tool: ToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /** 도구 조회 */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** 모든 도구 목록 */
  listAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** 비동기 도구 실행 */
  async execute(name: string, args: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        tool: name,
        input: args,
        output: null,
        durationMs: Date.now() - start,
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    const timeout = tool.timeout ?? 5000;

    try {
      const resultPromise = Promise.resolve(tool.execute(args));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool timeout: ${name} (${timeout}ms)`)), timeout)
      );
      const output = await Promise.race([resultPromise, timeoutPromise]);
      return {
        tool: name,
        input: args,
        output,
        durationMs: Date.now() - start,
        success: true,
      };
    } catch (e: any) {
      return {
        tool: name,
        input: args,
        output: null,
        durationMs: Date.now() - start,
        success: false,
        error: String(e?.message ?? e),
      };
    }
  }

  /** 동기 도구 실행 (비동기 도구는 await 없이 실행) */
  executeSync(name: string, args: Record<string, any>): ToolResult {
    const start = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        tool: name,
        input: args,
        output: null,
        durationMs: Date.now() - start,
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    try {
      const output = tool.execute(args);
      // Promise인 경우 그대로 반환 (동기 결과로 처리)
      return {
        tool: name,
        input: args,
        output,
        durationMs: Date.now() - start,
        success: true,
      };
    } catch (e: any) {
      return {
        tool: name,
        input: args,
        output: null,
        durationMs: Date.now() - start,
        success: false,
        error: String(e?.message ?? e),
      };
    }
  }
}

// ── 기본 내장 도구 등록 ──────────────────────────────────────────────────────

function makeSafeMathEval(expr: string): number {
  // 안전한 수학 표현식만 허용 (숫자, 연산자, 괄호, 공백, 소수점)
  const safe = expr.replace(/[^0-9+\-*/.() ]/g, '');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${safe})`)() as number;
}

export const globalToolRegistry = new ToolRegistry();

// math — 수학 계산
globalToolRegistry.register({
  name: 'math',
  description: '수학 표현식을 계산합니다. 예: {expr: "2 + 3 * 4"}',
  inputSchema: { expr: 'string' },
  outputSchema: 'number',
  execute: ({ expr }) => makeSafeMathEval(String(expr)),
});

// str-upper — 대문자 변환
globalToolRegistry.register({
  name: 'str-upper',
  description: '문자열을 대문자로 변환합니다.',
  inputSchema: { s: 'string' },
  outputSchema: 'string',
  execute: ({ s }) => String(s).toUpperCase(),
});

// str-lower — 소문자 변환
globalToolRegistry.register({
  name: 'str-lower',
  description: '문자열을 소문자로 변환합니다.',
  inputSchema: { s: 'string' },
  outputSchema: 'string',
  execute: ({ s }) => String(s).toLowerCase(),
});

// str-len — 문자열 길이
globalToolRegistry.register({
  name: 'str-len',
  description: '문자열 길이를 반환합니다.',
  inputSchema: { s: 'string' },
  outputSchema: 'number',
  execute: ({ s }) => String(s).length,
});

// json-parse — JSON 파싱
globalToolRegistry.register({
  name: 'json-parse',
  description: 'JSON 문자열을 객체로 파싱합니다.',
  inputSchema: { s: 'string' },
  outputSchema: 'any',
  execute: ({ s }) => JSON.parse(String(s)),
});

// json-stringify — JSON 직렬화
globalToolRegistry.register({
  name: 'json-stringify',
  description: '값을 JSON 문자열로 변환합니다.',
  inputSchema: { v: 'any' },
  outputSchema: 'string',
  execute: ({ v }) => JSON.stringify(v),
});

// type-of — 타입 확인
globalToolRegistry.register({
  name: 'type-of',
  description: '값의 타입을 반환합니다.',
  inputSchema: { v: 'any' },
  outputSchema: 'string',
  execute: ({ v }) => typeof v,
});
