"use strict";
// FreeLang v9 Version-Self — 자기 버전 관리
// Phase 139: [VERSION-SELF] AI가 자신의 상태/지식/능력을 버전으로 관리한다
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalVersioning = exports.SelfVersioning = void 0;
const crypto_1 = require("crypto");
function generateDiff(prev, next) {
    const prevStr = JSON.stringify(prev, null, 2);
    const nextStr = JSON.stringify(next, null, 2);
    if (prevStr === nextStr)
        return "(no changes)";
    const prevLines = prevStr.split("\n");
    const nextLines = nextStr.split("\n");
    const added = nextLines.filter(l => !prevLines.includes(l)).length;
    const removed = prevLines.filter(l => !nextLines.includes(l)).length;
    return `+${added} lines, -${removed} lines`;
}
function parseVersion(v) {
    const parts = v.split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
class SelfVersioning {
    constructor(maxHistory = 100) {
        this.maxHistory = maxHistory;
        this.history = {
            snapshots: [],
            current: "",
            total: 0,
            branches: new Map(),
        };
    }
    // 현재 상태 스냅샷
    snapshot(data, description, tags = [], performance) {
        const id = (0, crypto_1.randomUUID)();
        const parentId = this.history.current || undefined;
        const parent = parentId ? this.get(parentId) : null;
        // 버전 자동 결정: 첫 번째면 1.0.0, 이후면 patch 증가
        const version = parent
            ? this.bumpVersion(parent.version, "patch")
            : "1.0.0";
        const diff = parent ? generateDiff(parent.data, data) : undefined;
        const snap = {
            id,
            version,
            timestamp: new Date(),
            data,
            metadata: {
                description,
                tags,
                performance,
            },
            parentId,
            diff,
        };
        this.history.snapshots.push(snap);
        this.history.current = id;
        this.history.total++;
        // maxHistory 초과 시 오래된 것 제거 (branches에서 참조되지 않는 것만)
        if (this.history.snapshots.length > this.maxHistory) {
            const branchIds = new Set(this.history.branches.values());
            branchIds.add(this.history.current);
            const toRemove = this.history.snapshots.find(s => !branchIds.has(s.id) && s.id !== this.history.current);
            if (toRemove) {
                const idx = this.history.snapshots.indexOf(toRemove);
                this.history.snapshots.splice(idx, 1);
            }
        }
        return snap;
    }
    // 특정 버전으로 롤백
    rollback(id) {
        const current = this.latest();
        const target = this.get(id);
        if (!current || !target) {
            return {
                previous: current,
                restored: current,
                success: false,
                reason: `Snapshot ${id} not found`,
            };
        }
        this.history.current = id;
        return {
            previous: current,
            restored: target,
            success: true,
        };
    }
    // 이전 버전으로 롤백
    rollbackPrev() {
        const current = this.latest();
        if (!current || !current.parentId) {
            return {
                previous: current,
                restored: current,
                success: false,
                reason: "No previous version",
            };
        }
        return this.rollback(current.parentId);
    }
    // 버전 비교
    diff(id1, id2) {
        const s1 = this.get(id1);
        const s2 = this.get(id2);
        if (!s1 || !s2)
            return "(one or both snapshots not found)";
        return generateDiff(s1.data, s2.data);
    }
    // 특정 버전 조회
    get(id) {
        return this.history.snapshots.find(s => s.id === id) ?? null;
    }
    // 최신 버전
    latest() {
        if (!this.history.current)
            return null;
        return this.get(this.history.current);
    }
    // 버전 히스토리
    getHistory() {
        return [...this.history.snapshots];
    }
    // 태그로 검색
    findByTag(tag) {
        return this.history.snapshots.filter(s => s.metadata.tags.includes(tag));
    }
    // 브랜치 생성
    branch(name, fromId) {
        const targetId = fromId ?? this.history.current;
        if (!targetId)
            throw new Error("No snapshot to branch from");
        this.history.branches.set(name, targetId);
        return targetId;
    }
    // 브랜치 체크아웃
    checkout(branchName) {
        const id = this.history.branches.get(branchName);
        if (!id)
            return null;
        this.history.current = id;
        return this.get(id);
    }
    // 자동 버전 넘버 생성 (semantic versioning)
    nextVersion(type) {
        const latest = this.latest();
        const base = latest ? latest.version : "1.0.0";
        return this.bumpVersion(base, type);
    }
    bumpVersion(base, type) {
        const [major, minor, patch] = parseVersion(base);
        switch (type) {
            case "major": return `${major + 1}.0.0`;
            case "minor": return `${major}.${minor + 1}.0`;
            case "patch": return `${major}.${minor}.${patch + 1}`;
        }
    }
    // 최고 성능 버전
    bestPerforming() {
        const withPerf = this.history.snapshots.filter(s => s.metadata.performance !== undefined);
        if (withPerf.length === 0)
            return null;
        return withPerf.reduce((best, s) => (s.metadata.performance > best.metadata.performance) ? s : best);
    }
}
exports.SelfVersioning = SelfVersioning;
exports.globalVersioning = new SelfVersioning(100);
//# sourceMappingURL=version-self.js.map