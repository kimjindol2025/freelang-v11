export declare class FLFormatter {
    private indentStr;
    private maxWidth;
    /** 소스 코드를 정형화된 문자열로 변환 */
    format(src: string): string;
    private formatNode;
    private formatLiteral;
    private formatSExpr;
    private formatFn;
    private formatDefine;
    private formatLet;
    private formatIf;
    private formatDo;
    private formatCond;
    private formatMatch;
    private formatBlock;
    private formatNodeArray;
    private formatPatternMatch;
    private formatMatchCase;
    private formatPattern;
    private formatFunctionValue;
    private formatTypeClass;
    private formatTypeClassInstance;
    private formatModuleBlock;
    private formatImportBlock;
    private formatOpenBlock;
    private formatSearchBlock;
    private formatLearnBlock;
    private formatReasoningBlock;
    private formatReasoningSequence;
    private formatAsyncFunction;
    private formatAwait;
    private formatTryBlock;
    private formatCatchClause;
    private formatThrow;
    private ind;
}
export declare function formatFL(src: string): string;
//# sourceMappingURL=formatter.d.ts.map