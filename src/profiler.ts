// FreeLang v9: Performance Profiler
// Phase 82: 함수별 호출 횟수, 실행 시간, selfMs 측정

export interface ProfileEntry {
  name: string;
  callCount: number;
  totalMs: number;
  selfMs: number;       // 자식 호출 제외한 자신의 시간
  avgMs: number;
  maxMs: number;
  minMs: number;
}

interface ActiveCall {
  name: string;
  startMs: number;
  childMs: number;  // 자식 호출에 쓴 시간
}

export class Profiler {
  enabled: boolean = false;

  private entries: Map<string, {
    callCount: number;
    totalMs: number;
    selfMs: number;
    maxMs: number;
    minMs: number;
  }> = new Map();

  // 호출 스택: selfMs(자식 제외 시간) 계산용
  private callStack: ActiveCall[] = [];

  /**
   * enter(name) → exit 함수 반환
   * exit 호출 시 경과 시간 기록
   */
  enter(name: string): () => void {
    if (!this.enabled) return () => {};

    const startMs = performance.now();
    const stackEntry: ActiveCall = { name, startMs, childMs: 0 };
    this.callStack.push(stackEntry);

    return () => {
      const endMs = performance.now();
      const durationMs = endMs - startMs;
      const selfMs = durationMs - stackEntry.childMs;

      // 스택에서 제거
      const idx = this.callStack.lastIndexOf(stackEntry);
      if (idx !== -1) this.callStack.splice(idx, 1);

      // 부모에게 자식 시간 누산
      if (this.callStack.length > 0) {
        this.callStack[this.callStack.length - 1].childMs += durationMs;
      }

      this._addEntry(name, durationMs, selfMs);
    };
  }

  /**
   * record(name, ms): 직접 기록 (selfMs = ms로 가정)
   */
  record(name: string, ms: number): void {
    if (!this.enabled) return;
    this._addEntry(name, ms, ms);
  }

  private _addEntry(name: string, totalMs: number, selfMs: number): void {
    const existing = this.entries.get(name);
    if (existing) {
      existing.callCount++;
      existing.totalMs += totalMs;
      existing.selfMs += selfMs;
      if (totalMs > existing.maxMs) existing.maxMs = totalMs;
      if (totalMs < existing.minMs) existing.minMs = totalMs;
    } else {
      this.entries.set(name, {
        callCount: 1,
        totalMs,
        selfMs,
        maxMs: totalMs,
        minMs: totalMs,
      });
    }
  }

  /**
   * getReport(): callCount 내림차순 정렬된 ProfileEntry 배열
   */
  getReport(): ProfileEntry[] {
    const result: ProfileEntry[] = [];
    for (const [name, data] of this.entries) {
      result.push({
        name,
        callCount: data.callCount,
        totalMs: data.totalMs,
        selfMs: data.selfMs,
        avgMs: data.totalMs / data.callCount,
        maxMs: data.maxMs,
        minMs: data.minMs,
      });
    }
    result.sort((a, b) => b.callCount - a.callCount);
    return result;
  }

  /**
   * getTop(n): 상위 N개 반환
   */
  getTop(n: number): ProfileEntry[] {
    return this.getReport().slice(0, n);
  }

  /**
   * reset(): 모든 데이터 초기화
   */
  reset(): void {
    this.entries.clear();
    this.callStack = [];
  }

  /**
   * toMarkdown(): Markdown 테이블 출력
   */
  toMarkdown(): string {
    const report = this.getReport();
    if (report.length === 0) {
      return "| name | calls | totalMs | selfMs | avgMs | maxMs | minMs |\n|------|-------|---------|--------|-------|-------|-------|\n";
    }
    const header = "| name | calls | totalMs | selfMs | avgMs | maxMs | minMs |";
    const divider = "|------|-------|---------|--------|-------|-------|-------|";
    const rows = report.map(e =>
      `| ${e.name} | ${e.callCount} | ${e.totalMs.toFixed(3)} | ${e.selfMs.toFixed(3)} | ${e.avgMs.toFixed(3)} | ${e.maxMs.toFixed(3)} | ${e.minMs.toFixed(3)} |`
    );
    return [header, divider, ...rows].join("\n");
  }

  /**
   * toJSON(): ProfileEntry 배열을 JSON 객체로
   */
  toJSON(): object {
    return this.getReport();
  }
}

// 싱글턴 인스턴스
export const globalProfiler = new Profiler();
