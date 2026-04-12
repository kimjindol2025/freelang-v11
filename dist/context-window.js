"use strict";
// context-window.ts — FreeLang v9 Phase 95
// AI 컨텍스트 윈도우 관리: 무엇을 기억하고, 무엇을 버리고, 어떻게 압축할지
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManager = void 0;
let _idCounter = 0;
function genId() {
    return `ctx-${Date.now()}-${++_idCounter}`;
}
class ContextManager {
    constructor(maxTokens = 4096, strategy = "priority") {
        this.window = {
            maxTokens,
            entries: [],
            usedTokens: 0,
            strategy,
        };
    }
    // 토큰 추정: JSON.stringify 길이 / 4 (근사값)
    estimateTokens(content) {
        try {
            const str = typeof content === "string" ? content : JSON.stringify(content);
            return Math.max(1, Math.ceil(str.length / 4));
        }
        catch {
            return 1;
        }
    }
    hasRoom(tokens) {
        return this.window.usedTokens + tokens <= this.window.maxTokens;
    }
    add(content, opts) {
        const tokens = opts?.tokens ?? this.estimateTokens(content);
        const priority = opts?.priority ?? 0.5;
        const tags = opts?.tags ?? [];
        const id = genId();
        const entry = {
            id,
            content,
            tokens,
            priority,
            timestamp: Date.now(),
            tags,
        };
        this.window.entries.push(entry);
        this.window.usedTokens += tokens;
        // 용량 초과 시 자동 trim
        if (this.window.usedTokens > this.window.maxTokens) {
            this.trim();
        }
        return id;
    }
    get(id) {
        return this.window.entries.find((e) => e.id === id);
    }
    remove(id) {
        const idx = this.window.entries.findIndex((e) => e.id === id);
        if (idx !== -1) {
            this.window.usedTokens -= this.window.entries[idx].tokens;
            this.window.entries.splice(idx, 1);
            if (this.window.usedTokens < 0)
                this.window.usedTokens = 0;
        }
    }
    // 오래된/낮은 우선순위 항목 제거 — 용량이 확보될 때까지
    trim() {
        const removed = [];
        if (this.window.usedTokens <= this.window.maxTokens) {
            return removed;
        }
        // priority 낮은 순 → 오래된 순으로 정렬하여 제거
        const sorted = [...this.window.entries].sort((a, b) => {
            if (a.priority !== b.priority)
                return a.priority - b.priority;
            return a.timestamp - b.timestamp;
        });
        for (const candidate of sorted) {
            if (this.window.usedTokens <= this.window.maxTokens)
                break;
            const idx = this.window.entries.findIndex((e) => e.id === candidate.id);
            if (idx !== -1) {
                this.window.usedTokens -= this.window.entries[idx].tokens;
                removed.push(this.window.entries[idx]);
                this.window.entries.splice(idx, 1);
            }
        }
        if (this.window.usedTokens < 0)
            this.window.usedTokens = 0;
        return removed;
    }
    // 압축: fn이 entries를 받아 새 값 반환
    compress(fn) {
        return fn(this.window.entries);
    }
    getAll(tag) {
        if (!tag)
            return [...this.window.entries];
        return this.window.entries.filter((e) => e.tags.includes(tag));
    }
    stats() {
        const used = this.window.usedTokens;
        const max = this.window.maxTokens;
        const percent = max > 0 ? Math.round((used / max) * 100) : 0;
        return { used, max, percent, count: this.window.entries.length };
    }
}
exports.ContextManager = ContextManager;
//# sourceMappingURL=context-window.js.map