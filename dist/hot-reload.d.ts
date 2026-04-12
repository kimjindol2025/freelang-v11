export interface WatchOptions {
    debounceMs?: number;
    clearConsole?: boolean;
    onReload?: (file: string) => void;
    onError?: (file: string, err: Error) => void;
}
export declare function createDebounce(ms: number): (fn: () => void) => void;
export declare class FileWatcher {
    private watchers;
    /**
     * 단일 파일 감시
     * @returns stop 함수
     */
    watch(file: string, opts?: WatchOptions): () => void;
    /**
     * 디렉토리 내 pattern에 맞는 파일 감시
     * @returns stop 함수
     */
    watchDir(dir: string, pattern: string, opts?: WatchOptions): () => void;
    /** 모든 감시 중단 */
    stopAll(): void;
}
export declare function runWithWatch(file: string, opts?: WatchOptions): void;
//# sourceMappingURL=hot-reload.d.ts.map