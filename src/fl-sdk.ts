// FreeLang v9 External AI SDK
// Phase 110: 외부 AI가 FL을 쓰는 SDK
// 외부 AI(Claude API, OpenAI API 등)가 FL 코드를 실행하거나 FL 블록을 생성할 수 있도록 SDK 제공

export interface FLSDKConfig {
  version: string;
  features: string[];
}

export interface FLCodeBlock {
  type: 'expression' | 'block' | 'program';
  code: string;
  description?: string;
}

export interface FLExecuteResult {
  success: boolean;
  output: any;
  error?: string;
  executionMs: number;
}

// FL 코드 생성 헬퍼 (AI가 FL 코드를 쉽게 생성하도록)
export class FLCodeBuilder {
  private lines: string[] = [];

  // 기본 폼
  define(name: string, value: string): FLCodeBuilder {
    this.lines.push(`(define ${name} ${value})`);
    return this;
  }

  defn(name: string, params: string[], body: string): FLCodeBuilder {
    this.lines.push(`(defn ${name} [${params.map(p => '$' + p).join(' ')}] ${body})`);
    return this;
  }

  call(fn: string, ...args: string[]): FLCodeBuilder {
    this.lines.push(`(${fn} ${args.join(' ')})`);
    return this;
  }

  // AI 블록
  cot(goal: string, steps: string[]): FLCodeBuilder {
    const stepStr = steps.map(s => `:step "${s}" nil`).join(' ');
    this.lines.push(`[COT :goal "${goal}" ${stepStr} :conclude identity]`);
    return this;
  }

  agent(goal: string, maxSteps: number = 5): FLCodeBuilder {
    this.lines.push(`[AGENT :goal "${goal}" :max-steps ${maxSteps} :step (fn [$s] $s)]`);
    return this;
  }

  maybe(confidence: number, value: string): FLCodeBuilder {
    this.lines.push(`(maybe ${confidence} ${value})`);
    return this;
  }

  result(type: 'ok' | 'err', value: string, errCode?: string): FLCodeBuilder {
    if (type === 'ok') this.lines.push(`(ok ${value})`);
    else this.lines.push(`(err "${errCode ?? 'ERROR'}" ${value})`);
    return this;
  }

  pipe(...fns: string[]): FLCodeBuilder {
    this.lines.push(`(-> $data ${fns.join(' ')})`);
    return this;
  }

  comment(text: string): FLCodeBuilder {
    this.lines.push(`; ${text}`);
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }

  reset(): FLCodeBuilder {
    this.lines = [];
    return this;
  }

  lineCount(): number { return this.lines.length; }
}

// FL SDK 메인 클래스
export class FLSDK {
  readonly version: string = '9.0.0';
  readonly features: string[] = [
    'maybe', 'cot', 'tot', 'reflect', 'context',
    'result', 'fl-try', 'use-tool', 'agent', 'self-improve',
    'memory', 'rag', 'multi-agent', 'try-reason',
    'streaming', 'quality-loop', 'tutor', 'debugger',
    'prompt-compiler'
  ];

  // 코드 빌더 생성
  builder(): FLCodeBuilder {
    return new FLCodeBuilder();
  }

  // FL 코드 블록 만들기
  block(type: FLCodeBlock['type'], code: string, description?: string): FLCodeBlock {
    return { type, code, description };
  }

  // 피처 지원 여부
  supports(feature: string): boolean {
    return this.features.includes(feature);
  }

  // FL 코드 검증 (간단한 괄호 밸런스 체크)
  validate(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let depth = 0;
    for (const ch of code) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') {
        depth--;
        if (depth < 0) {
          errors.push('Unexpected closing bracket');
          break;
        }
      }
    }
    if (depth > 0) errors.push(`Unclosed brackets: ${depth}`);
    return { valid: errors.length === 0, errors };
  }

  // 빠른 스니펫 생성
  snippet(concept: string): string {
    const snippets: Record<string, string> = {
      'maybe': '(maybe 0.8 "result")',
      'ok': '(ok 42)',
      'err': '(err "NOT_FOUND" "Item not found")',
      'cot': '[COT :step "analyze" nil :conclude identity]',
      'agent': '[AGENT :goal "task" :max-steps 5 :step (fn [$s] $s)]',
      'reflect': '[REFLECT :output $result :criteria [accuracy] :threshold 0.8]',
      'pipe': '(-> $data parse transform output)',
      'memory': '(mem-remember "key" "value")',
      'rag': '(rag-add "doc1" "content")',
    };
    return snippets[concept] ?? `; ${concept} snippet not found`;
  }

  getConfig(): FLSDKConfig {
    return { version: this.version, features: [...this.features] };
  }
}

export const sdk = new FLSDK();
export default sdk;
