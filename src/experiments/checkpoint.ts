// FreeLang v9 Checkpoint — AI 추론 세이브포인트
// Phase 114: CHECKPOINT 저장/복원
// (cp-save "name" state)        — 저장
// (cp-restore "name")           → 최신 state
// (cp-branch "name" state fn)   → fn 실패 시 자동 복원
// (cp-drop "name")              → boolean
// (cp-list)                     → 이름 목록
// (cp-versions "name")          → 버전 수

export interface CheckpointEntry {
  name: string;
  state: any;
  timestamp: number;
  depth: number;
}

export class CheckpointManager {
  private checkpoints: Map<string, CheckpointEntry[]> = new Map();
  private depth = 0;

  /** 상태 저장 (깊은 복사) */
  save(name: string, state: any): void {
    const cloned = typeof structuredClone === "function"
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state));
    const entry: CheckpointEntry = {
      name,
      state: cloned,
      timestamp: Date.now(),
      depth: this.depth,
    };
    if (!this.checkpoints.has(name)) this.checkpoints.set(name, []);
    this.checkpoints.get(name)!.push(entry);
  }

  /** 최신 버전 복원 */
  restore(name: string): any | null {
    const entries = this.checkpoints.get(name);
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1].state;
  }

  /** 특정 인덱스 버전 복원 */
  restoreAt(name: string, index: number): any | null {
    const entries = this.checkpoints.get(name);
    if (!entries || index < 0 || index >= entries.length) return null;
    return entries[index].state;
  }

  /** 전체 엔트리 조회 (timestamp 포함) */
  getEntries(name: string): CheckpointEntry[] {
    return this.checkpoints.get(name) ?? [];
  }

  /**
   * 분기 시도: fn 실패 시 자동 복원
   * 성공 → { success: true, result, restored: state }
   * 실패 → { success: false, restored: <saved state> }
   */
  branch<T>(
    name: string,
    state: any,
    fn: (state: any) => T,
  ): { success: boolean; result?: T; restored: any } {
    this.save(name, state);
    this.depth++;
    try {
      const result = fn(state);
      this.depth--;
      return { success: true, result, restored: state };
    } catch (_e) {
      this.depth--;
      const restored = this.restore(name);
      return { success: false, restored };
    }
  }

  /** 체크포인트 삭제 */
  drop(name: string): boolean {
    return this.checkpoints.delete(name);
  }

  /** 저장된 이름 목록 */
  list(): string[] {
    return [...this.checkpoints.keys()];
  }

  /** 특정 이름의 버전 수 */
  versions(name: string): number {
    return this.checkpoints.get(name)?.length ?? 0;
  }

  /** 현재 branch 깊이 */
  getDepth(): number {
    return this.depth;
  }

  /** 전체 초기화 */
  clear(): void {
    this.checkpoints.clear();
    this.depth = 0;
  }
}

/** 전역 싱글톤 */
export const globalCheckpoint = new CheckpointManager();
