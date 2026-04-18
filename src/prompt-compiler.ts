// FreeLang v9 Prompt Compiler
// Phase 109: FL 코드 → LLM 프롬프트 문자열 컴파일

export type PromptTarget = 'claude' | 'gpt' | 'generic';

export interface CompileResult {
  prompt: string;
  target: PromptTarget;
  tokens: number;        // 추정 토큰 수
  sections: string[];    // 사용된 섹션들
}

export interface PromptSection {
  name: string;
  content: string;
  priority: number;      // 1=필수, 0.5=권장, 0=선택
}

// FL 블록 타입 → 프롬프트 섹션 매핑
const BLOCK_TEMPLATES: Record<string, (args: Record<string, any>) => PromptSection> = {
  COT: (args) => ({
    name: 'chain-of-thought',
    priority: 1,
    content: `Think step by step:\n${
      (args.steps ?? []).map((s: string, i: number) => `${i+1}. ${s}`).join('\n')
    }\nThen provide your conclusion.`
  }),
  TOT: (args) => ({
    name: 'tree-of-thought',
    priority: 1,
    content: `Explore multiple approaches:\n${
      (args.branches ?? []).map((b: string) => `- ${b}`).join('\n')
    }\nEvaluate each and select the best.`
  }),
  REFLECT: (args) => ({
    name: 'self-reflection',
    priority: 0.5,
    content: `After responding, reflect on:\n${
      (args.criteria ?? ['accuracy', 'completeness']).map((c: string) => `- ${c}`).join('\n')
    }\nScore each criterion (0-10) and revise if below ${(args.threshold ?? 0.7) * 10}.`
  }),
  AGENT: (args) => ({
    name: 'agent-loop',
    priority: 1,
    content: `Goal: ${args.goal ?? 'Complete the task'}\nMax steps: ${args.maxSteps ?? 5}\nFor each step: observe → think → act → verify.`
  }),
  CONTEXT: (args) => ({
    name: 'context',
    priority: 1,
    content: `Context window: ${args.maxTokens ?? 4096} tokens. Strategy: ${args.strategy ?? 'sliding'}.`
  }),
  'SELF-IMPROVE': (args) => ({
    name: 'self-improvement',
    priority: 0.5,
    content: `Iterations: ${args.iterations ?? 3}. After each response, evaluate and improve until satisfied.`
  }),
};

export class PromptCompiler {
  private target: PromptTarget;

  constructor(target: PromptTarget = 'claude') {
    this.target = target;
  }

  // FL 블록 정보 → 프롬프트 섹션
  compileBlock(blockType: string, args: Record<string, any> = {}): PromptSection | null {
    const template = BLOCK_TEMPLATES[blockType];
    if (!template) return null;
    return template(args);
  }

  // 여러 섹션 → 최종 프롬프트
  compile(sections: PromptSection[], userInstruction: string): CompileResult {
    // 우선순위 정렬
    const sorted = [...sections].sort((a, b) => b.priority - a.priority);
    const parts: string[] = [];

    if (this.target === 'claude') {
      parts.push('Human: ' + userInstruction);
      parts.push('\n[Instructions]');
      sorted.forEach(s => { if (s.content) parts.push(s.content); });
      parts.push('\nAssistant:');
    } else if (this.target === 'gpt') {
      parts.push('[System]');
      sorted.forEach(s => { if (s.content) parts.push(s.content); });
      parts.push('\n[User]: ' + userInstruction);
    } else {
      sorted.forEach(s => { if (s.content) parts.push(s.content); });
      parts.push('\n' + userInstruction);
    }

    const prompt = parts.join('\n');
    return {
      prompt,
      target: this.target,
      tokens: Math.ceil(prompt.length / 4),
      sections: sorted.map(s => s.name)
    };
  }

  // FL 코드 문자열에서 블록 감지 후 컴파일
  compileFromCode(flCode: string, instruction: string): CompileResult {
    const sections: PromptSection[] = [];
    const blockRegex = /\[(COT|TOT|REFLECT|AGENT|CONTEXT|SELF-IMPROVE)[^\]]*\]/g;
    let match;
    while ((match = blockRegex.exec(flCode)) !== null) {
      const blockType = match[1];
      const section = this.compileBlock(blockType, {});
      if (section) sections.push(section);
    }
    if (sections.length === 0) {
      sections.push({ name: 'default', content: '', priority: 0.5 });
    }
    return this.compile(sections, instruction);
  }

  setTarget(target: PromptTarget): void { this.target = target; }

  getTarget(): PromptTarget { return this.target; }
}

export const globalCompiler = new PromptCompiler('claude');
