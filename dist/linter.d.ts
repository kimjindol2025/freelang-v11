import { ASTNode } from "./ast";
export interface LintDiagnostic {
    rule: string;
    severity: "error" | "warn" | "info";
    message: string;
    line?: number;
    col?: number;
}
export interface LintRule {
    name: string;
    check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[];
}
export interface LintContext {
    source: string;
    functions: Set<string>;
    variables: Set<string>;
    funcArity: Map<string, number>;
}
/**
 * AST를 깊이 우선 순회하며 콜백 실행
 */
export declare function walkAST(nodes: ASTNode[], cb: (node: ASTNode, parent?: ASTNode) => void, parent?: ASTNode): void;
export declare function buildLintContext(ast: ASTNode[], source: string): LintContext;
export declare class FLLinter {
    private rules;
    addRule(rule: LintRule): this;
    lint(src: string): LintDiagnostic[];
    /**
     * severity 필터링
     */
    lintFiltered(src: string, severity: "error" | "warn" | "info"): LintDiagnostic[];
}
/**
 * 기본 7개 규칙이 모두 포함된 FLLinter 인스턴스 생성
 */
export declare function createDefaultLinter(): FLLinter;
//# sourceMappingURL=linter.d.ts.map