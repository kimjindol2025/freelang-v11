"use strict";
// FreeLang v9 Checkpoint — AI 추론 세이브포인트
// Phase 114: CHECKPOINT 저장/복원
// (cp-save "name" state)        — 저장
// (cp-restore "name")           → 최신 state
// (cp-branch "name" state fn)   → fn 실패 시 자동 복원
// (cp-drop "name")              → boolean
// (cp-list)                     → 이름 목록
// (cp-versions "name")          → 버전 수
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCheckpoint = exports.CheckpointManager = void 0;
class CheckpointManager {
    constructor() {
        this.checkpoints = new Map();
        this.depth = 0;
    }
    /** 상태 저장 (깊은 복사) */
    save(name, state) {
        const cloned = typeof structuredClone === "function"
            ? structuredClone(state)
            : JSON.parse(JSON.stringify(state));
        const entry = {
            name,
            state: cloned,
            timestamp: Date.now(),
            depth: this.depth,
        };
        if (!this.checkpoints.has(name))
            this.checkpoints.set(name, []);
        this.checkpoints.get(name).push(entry);
    }
    /** 최신 버전 복원 */
    restore(name) {
        const entries = this.checkpoints.get(name);
        if (!entries || entries.length === 0)
            return null;
        return entries[entries.length - 1].state;
    }
    /** 특정 인덱스 버전 복원 */
    restoreAt(name, index) {
        const entries = this.checkpoints.get(name);
        if (!entries || index < 0 || index >= entries.length)
            return null;
        return entries[index].state;
    }
    /** 전체 엔트리 조회 (timestamp 포함) */
    getEntries(name) {
        return this.checkpoints.get(name) ?? [];
    }
    /**
     * 분기 시도: fn 실패 시 자동 복원
     * 성공 → { success: true, result, restored: state }
     * 실패 → { success: false, restored: <saved state> }
     */
    branch(name, state, fn) {
        this.save(name, state);
        this.depth++;
        try {
            const result = fn(state);
            this.depth--;
            return { success: true, result, restored: state };
        }
        catch (_e) {
            this.depth--;
            const restored = this.restore(name);
            return { success: false, restored };
        }
    }
    /** 체크포인트 삭제 */
    drop(name) {
        return this.checkpoints.delete(name);
    }
    /** 저장된 이름 목록 */
    list() {
        return [...this.checkpoints.keys()];
    }
    /** 특정 이름의 버전 수 */
    versions(name) {
        return this.checkpoints.get(name)?.length ?? 0;
    }
    /** 현재 branch 깊이 */
    getDepth() {
        return this.depth;
    }
    /** 전체 초기화 */
    clear() {
        this.checkpoints.clear();
        this.depth = 0;
    }
}
exports.CheckpointManager = CheckpointManager;
/** 전역 싱글톤 */
exports.globalCheckpoint = new CheckpointManager();
//# sourceMappingURL=checkpoint.js.map