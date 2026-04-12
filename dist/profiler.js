"use strict";
// FreeLang v9: Performance Profiler
// Phase 82: 함수별 호출 횟수, 실행 시간, selfMs 측정
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalProfiler = exports.Profiler = void 0;
class Profiler {
    constructor() {
        this.enabled = false;
        this.entries = new Map();
        // 호출 스택: selfMs(자식 제외 시간) 계산용
        this.callStack = [];
    }
    /**
     * enter(name) → exit 함수 반환
     * exit 호출 시 경과 시간 기록
     */
    enter(name) {
        if (!this.enabled)
            return () => { };
        const startMs = performance.now();
        const stackEntry = { name, startMs, childMs: 0 };
        this.callStack.push(stackEntry);
        return () => {
            const endMs = performance.now();
            const durationMs = endMs - startMs;
            const selfMs = durationMs - stackEntry.childMs;
            // 스택에서 제거
            const idx = this.callStack.lastIndexOf(stackEntry);
            if (idx !== -1)
                this.callStack.splice(idx, 1);
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
    record(name, ms) {
        if (!this.enabled)
            return;
        this._addEntry(name, ms, ms);
    }
    _addEntry(name, totalMs, selfMs) {
        const existing = this.entries.get(name);
        if (existing) {
            existing.callCount++;
            existing.totalMs += totalMs;
            existing.selfMs += selfMs;
            if (totalMs > existing.maxMs)
                existing.maxMs = totalMs;
            if (totalMs < existing.minMs)
                existing.minMs = totalMs;
        }
        else {
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
    getReport() {
        const result = [];
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
    getTop(n) {
        return this.getReport().slice(0, n);
    }
    /**
     * reset(): 모든 데이터 초기화
     */
    reset() {
        this.entries.clear();
        this.callStack = [];
    }
    /**
     * toMarkdown(): Markdown 테이블 출력
     */
    toMarkdown() {
        const report = this.getReport();
        if (report.length === 0) {
            return "| name | calls | totalMs | selfMs | avgMs | maxMs | minMs |\n|------|-------|---------|--------|-------|-------|-------|\n";
        }
        const header = "| name | calls | totalMs | selfMs | avgMs | maxMs | minMs |";
        const divider = "|------|-------|---------|--------|-------|-------|-------|";
        const rows = report.map(e => `| ${e.name} | ${e.callCount} | ${e.totalMs.toFixed(3)} | ${e.selfMs.toFixed(3)} | ${e.avgMs.toFixed(3)} | ${e.maxMs.toFixed(3)} | ${e.minMs.toFixed(3)} |`);
        return [header, divider, ...rows].join("\n");
    }
    /**
     * toJSON(): ProfileEntry 배열을 JSON 객체로
     */
    toJSON() {
        return this.getReport();
    }
}
exports.Profiler = Profiler;
// 싱글턴 인스턴스
exports.globalProfiler = new Profiler();
//# sourceMappingURL=profiler.js.map