"use strict";
// FreeLang v9 Delegation System — AI 서브태스크 위임
// Phase 122: [DELEGATE] 서브태스크 위임 블록
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalDelegation = exports.DelegationManager = void 0;
class DelegationManager {
    constructor() {
        this.agents = new Map();
    }
    register(agent) {
        this.agents.set(agent.id, agent);
    }
    // 능력 기반 에이전트 찾기
    findCapable(capability) {
        return [...this.agents.values()].filter(a => a.capabilities.includes(capability));
    }
    // 단일 태스크 위임
    delegate(task) {
        const candidates = task.requiredCapability
            ? this.findCapable(task.requiredCapability)
            : [...this.agents.values()];
        if (candidates.length === 0) {
            return { taskId: task.id, agentId: 'none', output: null, success: false, duration: 0 };
        }
        const agent = candidates[0];
        const start = Date.now();
        try {
            const output = agent.execute(task);
            return { taskId: task.id, agentId: agent.id, output, success: true, duration: Date.now() - start };
        }
        catch (e) {
            return { taskId: task.id, agentId: agent.id, output: null, success: false, duration: Date.now() - start };
        }
    }
    // 여러 태스크 병렬 위임
    delegateAll(tasks) {
        const start = Date.now();
        const results = tasks.map(t => this.delegate(t));
        return {
            results,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalDuration: Date.now() - start
        };
    }
    list() { return [...this.agents.keys()]; }
    size() { return this.agents.size; }
}
exports.DelegationManager = DelegationManager;
exports.globalDelegation = new DelegationManager();
//# sourceMappingURL=delegate.js.map