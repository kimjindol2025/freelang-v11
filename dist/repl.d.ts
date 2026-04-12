import { Interpreter } from "./interpreter";
export interface ReplResult {
    value: any;
    error?: string;
}
export declare class FreeLangReplCore {
    interp: Interpreter;
    history: string[];
    constructor(interp?: Interpreter);
    /**
     * 소스 라인 평가 (eval 핵심)
     */
    evalLine(src: string): ReplResult;
    /**
     * :cmd 명령어 처리
     * 반환값: 출력할 문자열 (undefined = 출력 없음)
     */
    handleCmd(cmd: string): string | undefined;
    /**
     * 한 줄 처리 (히스토리 누적 + :cmd 분기)
     * 반환: { output, isError }
     */
    processLine(line: string): {
        output: string | null;
        isError: boolean;
    };
}
/**
 * 인터랙티브 REPL (readline 사용)
 */
export declare class FreeLangRepl {
    private core;
    private rl;
    constructor();
    start(): void;
    private completer;
    private prompt;
}
//# sourceMappingURL=repl.d.ts.map