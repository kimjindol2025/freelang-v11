"use strict";
// FreeLang v9 Prompt Compiler
// Phase 109: FL 코드 → LLM 프롬프트 문자열 컴파일
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCompiler = exports.PromptCompiler = void 0;
// FL 블록 타입 → 프롬프트 섹션 매핑
const BLOCK_TEMPLATES = {
    COT: (args) => ({
        name: 'chain-of-thought',
        priority: 1,
        content: `Think step by step:\n${(args.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\nThen provide your conclusion.`
    }),
    TOT: (args) => ({
        name: 'tree-of-thought',
        priority: 1,
        content: `Explore multiple approaches:\n${(args.branches ?? []).map((b) => `- ${b}`).join('\n')}\nEvaluate each and select the best.`
    }),
    REFLECT: (args) => ({
        name: 'self-reflection',
        priority: 0.5,
        content: `After responding, reflect on:\n${(args.criteria ?? ['accuracy', 'completeness']).map((c) => `- ${c}`).join('\n')}\nScore each criterion (0-10) and revise if below ${(args.threshold ?? 0.7) * 10}.`
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
class PromptCompiler {
    constructor(target = 'claude') {
        this.target = target;
    }
    // FL 블록 정보 → 프롬프트 섹션
    compileBlock(blockType, args = {}) {
        const template = BLOCK_TEMPLATES[blockType];
        if (!template)
            return null;
        return template(args);
    }
    // 여러 섹션 → 최종 프롬프트
    compile(sections, userInstruction) {
        // 우선순위 정렬
        const sorted = [...sections].sort((a, b) => b.priority - a.priority);
        const parts = [];
        if (this.target === 'claude') {
            parts.push('Human: ' + userInstruction);
            parts.push('\n[Instructions]');
            sorted.forEach(s => { if (s.content)
                parts.push(s.content); });
            parts.push('\nAssistant:');
        }
        else if (this.target === 'gpt') {
            parts.push('[System]');
            sorted.forEach(s => { if (s.content)
                parts.push(s.content); });
            parts.push('\n[User]: ' + userInstruction);
        }
        else {
            sorted.forEach(s => { if (s.content)
                parts.push(s.content); });
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
    compileFromCode(flCode, instruction) {
        const sections = [];
        const blockRegex = /\[(COT|TOT|REFLECT|AGENT|CONTEXT|SELF-IMPROVE)[^\]]*\]/g;
        let match;
        while ((match = blockRegex.exec(flCode)) !== null) {
            const blockType = match[1];
            const section = this.compileBlock(blockType, {});
            if (section)
                sections.push(section);
        }
        if (sections.length === 0) {
            sections.push({ name: 'default', content: '', priority: 0.5 });
        }
        return this.compile(sections, instruction);
    }
    setTarget(target) { this.target = target; }
    getTarget() { return this.target; }
}
exports.PromptCompiler = PromptCompiler;
exports.globalCompiler = new PromptCompiler('claude');
//# sourceMappingURL=prompt-compiler.js.map