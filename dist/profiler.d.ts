export interface ProfileEntry {
    name: string;
    callCount: number;
    totalMs: number;
    selfMs: number;
    avgMs: number;
    maxMs: number;
    minMs: number;
}
export declare class Profiler {
    enabled: boolean;
    private entries;
    private callStack;
    /**
     * enter(name) → exit 함수 반환
     * exit 호출 시 경과 시간 기록
     */
    enter(name: string): () => void;
    /**
     * record(name, ms): 직접 기록 (selfMs = ms로 가정)
     */
    record(name: string, ms: number): void;
    private _addEntry;
    /**
     * getReport(): callCount 내림차순 정렬된 ProfileEntry 배열
     */
    getReport(): ProfileEntry[];
    /**
     * getTop(n): 상위 N개 반환
     */
    getTop(n: number): ProfileEntry[];
    /**
     * reset(): 모든 데이터 초기화
     */
    reset(): void;
    /**
     * toMarkdown(): Markdown 테이블 출력
     */
    toMarkdown(): string;
    /**
     * toJSON(): ProfileEntry 배열을 JSON 객체로
     */
    toJSON(): object;
}
export declare const globalProfiler: Profiler;
//# sourceMappingURL=profiler.d.ts.map