export interface CheckpointEntry {
    name: string;
    state: any;
    timestamp: number;
    depth: number;
}
export declare class CheckpointManager {
    private checkpoints;
    private depth;
    /** 상태 저장 (깊은 복사) */
    save(name: string, state: any): void;
    /** 최신 버전 복원 */
    restore(name: string): any | null;
    /** 특정 인덱스 버전 복원 */
    restoreAt(name: string, index: number): any | null;
    /** 전체 엔트리 조회 (timestamp 포함) */
    getEntries(name: string): CheckpointEntry[];
    /**
     * 분기 시도: fn 실패 시 자동 복원
     * 성공 → { success: true, result, restored: state }
     * 실패 → { success: false, restored: <saved state> }
     */
    branch<T>(name: string, state: any, fn: (state: any) => T): {
        success: boolean;
        result?: T;
        restored: any;
    };
    /** 체크포인트 삭제 */
    drop(name: string): boolean;
    /** 저장된 이름 목록 */
    list(): string[];
    /** 특정 이름의 버전 수 */
    versions(name: string): number;
    /** 현재 branch 깊이 */
    getDepth(): number;
    /** 전체 초기화 */
    clear(): void;
}
/** 전역 싱글톤 */
export declare const globalCheckpoint: CheckpointManager;
//# sourceMappingURL=checkpoint.d.ts.map