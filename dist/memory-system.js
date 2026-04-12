"use strict";
// FreeLang v9 Memory System — Phase 101
// [REMEMBER :key "..." :value $x :ttl :forever]   → 장기 메모리
// [RECALL :key "..." :fallback $default]            → 조회
// [EPISODE :id "..." :what "..." :when now]         → 에피소드 기록
// [WORKING :set $x] / [WORKING :get]               → 단기 작업 메모리
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalMemory = exports.MemorySystem = void 0;
class MemorySystem {
    constructor() {
        this.longTerm = new Map();
        this.shortTerm = new Map();
        this.episodes = [];
        this.working = null;
    }
    // 저장
    remember(key, value, options = {}) {
        const entry = {
            key,
            value,
            scope: options.scope ?? 'long-term',
            ttl: options.ttl ?? 'forever',
            createdAt: Date.now(),
            accessCount: 0,
            tags: options.tags ?? []
        };
        if (entry.scope === 'short-term') {
            this.shortTerm.set(key, entry);
        }
        else {
            this.longTerm.set(key, entry);
        }
    }
    // 조회
    recall(key, fallback = null) {
        const entry = this.longTerm.get(key) ?? this.shortTerm.get(key);
        if (!entry)
            return fallback;
        // TTL 확인
        if (entry.ttl !== 'forever' && Date.now() - entry.createdAt > entry.ttl) {
            this.longTerm.delete(key);
            this.shortTerm.delete(key);
            return fallback;
        }
        entry.accessCount++;
        return entry.value;
    }
    // 삭제
    forget(key) {
        return this.longTerm.delete(key) || this.shortTerm.delete(key);
    }
    // 에피소드 기록
    recordEpisode(id, what, context = {}, outcome) {
        const ep = { id, what, when: Date.now(), context, outcome };
        this.episodes.push(ep);
        return ep;
    }
    // 에피소드 검색
    searchEpisodes(query) {
        return this.episodes.filter(ep => ep.what.includes(query) || ep.id.includes(query));
    }
    // 단기 작업 메모리
    setWorking(value) { this.working = value; }
    getWorking() { return this.working; }
    clearWorking() { this.working = null; }
    // 태그로 검색
    searchByTag(tag) {
        return [...this.longTerm.values(), ...this.shortTerm.values()]
            .filter(e => e.tags.includes(tag));
    }
    // 모든 키 목록
    keys(scope) {
        if (scope === 'short-term')
            return [...this.shortTerm.keys()];
        if (scope === 'long-term')
            return [...this.longTerm.keys()];
        return [...this.longTerm.keys(), ...this.shortTerm.keys()];
    }
    // 단기 메모리 만료된 것 정리
    purgeExpired() {
        let count = 0;
        const now = Date.now();
        for (const [k, e] of this.shortTerm) {
            if (e.ttl !== 'forever' && now - e.createdAt > e.ttl) {
                this.shortTerm.delete(k);
                count++;
            }
        }
        // 장기 메모리도 만료 확인
        for (const [k, e] of this.longTerm) {
            if (e.ttl !== 'forever' && now - e.createdAt > e.ttl) {
                this.longTerm.delete(k);
                count++;
            }
        }
        return count;
    }
    stats() {
        return {
            longTerm: this.longTerm.size,
            shortTerm: this.shortTerm.size,
            episodes: this.episodes.length
        };
    }
    // 전체 초기화 (테스트 용도)
    clear() {
        this.longTerm.clear();
        this.shortTerm.clear();
        this.episodes = [];
        this.working = null;
    }
}
exports.MemorySystem = MemorySystem;
// 글로벌 메모리 인스턴스
exports.globalMemory = new MemorySystem();
//# sourceMappingURL=memory-system.js.map