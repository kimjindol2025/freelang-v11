export interface LSPPosition {
    line: number;
    character: number;
}
export interface LSPRange {
    start: LSPPosition;
    end: LSPPosition;
}
export interface LSPDiagnostic {
    range: LSPRange;
    message: string;
    severity: 1 | 2 | 3 | 4;
}
export interface LSPCompletionItem {
    label: string;
    kind: number;
    detail?: string;
    documentation?: string;
}
export declare class FLLanguageServer {
    private linter;
    private formatter;
    constructor();
    /**
     * 소스 코드에서 진단(에러/경고) 목록 반환
     * - 파싱 에러 → severity 1 (Error)
     * - linter 경고 → severity 2 (Warning) / 3 (Info)
     */
    getDiagnostics(src: string, filename?: string): LSPDiagnostic[];
    /**
     * 커서 위치에서 자동완성 항목 반환
     * - 내장 함수 목록
     * - 현재 파일에 정의된 함수/변수
     * - 알파벳 순 정렬
     */
    getCompletions(src: string, line: number, char: number): LSPCompletionItem[];
    /**
     * 커서 아래 심볼의 타입/문서 반환
     * - 내장 함수: 문서 반환
     * - 알 수 없는 위치: null 반환
     */
    getHover(src: string, line: number, char: number): string | null;
    /**
     * 소스 코드를 포맷하여 반환
     * formatter.ts의 FLFormatter 활용
     */
    formatDocument(src: string): string;
}
//# sourceMappingURL=lsp-server.d.ts.map