export type PromptTarget = 'claude' | 'gpt' | 'generic';
export interface CompileResult {
    prompt: string;
    target: PromptTarget;
    tokens: number;
    sections: string[];
}
export interface PromptSection {
    name: string;
    content: string;
    priority: number;
}
export declare class PromptCompiler {
    private target;
    constructor(target?: PromptTarget);
    compileBlock(blockType: string, args?: Record<string, any>): PromptSection | null;
    compile(sections: PromptSection[], userInstruction: string): CompileResult;
    compileFromCode(flCode: string, instruction: string): CompileResult;
    setTarget(target: PromptTarget): void;
    getTarget(): PromptTarget;
}
export declare const globalCompiler: PromptCompiler;
//# sourceMappingURL=prompt-compiler.d.ts.map