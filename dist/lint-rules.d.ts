import { LintRule } from "./linter";
export declare const undefinedVars: LintRule;
export declare const unusedBindings: LintRule;
export declare const shadowedVars: LintRule;
export declare const arityCheck: LintRule;
export declare const emptyBody: LintRule;
export declare const unreachableMatch: LintRule;
export declare const deadCode: LintRule;
export declare const ALL_RULES: LintRule[];
/**
 * 이름으로 규칙 찾기
 */
export declare function getRuleByName(name: string): LintRule | undefined;
//# sourceMappingURL=lint-rules.d.ts.map