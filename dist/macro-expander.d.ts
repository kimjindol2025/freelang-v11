import { ASTNode } from "./ast";
export interface MacroDefinition {
    name: string;
    params: string[];
    body: ASTNode;
}
export declare function gensym(prefix?: string): string;
export declare function resetGensym(): void;
export declare class MacroExpander {
    private macros;
    define(name: string, params: string[], body: ASTNode): void;
    has(name: string): boolean;
    getMacro(name: string): MacroDefinition | undefined;
    expand(node: ASTNode): ASTNode;
    private renameLocals;
    private substitute;
    astToString(node: ASTNode): string;
}
//# sourceMappingURL=macro-expander.d.ts.map